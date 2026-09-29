import 'server-only';
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { sql } from './db';
import { env } from './env';

const scrypt = promisify(scryptCb) as (pw: Buffer, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_DAYS = 30;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;
export const PIN_RE = /^\d{6}$/;

export const cookieName = () => (env.isProd ? '__Host-spend_session' : 'spend_session');

export type SessionUser = {
  id: string;
  username: string;
  currency: string;
  monthlyBudget: number;
};

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

/** Six digits is a small space, so refuse the PINs people guess first. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 000000, 111111
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return true; // 123456, 654321
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return true; // 121212, 123123
  return ['112233', '696969', '159753', '147258', '102030', '200000', '100000', '999999'].includes(pin);
}

// PINs are HMAC'd with a server-side pepper, then stretched with scrypt and a
// per-user salt. Without the pepper (which never touches the DB) a stolen
// table can't be brute-forced offline, even though a PIN has only 10^6 values.
async function derive(pin: string, salt: Buffer): Promise<Buffer> {
  const peppered = createHmac('sha256', env.pinPepper).update(pin).digest();
  return scrypt(peppered, salt, 32, SCRYPT);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pin, salt);
  return `s1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [version, saltB64, keyB64] = stored.split('$');
  if (version !== 's1' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await derive(pin, Buffer.from(saltB64, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;
/** Spend the same time on unknown usernames so response timing doesn't reveal which exist. */
export function burnTime(pin: string) {
  dummyHash ??= hashPin('000000');
  return dummyHash.then((h) => verifyPin(pin, h));
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  await setSessionCookie(token);
}

async function setSessionCookie(token: string) {
  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

/** The signed-in user for this request, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token || token.length > 100) return null;
  const [row] = await sql<{ id: string; username: string; currency: string; monthly_budget: number }>`
    select u.id, u.username, u.currency, u.monthly_budget::float8 as monthly_budget
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()`;
  if (!row) return null;
  return { id: row.id, username: row.username, currency: row.currency, monthlyBudget: row.monthly_budget };
});

/** Slide the session forward when it's past its half-life (only callable from route handlers). */
export async function renewSession() {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return;
  const rows = await sql`
    update sessions set expires_at = now() + make_interval(days => ${SESSION_DAYS})
    where token_hash = ${hashToken(token)} and expires_at > now()
      and expires_at < now() + make_interval(days => ${SESSION_DAYS / 2})
    returning 1`;
  if (rows.length) await setSessionCookie(token);
}

export async function endSession({ everywhere = false, userId }: { everywhere?: boolean; userId?: string } = {}) {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (everywhere && userId) await sql`delete from sessions where user_id = ${userId}`;
  else if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  jar.delete(cookieName());
}

/** Drop every session for the user except the current one (after a PIN change). */
export async function endOtherSessions(userId: string) {
  const token = (await cookies()).get(cookieName())?.value ?? '';
  await sql`delete from sessions where user_id = ${userId} and token_hash <> ${hashToken(token)}`;
}
