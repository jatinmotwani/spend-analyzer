import { describe, expect, test } from 'vitest';
import { getPeriod } from '@/lib/dates';
import { buildDashboard, niceCeil, type Spend } from '@/lib/insights';

let n = 0;
const spend = (date: string, amount: number, category: Spend['category'] = 'food', title = 'Cafe'): Spend => ({
  id: String(++n),
  amount,
  title,
  note: '',
  category,
  date,
  heard: '',
  source: 'text',
  createdAt: n,
});

const TODAY = '2026-09-15';

describe('periods', () => {
  test('weeks start on Monday', () => {
    expect(getPeriod('week', 0, '2026-09-29')).toMatchObject({ start: '2026-09-28', end: '2026-10-05', days: 7 });
  });
  test('months and years', () => {
    expect(getPeriod('month', -1, TODAY)).toMatchObject({ start: '2026-08-01', end: '2026-09-01', days: 31 });
    expect(getPeriod('year', 0, TODAY)).toMatchObject({ start: '2026-01-01', end: '2027-01-01', days: 365 });
  });
});

describe('buildDashboard', () => {
  const spends = [
    spend('2026-09-01', 100),
    spend('2026-09-03', 200, 'travel', 'Uber'),
    spend('2026-09-15', 300),
    spend('2026-09-20', 999), // future: outside the elapsed stretch but still in the month
    spend('2026-08-02', 50),
    spend('2026-08-10', 400, 'travel', 'Uber'),
    spend('2026-08-25', 1000), // after "the same point last month"
  ];
  const d = buildDashboard(spends, { kind: 'month', offset: 0, today: TODAY, monthlyBudget: 3000 });

  test('totals and same-stretch comparison', () => {
    expect(d.total).toBe(1599);
    expect(d.previous).toMatchObject({ start: '2026-08-01', end: '2026-08-16', total: 450, sameStretch: true });
    expect(d.period).toMatchObject({ isCurrent: true, elapsed: 15, days: 30 });
  });

  test('buckets and running totals', () => {
    expect(d.buckets).toHaveLength(30);
    expect(d.buckets[14]).toMatchObject({ key: '2026-09-15', total: 300, current: true, future: false });
    expect(d.buckets[19].future).toBe(true);
    expect(d.pace.current).toHaveLength(15);
    expect(d.pace.current.at(-1)).toBe(600);
    expect(d.pace.previous).toHaveLength(31);
    expect(d.pace.previous.at(-1)).toBe(1450);
  });

  test('categories carry the previous stretch for comparison', () => {
    const food = d.categories.find((c) => c.id === 'food')!;
    expect(food).toMatchObject({ total: 1399, prevTotal: 50, count: 3 });
  });

  test('budget and projection', () => {
    expect(d.budget).toEqual({ amount: 3000, projected: d.projected });
    expect(d.projected).toBeCloseTo((1599 / 15) * 30, 2);
    expect(d.insights[0]).toMatchObject({ kind: 'budgetPace', over: true });
  });

  test('no-spend days count elapsed days without spends', () => {
    expect(d.insights.find((i) => i.kind === 'noSpendDays')).toMatchObject({ days: 12, elapsed: 15 });
  });

  test('past periods compare with the whole previous period', () => {
    const past = buildDashboard(spends, { kind: 'month', offset: -1, today: TODAY, monthlyBudget: 0 });
    expect(past.total).toBe(1450);
    expect(past.previous.sameStretch).toBe(false);
    expect(past.projected).toBeNull();
    expect(past.budget).toBeNull();
  });

  test('empty periods produce no insights', () => {
    const empty = buildDashboard([], { kind: 'week', offset: 0, today: TODAY, monthlyBudget: 0 });
    expect(empty.insights).toEqual([]);
    expect(empty.total).toBe(0);
  });
});

test('niceCeil', () => {
  expect(niceCeil(42)).toBe(50);
  expect(niceCeil(180)).toBe(200);
  expect(niceCeil(1300)).toBe(2000);
  expect(niceCeil(100)).toBe(100);
});
