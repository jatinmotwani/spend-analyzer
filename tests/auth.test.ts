import { beforeAll, expect, test, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('@/lib/server/db', () => ({ sql: vi.fn(), raw: vi.fn() }));

beforeAll(() => {
  process.env.PIN_PEPPER = 'test-pepper-test-pepper-test-pepper-0123';
});

test('weak PINs are refused', async () => {
  const { isWeakPin } = await import('@/lib/server/auth');
  for (const pin of ['000000', '111111', '123456', '654321', '121212', '123123', '112233']) {
    expect(isWeakPin(pin), pin).toBe(true);
  }
  for (const pin of ['482915', '730264', '190847']) expect(isWeakPin(pin), pin).toBe(false);
});

test('PIN hashes are salted, peppered and verify', async () => {
  const { hashPin, verifyPin } = await import('@/lib/server/auth');
  const a = await hashPin('482915');
  const b = await hashPin('482915');
  expect(a).not.toBe(b); // unique salt
  expect(a).toMatch(/^s1\$/);
  expect(await verifyPin('482915', a)).toBe(true);
  expect(await verifyPin('482916', a)).toBe(false);
  expect(await verifyPin('482915', 'garbage')).toBe(false);

  // a different pepper can't verify the same hash
  process.env.PIN_PEPPER = 'another-pepper-another-pepper-another-00';
  expect(await verifyPin('482915', a)).toBe(false);
});

test('usernames', async () => {
  const { USERNAME_RE, normalizeUsername } = await import('@/lib/server/auth');
  expect(USERNAME_RE.test(normalizeUsername('  Jatin.M '))).toBe(true);
  expect(USERNAME_RE.test('ab')).toBe(false);
  expect(USERNAME_RE.test('robert"); drop table')).toBe(false);
});
