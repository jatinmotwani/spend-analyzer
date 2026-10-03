import { z } from 'zod';
import { endSession, PIN_RE, renewSession, verifyPin } from '@/lib/server/auth';
import { sql } from '@/lib/server/db';
import { body, fail, json, requireUser, route, tooMany } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { topPlaces } from '@/lib/server/spends';

export const GET = route(async () => {
  const user = await requireUser();
  await renewSession();
  return json({ ...user, places: await topPlaces(user.id) });
});

const Patch = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  monthlyBudget: z.number().min(0).lt(100_000_000).optional(),
});

export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const input = await body(req, Patch);
  await sql`
    update users set
      currency = coalesce(${input.currency ?? null}::text, currency),
      monthly_budget = coalesce(${input.monthlyBudget ?? null}::numeric, monthly_budget)
    where id = ${user.id}::uuid`;
  return json({ ok: true });
});

/** Delete the account and every spend. Requires the PIN again. */
export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  const limit = await hit(`pin-check:${user.id}`, 5, 900);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const { pin } = await body(req, z.object({ pin: z.string().regex(PIN_RE, 'Enter your 6-digit PIN') }));
  const [row] = await sql<{ pin_hash: string }>`select pin_hash from users where id = ${user.id}::uuid`;
  if (!row || !(await verifyPin(pin, row.pin_hash))) return fail(401, 'bad_pin', 'That PIN isn’t right.');
  await sql`delete from users where id = ${user.id}::uuid`;
  await endSession();
  return json({ ok: true });
});
