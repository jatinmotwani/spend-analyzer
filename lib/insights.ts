// Pure dashboard maths. The BFF runs this on the server and sends the UI
// exactly what it renders; it has no I/O so it is cheap and unit-testable.
import { CATEGORY_IDS, type CategoryId } from './categories';
import { addDays, daysBetween, getPeriod, parseISODate, toISODate, type Period, type PeriodKind } from './dates';

export type Spend = {
  id: string;
  amount: number;
  title: string;
  note: string;
  category: CategoryId;
  date: string;
  heard: string;
  source: string;
  createdAt: number;
};

export type Insight =
  | { kind: 'budgetPace'; projected: number; budget: number; over: boolean }
  | { kind: 'categoryChange'; category: CategoryId; delta: number; pct: number }
  | { kind: 'smallSpends'; threshold: number; count: number; total: number; share: number }
  | { kind: 'weekday'; weekday: number; average: number; ratio: number }
  | { kind: 'noSpendDays'; days: number; elapsed: number }
  | { kind: 'frequentPlace'; title: string; count: number; total: number }
  | { kind: 'topCategory'; category: CategoryId; share: number; amount: number }
  | { kind: 'biggest'; title: string; amount: number; date: string };

export type Bucket = { key: string; total: number; future: boolean; current: boolean };

