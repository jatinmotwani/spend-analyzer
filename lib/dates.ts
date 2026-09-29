// Calendar helpers. All dates are local calendar days ("YYYY-MM-DD"); the
// client tells the server what "today" is so timezones never shift a spend.

export const DAY_MS = 86_400_000;

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

export const localToday = () => toISODate(new Date());

/** Accepts a client-supplied "today" only if it is within a day of the server clock (timezones span ±14h). */
export function isPlausibleToday(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime()) || toISODate(d) !== iso) return false;
  const now = new Date();
  const utcToday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(daysBetween(utcToday, d)) <= 1;
}

export type PeriodKind = 'week' | 'month' | 'year';

export type Period = {
  kind: PeriodKind;
  offset: number;
  start: string; // inclusive
  end: string; // exclusive
  days: number;
};

export function getPeriod(kind: PeriodKind, offset: number, today: string): Period {
  const t = parseISODate(today);
  let start: Date;
  let end: Date;
  if (kind === 'week') {
    start = addDays(t, -((t.getDay() + 6) % 7) + offset * 7); // weeks start on Monday
    end = addDays(start, 7);
  } else if (kind === 'month') {
    start = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    end = new Date(t.getFullYear(), t.getMonth() + offset + 1, 1);
  } else {
    start = new Date(t.getFullYear() + offset, 0, 1);
    end = new Date(t.getFullYear() + offset + 1, 0, 1);
  }
  return { kind, offset, start: toISODate(start), end: toISODate(end), days: daysBetween(start, end) };
}
