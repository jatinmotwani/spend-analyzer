import { z } from 'zod';
import { burnTime, createSession, normalizeUsername, PIN_RE, USERNAME_RE, verifyPin } from '@/lib/server/auth';
import { sql } from '@/lib/server/db';
import { body, fail, json, route, tooMany } from '@/lib/server/http';
import { clientKey, hit, sweepExpired } from '@/lib/server/rate-limit';

const Input = z.object({ username: z.string().max(40), pin: z.string().max(12) });

const WRONG = () => fail(401, 'bad_credentials', 'Wrong username or PIN.');

export const POST = route(async (req: Request) => {
  // per-IP throttle on top of the per-account lockout below
  const limit = await hit(`login:ip:${await clientKey()}`, 20, 900);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const { username: rawName, pin } = await body(req, Input);
  const username = normalizeUsername(rawName);
  if (!USERNAME_RE.test(username) || !PIN_RE.test(pin)) {
    await burnTime(pin.padEnd(6, '0'));
    return WRONG();
  }

  const [user] = await sql<{ id: string; pin_hash: string; wait: number | null }>`
    select id, pin_hash,
      case when locked_until > now() then extract(epoch from locked_until - now())::float8 end as wait
    from users where username = ${username}`;
  if (!user) {
    await burnTime(pin);
    return WRONG();
  }
  if (user.wait) {
    const mins = Math.ceil(user.wait / 60);
    return tooMany(Math.ceil(user.wait), `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  if (!(await verifyPin(pin, user.pin_hash))) {
    // atomic: 5 misses, then lock 15 min, doubling each further miss, capped at a day
    await sql`
      update users set
        failed_logins = failed_logins + 1,
        locked_until = case when failed_logins + 1 >= 5
          then now() + make_interval(mins => least(15 * power(2, failed_logins + 1 - 5), 1440)::int)
          else locked_until end
      where id = ${user.id}::uuid`;
    return WRONG();
  }

  await sql`update users set failed_logins = 0, locked_until = null where id = ${user.id}::uuid`;
  await createSession(user.id);
  if (Math.random() < 0.2) await sweepExpired();
  return json({ ok: true });
});
