'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { CATEGORY_IDS, CATEGORY_NAMES, isCategory, type CategoryId } from '@/lib/categories';
import { periodLabel } from '@/lib/client/format';
import { getPeriod, type Period } from '@/lib/dates';
import type { Spend } from '@/lib/insights';
import { useShell } from './AppShell';
import { Icon } from './Icon';
import { DayGroups } from './SpendList';
import { useToday } from './useToday';

function MonthSection({
  period,
  category,
  query,
  today,
}: {
  period: Period;
  category: CategoryId | null;
  query: string;
  today: string;
}) {
  const { money } = useShell();
  const { data, error } = useSWR<{ spends: Spend[] }>(`/api/spends?from=${period.start}&to=${period.end}`);
  const q = query.trim().toLowerCase();
  const spends = (data?.spends ?? []).filter(
    (s) => (!category || s.category === category) && (!q || `${s.title} ${s.note} ${s.heard}`.toLowerCase().includes(q)),
  );
  return (
    <section className="month">
      <header className="month-head">
        <h2>{periodLabel(period, today)}</h2>
        <span>{data ? money(spends.reduce((a, s) => a + s.amount, 0)) : ''}</span>
      </header>
      {error ? (
        <p className="muted">Couldn’t load this month.</p>
      ) : !data ? (
        <div className="row-skeleton" aria-hidden="true" />
      ) : spends.length ? (
        <DayGroups spends={spends} today={today} />
      ) : (
        <p className="muted">{category || q ? 'No matching spends.' : 'Nothing logged.'}</p>
      )}
    </section>
  );
}

export function Activity() {
  const today = useToday();
  const params = useSearchParams();
  const initial = params.get('category');
  const [category, setCategory] = useState<CategoryId | null>(isCategory(initial) ? initial : null);
  const [query, setQuery] = useState('');
  const [months, setMonths] = useState(2);

  return (
    <main className="page">
      <header className="topbar">
        <h1 className="page-title">Activity</h1>
      </header>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Search places, notes, what you said"
            value={query}
            maxLength={60}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search spends"
          />
        </label>
        <div className="chip-row" role="group" aria-label="Filter by category">
          <button className={`chip-btn${category === null ? ' on' : ''}`} onClick={() => setCategory(null)}>
            All
          </button>
          {CATEGORY_IDS.map((id) => (
            <button key={id} className={`chip-btn${category === id ? ' on' : ''}`} onClick={() => setCategory(category === id ? null : id)} aria-pressed={category === id}>
              <i className="dot" style={{ '--c': `var(--cat-${id})` } as React.CSSProperties} />
              {CATEGORY_NAMES[id]}
            </button>
          ))}
        </div>
      </div>

      {today && (
        <div className="activity">
          {Array.from({ length: months }, (_, i) => (
            <MonthSection key={i} period={getPeriod('month', -i, today)} category={category} query={query} today={today} />
          ))}
          {months < 36 && (
            <button className="btn ghost block" onClick={() => setMonths((m) => m + 1)}>
              Show {periodLabel(getPeriod('month', -months, today), today)}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