export type Dashboard = {
  period: Period & { isCurrent: boolean; elapsed: number; today: string };
  previous: { start: string; end: string; total: number; sameStretch: boolean };
  total: number;
  count: number;
  dailyAverage: number;
  projected: number | null;
  budget: { amount: number; projected: number | null } | null;
  categories: { id: CategoryId; total: number; count: number; share: number; prevTotal: number }[];
  buckets: Bucket[];
  pace: { current: number[]; previous: number[] };
  weekdays: { weekday: number; average: number }[] | null; // Monday-first
  places: { title: string; total: number; count: number }[];
  recent: Spend[];
  insights: Insight[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (list: Spend[]) => r2(list.reduce((a, s) => a + s.amount, 0));
const within = (s: Spend, from: string, to: string) => s.date >= from && s.date < to;

/** Round up to a friendly threshold: 42 -> 50, 180 -> 200, 1300 -> 2000. */
export function niceCeil(x: number): number {
  if (x <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(x));
  const step = [1, 2, 5, 10].find((s) => s * mag >= x) ?? 10;
  return step * mag;
}

function bucketKeys(p: Period): string[] {
  if (p.kind === 'year') {
    const y = p.start.slice(0, 4);
    return Array.from({ length: 12 }, (_, m) => `${y}-${String(m + 1).padStart(2, '0')}`);
  }
  const start = parseISODate(p.start);
  return Array.from({ length: p.days }, (_, i) => toISODate(addDays(start, i)));
}

const bucketOf = (kind: PeriodKind, date: string) => (kind === 'year' ? date.slice(0, 7) : date);

function cumulative(p: Period, spends: Spend[], upto: number): number[] {
  const keys = bucketKeys(p);
  const totals = new Map<string, number>();
  for (const s of spends) totals.set(bucketOf(p.kind, s.date), (totals.get(bucketOf(p.kind, s.date)) ?? 0) + s.amount);
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < Math.min(upto, keys.length); i++) {
    run += totals.get(keys[i]) ?? 0;
    out.push(r2(run));
  }
  return out;
}

/** The range the dashboard needs from the database: previous period start → current period end. */
export function dashboardRange(kind: PeriodKind, offset: number, today: string) {
  return { from: getPeriod(kind, offset - 1, today).start, to: getPeriod(kind, offset, today).end };
}

export function buildDashboard(
  all: Spend[],
  opts: { kind: PeriodKind; offset: number; today: string; monthlyBudget: number },
): Dashboard {
  const { kind, offset, today } = opts;
  const p = getPeriod(kind, offset, today);
  const prev = getPeriod(kind, offset - 1, today);
  const isCurrent = today >= p.start && today < p.end;
  const elapsed = isCurrent ? daysBetween(parseISODate(p.start), parseISODate(today)) + 1 : p.days;

  const spends = all.filter((s) => within(s, p.start, p.end));
  const total = sum(spends);

  // compare against the same stretch of the previous period while this one is still running
  const prevEnd = isCurrent
    ? toISODate(new Date(Math.min(addDays(parseISODate(prev.start), elapsed).getTime(), parseISODate(prev.end).getTime())))
    : prev.end;
  const prevSpends = all.filter((s) => within(s, prev.start, prevEnd));
  const prevTotal = sum(prevSpends);

  const dailyAverage = elapsed > 0 ? r2(total / elapsed) : 0;
  const projected = isCurrent && elapsed >= 3 ? r2((total / elapsed) * p.days) : null;
  const budget =
    kind === 'month' && opts.monthlyBudget > 0 ? { amount: opts.monthlyBudget, projected } : null;

  const categories = CATEGORY_IDS.map((id) => {
    const mine = spends.filter((s) => s.category === id);
    const t = sum(mine);
    return {
      id,
      total: t,
      count: mine.length,
      share: total > 0 ? t / total : 0,
      prevTotal: sum(prevSpends.filter((s) => s.category === id)),
    };
  })
    .filter((c) => c.total > 0 || c.prevTotal > 0)
    .sort((a, b) => b.total - a.total || b.prevTotal - a.prevTotal);

  // buckets for the bar chart
  const keys = bucketKeys(p);
  const byBucket = new Map<string, number>();
  for (const s of spends) byBucket.set(bucketOf(kind, s.date), (byBucket.get(bucketOf(kind, s.date)) ?? 0) + s.amount);
  const todayKey = bucketOf(kind, today);
  const buckets: Bucket[] = keys.map((key) => ({
    key,
    total: r2(byBucket.get(key) ?? 0),
    future: key > todayKey,
    current: key === todayKey,
  }));

  const elapsedBuckets = kind === 'year' ? (isCurrent ? parseISODate(today).getMonth() + 1 : 12) : elapsed;
  const pace = {
    current: cumulative(p, spends, elapsedBuckets),
    previous: cumulative(prev, all.filter((s) => within(s, prev.start, prev.end)), Infinity),
  };

  // weekday rhythm: average spend per weekday over the elapsed days
  let weekdays: Dashboard['weekdays'] = null;
  if (kind !== 'week' && elapsed >= 14) {
    const totals = Array(7).fill(0);
    const counts = Array(7).fill(0);
    const start = parseISODate(p.start);
    for (let i = 0; i < elapsed; i++) counts[(addDays(start, i).getDay() + 6) % 7] += 1;
    for (const s of spends) totals[(parseISODate(s.date).getDay() + 6) % 7] += s.amount;
    weekdays = totals.map((t, i) => ({ weekday: i, average: counts[i] ? r2(t / counts[i]) : 0 }));
  }

  // places: group by title
  const placeMap = new Map<string, { title: string; total: number; count: number }>();
  for (const s of spends) {
    const k = s.title.trim().toLowerCase();
    const e = placeMap.get(k) ?? { title: s.title, total: 0, count: 0 };
    e.total = r2(e.total + s.amount);
    e.count += 1;
    placeMap.set(k, e);
  }
  const places = [...placeMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  const recent = [...spends]
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, 5);

  const insights = pickInsights({
    kind, isCurrent, elapsed, total, spends, categories, budget, projected, weekdays, dailyAverage, places, today,
  });

  return {
    period: { ...p, isCurrent, elapsed, today },
    previous: { start: prev.start, end: prevEnd, total: prevTotal, sameStretch: isCurrent },
    total,
    count: spends.length,
    dailyAverage,
    projected,
    budget,
    categories,
    buckets,
    pace,
    weekdays,
    places,
    recent,
    insights,
  };
}

function pickInsights(d: {
  kind: PeriodKind;
  today: string;
  isCurrent: boolean;
  elapsed: number;
  total: number;
  spends: Spend[];
  categories: Dashboard['categories'];
  budget: Dashboard['budget'];
  projected: number | null;
  weekdays: Dashboard['weekdays'];
  dailyAverage: number;
  places: Dashboard['places'];
}): Insight[] {
  const out: Insight[] = [];
  if (!d.spends.length) return out;

  if (d.budget && d.projected !== null && d.isCurrent) {
    out.push({ kind: 'budgetPace', projected: d.projected, budget: d.budget.amount, over: d.projected > d.budget.amount });
  }

  const movers = d.categories
    .filter((c) => c.prevTotal > 0)
    .map((c) => ({ c, delta: r2(c.total - c.prevTotal), pct: (c.total - c.prevTotal) / c.prevTotal }))
    .filter((m) => Math.abs(m.pct) >= 0.2 && Math.abs(m.delta) >= d.total * 0.05);
  const up = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  const down = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  if (up) out.push({ kind: 'categoryChange', category: up.c.id, delta: up.delta, pct: up.pct });

  if (d.spends.length >= 8) {
    const amounts = d.spends.map((s) => s.amount).sort((a, b) => a - b);
    const threshold = niceCeil(amounts[Math.floor(amounts.length / 2)]);
    const small = d.spends.filter((s) => s.amount <= threshold);
    const smallTotal = sum(small);
    if (small.length >= 5 && smallTotal >= d.total * 0.08) {
      out.push({ kind: 'smallSpends', threshold, count: small.length, total: smallTotal, share: smallTotal / d.total });
    }
  }

  if (d.weekdays && d.dailyAverage > 0) {
    const top = d.weekdays.reduce((a, b) => (b.average > a.average ? b : a));
    const ratio = top.average / d.dailyAverage;
    if (ratio >= 1.3) out.push({ kind: 'weekday', weekday: top.weekday, average: top.average, ratio });
  }

  if (d.kind !== 'year' && d.elapsed >= 3) {
    const days = new Set(d.spends.filter((s) => s.date <= d.today).map((s) => s.date)).size;
    const free = d.elapsed - days;
    if (free > 0) out.push({ kind: 'noSpendDays', days: free, elapsed: d.elapsed });
  }

  const frequent = [...d.places].sort((a, b) => b.count - a.count)[0];
  if (frequent && frequent.count >= 3) out.push({ kind: 'frequentPlace', ...frequent });

  if (down) out.push({ kind: 'categoryChange', category: down.c.id, delta: down.delta, pct: down.pct });

  const top = d.categories[0];
  if (top && top.total > 0) out.push({ kind: 'topCategory', category: top.id, share: top.share, amount: top.total });

  const big = d.spends.reduce((a, b) => (b.amount > a.amount ? b : a));
  out.push({ kind: 'biggest', title: big.title, amount: big.amount, date: big.date });

  return out.slice(0, 4);
}
