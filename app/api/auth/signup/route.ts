import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createSession, hashPin, isWeakPin, normalizeUsername, PIN_RE, USERNAME_RE } from '@/lib/server/auth';
import { sql } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { body, fail, json, route, tooMany } from '@/lib/server/http';
import { clientKey, hit } from '@/lib/server/rate-limit';

const Input = z.object({
  username: z.string().max(40),
  pin: z.string().max(12),
  invite: z.string().max(200),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

const digest = (s: string) => createHash('sha256').update(s).digest();

export const POST = route(async (req: Request) => {
  const code = env.signupCode;
  if (!code) return fail(403, 'signups_closed', 'Signups are closed.');

  const limit = await hit(`signup:ip:${await clientKey()}`, 5, 3600);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const input = await body(req, Input);
  if (!timingSafeEqual(digest(input.invite.trim()), digest(code))) {
    return fail(403, 'bad_invite', 'That invite code isn’t right.');
  }
  const username = normalizeUsername(input.username);
  if (!USERNAME_RE.test(username)) {
    return fail(400, 'invalid_username', 'Use 3–24 letters, numbers, dots or underscores.');
  }
  if (!PIN_RE.test(input.pin)) return fail(400, 'invalid_pin', 'Your PIN needs exactly 6 digits.');
  if (isWeakPin(input.pin)) return fail(400, 'weak_pin', 'That PIN is too easy to guess. Try another.');

  const pinHash = await hashPin(input.pin);
  const [row] = await sql<{ id: string }>`
    insert into users (username, pin_hash, currency)
    values (${username}, ${pinHash}, ${input.currency ?? 'INR'})
    on conflict (username) do nothing
    returning id`;
  if (!row) return fail(409, 'taken', 'That username is taken.');

  await createSession(row.id);
  return json({ ok: true }, 201);
});
