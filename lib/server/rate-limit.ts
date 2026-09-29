import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { sql } from './db';

/**
 * Fixed-window counter stored in Postgres: one upsert per check, no extra service.
 * Returns whether this hit is allowed and how long until the window resets.
 */
export async function hit(key: string, limit: number, windowSeconds: number) {
  const [row] = await sql<{ hits: number; retry_after: number }>`
    insert into rate_limits as r (key, window_start, hits)
    values (${key}, now(), 1)
    on conflict (key) do update set
      hits = case when r.window_start <= now() - make_interval(secs => ${windowSeconds}) then 1 else r.hits + 1 end,
      window_start = case when r.window_start <= now() - make_interval(secs => ${windowSeconds}) then now() else r.window_start end
    returning hits, greatest(0, extract(epoch from (window_start + make_interval(secs => ${windowSeconds}) - now())))::float8 as retry_after`;
  return { ok: row.hits <= limit, retryAfter: Math.ceil(row.retry_after) };
}

/** Read-only peek, used to check a quota before spending money on it. */
export async function used(key: string, windowSeconds: number): Promise<number> {
  const [row] = await sql<{ hits: number }>`
    select hits from rate_limits
    where key = ${key} and window_start > now() - make_interval(secs => ${windowSeconds})`;
  return row?.hits ?? 0;
}

/** Client IP (Vercel overwrites x-forwarded-for / x-real-ip, so they can't be spoofed there), hashed. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

export async function sweepExpired() {
  await sql`delete from rate_limits where window_start < now() - interval '2 days'`;
  await sql`delete from sessions where expires_at < now()`;
}
