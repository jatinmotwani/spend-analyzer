import { addDays, daysBetween, parseISODate, type Period } from '../dates';

const cache = new Map<string, Intl.NumberFormat>();
const locale = () => (typeof navigator === 'undefined' ? 'en-IN' : navigator.language);

export function money(n: number, currency: string, opts: { whole?: boolean } = {}): string {
  const value = opts.whole ? Math.round(n) : n;
  const cents = !Number.isInteger(Math.round(value * 100) / 100);
  const key = `${currency}|${cents}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(), {
      style: 'currency',
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    cache.set(key, f);
  }
  return f.format(value);
}

export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(locale(), { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')
      ?.value ?? currency
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  parseISODate(iso).toLocaleDateString(locale(), opts);

export function dayLabel(iso: string, today: string) {
  const diff = daysBetween(parseISODate(iso), parseISODate(today));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function periodLabel(p: Period, today: string) {
  if (p.kind === 'week') {
    if (p.offset === 0) return 'This week';
    if (p.offset === -1) return 'Last week';
    const last = addDays(parseISODate(p.end), -1);
    return `${fmtDate(p.start, { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
  }
  if (p.kind === 'month') {
    const sameYear = p.start.slice(0, 4) === today.slice(0, 4);
    return fmtDate(p.start, { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  }
  return p.start.slice(0, 4);
}

export const PERIOD_NOUN = { week: 'week', month: 'month', year: 'year' } as const;

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
