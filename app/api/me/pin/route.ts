import { z } from 'zod';
import { endOtherSessions, hashPin, isWeakPin, PIN_RE, verifyPin } from '@/lib/server/auth';
import { sql } from '@/lib/server/db';
import { body, fail, json, requireUser, route, tooMany } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';

const Input = z.object({
  currentPin: z.string().regex(PIN_RE, 'Enter your current 6-digit PIN'),
  newPin: z.string().regex(PIN_RE, 'Your new PIN needs exactly 6 digits'),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const limit = await hit(`pin-check:${user.id}`, 5, 900);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const { currentPin, newPin } = await body(req, Input);
  if (isWeakPin(newPin)) return fail(400, 'weak_pin', 'That PIN is too easy to guess. Try another.');
  const [row] = await sql<{ pin_hash: string }>`select pin_hash from users where id = ${user.id}::uuid`;
  if (!row || !(await verifyPin(currentPin, row.pin_hash))) return fail(401, 'bad_pin', 'Your current PIN isn’t right.');

  await sql`update users set pin_hash = ${await hashPin(newPin)} where id = ${user.id}::uuid`;
  await endOtherSessions(user.id); // sign out every other device
  return json({ ok: true });
});
