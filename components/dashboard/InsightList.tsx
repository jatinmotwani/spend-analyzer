'use client';

import { categoryName } from '@/lib/categories';
import { dayLabel, pct, WEEKDAY_NAMES } from '@/lib/client/format';
import type { PeriodKind } from '@/lib/dates';
import type { Insight } from '@/lib/insights';
import { Icon, type IconName } from '../Icon';

type Money = (n: number, opts?: { whole?: boolean }) => string;

function render(i: Insight, ctx: { money: Money; noun: string; sameStretch: boolean; today: string }) {
  const { money, noun } = ctx;
  const vs = ctx.sameStretch ? `the same point last ${noun}` : `last ${noun}`;
  switch (i.kind) {
    case 'budgetPace':
      return i.over
        ? {
            icon: 'alert' as IconName,
            tone: 'warn',
            body: (
              <>
                On pace for <b>{money(i.projected, { whole: true })}</b>, which is {money(i.projected - i.budget, { whole: true })} over your budget.
              </>
            ),
          }
        : {
            icon: 'target' as IconName,
            tone: 'good',
            body: (
              <>
                On pace for <b>{money(i.projected, { whole: true })}</b>, comfortably inside your {money(i.budget, { whole: true })} budget.
              </>
            ),
          };
    case 'categoryChange':
      return i.delta > 0
        ? {
            icon: 'trend' as IconName,
            tone: 'neutral',
            body: (
              <>
                <b>{categoryName(i.category)}</b> is up {money(i.delta, { whole: true })} ({pct(i.pct)}) on {vs}.
              </>
            ),
          }
        : {
            icon: 'down' as IconName,
            tone: 'good',
            body: (
              <>
                <b>{categoryName(i.category)}</b> is down {money(-i.delta, { whole: true })} ({pct(-i.pct)}) on {vs}.
              </>
            ),
          };
    case 'smallSpends':
      return {
        icon: 'coins' as IconName,
        tone: 'neutral',
        body: (
          <>
            {i.count} small spends under {money(i.threshold, { whole: true })} added up to <b>{money(i.total, { whole: true })}</b>, or{' '}
            {pct(i.share)} of the {noun}.
          </>
        ),
      };
    case 'weekday':
      return {
        icon: 'calendar' as IconName,
        tone: 'neutral',
        body: (
          <>
            <b>{WEEKDAY_NAMES[i.weekday]}s</b> cost the most: {money(i.average, { whole: true })} on average, {i.ratio.toFixed(1)}× a typical day.
          </>
        ),
      };
    case 'noSpendDays':
      return {
        icon: 'leaf' as IconName,
        tone: 'good',
        body: (
          <>
            <b>
              {i.days} no-spend day{i.days === 1 ? '' : 's'}
            </b>{' '}
            out of {i.elapsed} so far.
          </>
        ),
      };
    case 'frequentPlace':
      return {
        icon: 'pin' as IconName,
        tone: 'neutral',
        body: (
          <>
            <b>{i.title}</b>, {i.count} times this {noun}, adding up to {money(i.total, { whole: true })}.
          </>
        ),
      };
    case 'topCategory':
      return {
        icon: 'star' as IconName,
        tone: 'neutral',
        body: (
          <>
            <b>{categoryName(i.category)}</b> is {pct(i.share)} of this {noun}’s spending.
          </>
        ),
      };
    case 'biggest':
      return {
        icon: 'spark' as IconName,
        tone: 'neutral',
        body: (
          <>
            Biggest spend: <b>{money(i.amount)}</b> at {i.title}, {dayLabel(i.date, ctx.today).toLowerCase()}.
          </>
        ),
      };
  }
}

export function InsightList({
  insights,
  money,
  kind,
  sameStretch,
  today,
}: {
  insights: Insight[];
  money: Money;
  kind: PeriodKind;
  sameStretch: boolean;
  today: string;
}) {
  return (
    <ul className="insights">
      {insights.map((i, n) => {
        const r = render(i, { money, noun: kind, sameStretch, today });
        return (
          <li key={n} className={`insight ${r.tone}`}>
            <span className="insight-icon">
              <Icon name={r.icon} size={18} />
            </span>
            <p>{r.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
