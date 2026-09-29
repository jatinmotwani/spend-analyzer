'use client';

import { categoryName } from '@/lib/categories';
import { dayLabel } from '@/lib/client/format';
import type { Spend } from '@/lib/insights';
import { useShell } from './AppShell';

export function SpendRow({ spend, showDate, today }: { spend: Spend; showDate?: boolean; today?: string }) {
  const { money, openEdit } = useShell();
  return (
    <li>
      <button className="spend" onClick={() => openEdit(spend)}>
        <i className="dot" style={{ '--c': `var(--cat-${spend.category})` } as React.CSSProperties} />
        <span className="spend-main">
          <span className="spend-title">{spend.title}</span>
          <span className="spend-sub">
            {categoryName(spend.category)}
            {spend.note ? ` · ${spend.note}` : ''}
            {showDate && today ? ` · ${dayLabel(spend.date, today)}` : ''}
          </span>
        </span>
        <span className="spend-amt">{money(spend.amount)}</span>
      </button>
    </li>
  );
}

/** Spends grouped under day headings with a per-day total. */
export function DayGroups({ spends, today }: { spends: Spend[]; today: string }) {
  const { money } = useShell();
  const groups = new Map<string, Spend[]>();
  for (const s of spends) groups.set(s.date, [...(groups.get(s.date) ?? []), s]);
  return (
    <>
      {[...groups].map(([date, items]) => (
        <section className="day" key={date}>
          <header className="day-head">
            <span>{dayLabel(date, today)}</span>
            <span>{money(items.reduce((a, s) => a + s.amount, 0))}</span>
          </header>
          <ul className="spends">
            {items.map((s) => (
              <SpendRow key={s.id} spend={s} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
