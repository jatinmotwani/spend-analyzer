'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { categoryName } from '@/lib/categories';
import { periodLabel, pct } from '@/lib/client/format';
import type { PeriodKind } from '@/lib/dates';
import type { Dashboard } from '@/lib/insights';
import { useShell } from '../AppShell';
import { Icon } from '../Icon';
import { SpendRow } from '../SpendList';
import { useToday } from '../useToday';
import { BucketBars, PaceChart, WeekdayBars } from './charts';
import { InsightList } from './InsightList';

const KINDS: PeriodKind[] = ['week', 'month', 'year'];

function Card({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Overview() {
  const { me, money, openType } = useShell();
  const today = useToday();
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const { data, error, isLoading } = useSWR<Dashboard>(
    today ? `/api/dashboard?kind=${kind}&offset=${offset}&today=${today}` : null,
  );

  const noun = kind;
  const prevName = kind === 'week' ? 'Last week' : kind === 'month' ? 'Last month' : 'Last year';
  const curName = offset === 0 ? `This ${noun}` : data && today ? periodLabel(data.period, today) : '';

  let delta = '';
  if (data) {
    const cmp = data.previous.sameStretch ? `same point last ${noun}` : `the ${noun} before`;
    const prev = data.previous.total;
    if (prev > 0 && data.total > 0) {
      const change = (data.total - prev) / prev;
      delta = Math.abs(change) < 0.005 ? `Level with the ${cmp}` : `${change > 0 ? '↑' : '↓'} ${pct(Math.abs(change))} vs ${cmp}`;
    } else if (prev > 0) delta = `${money(prev)} by the ${cmp}`;
    else if (data.total > 0) delta = `Nothing to compare with yet`;
  }

  const firstRun = data && data.count === 0 && data.previous.total === 0 && offset === 0;
  const budget = data?.budget;
  const budgetUsed = budget ? data.total / budget.amount : 0;
  const expected = data ? data.period.elapsed / data.period.days : 0;
  const daysLeft = data ? data.period.days - data.period.elapsed : 0;

  return (
    <main className="page">
      <header className="topbar">
        <span className="wordmark">
          spend<span>.</span>
        </span>
        <div className="segmented" role="tablist" aria-label="Period">
          {KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setOffset(0);
              }}
            >
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <section className="hero" aria-busy={isLoading}>
        <div className="period-nav">
          <button className="icon-btn" aria-label="Previous period" onClick={() => setOffset((o) => o - 1)}>
            <Icon name="left" />
          </button>
          <span>{data && today ? periodLabel(data.period, today) : ' '}</span>
          <button className="icon-btn" aria-label="Next period" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))}>
            <Icon name="right" />
          </button>
        </div>
        <div className={`total${data ? '' : ' loading'}`}>{data ? money(data.total) : money(0)}</div>
        <p className="delta">{error ? 'Couldn’t load. Pull to retry.' : delta || ' '}</p>

        {data && data.count > 0 && (
          <dl className="hero-stats">
            <div>
              <dt>per day</dt>
              <dd>{money(data.dailyAverage, { whole: true })}</dd>
            </div>
            <div>
              <dt>spends</dt>
              <dd>{data.count}</dd>
            </div>
            {data.projected !== null && kind !== 'year' ? (
              <div>
                <dt>on pace for</dt>
                <dd>{money(data.projected, { whole: true })}</dd>
              </div>
            ) : (
              <div>
                <dt>top</dt>
                <dd>{categoryName(data.categories[0]?.id ?? 'other')}</dd>
              </div>
            )}
          </dl>
        )}

        {budget && (
          <div className={`budget${budgetUsed > 1 ? ' over' : ''}`}>
            <div className="budget-track">
              <div className="budget-fill" style={{ width: `${Math.min(budgetUsed, 1) * 100}%` }} />
              {data.period.isCurrent && <div className="budget-marker" style={{ left: `${expected * 100}%` }} title="Where you'd be at an even pace" />}
            </div>
            <p className="budget-text">
              {budgetUsed > 1 ? (
                <>▲ Over budget by {money(data.total - budget.amount, { whole: true })}</>
              ) : data.period.isCurrent && daysLeft > 0 ? (
                <>
                  {money(budget.amount - data.total, { whole: true })} left · {money((budget.amount - data.total) / (daysLeft + 1), { whole: true })}/day for {daysLeft + 1} days
                </>
              ) : (
                <>
                  {pct(budgetUsed)} of {money(budget.amount, { whole: true })} budget
                </>
              )}
            </p>
          </div>
        )}
      </section>

      {firstRun ? (
        <section className="empty">
          <p className="empty-title">Say what you spent.</p>
          <p className="empty-sub">Tap the mic and talk naturally. Spend sorts it into categories and learns from your corrections.</p>
          <ul className="examples">
            {['450 at Starbucks', 'Uber 180 yesterday', '1,200 on groceries at DMart and 60 for chai'].map((e) => (
              <li key={e}>
                <button onClick={() => openType(e)}>“{e}”</button>
              </li>
            ))}
          </ul>
        </section>
      ) : data ? (
        <div className="grid">
          {data.insights.length > 0 && (
            <Card title="Worth noticing" className="span-2">
              <InsightList insights={data.insights} money={money} kind={kind} sameStretch={data.previous.sameStretch} today={data.period.today} />
            </Card>
          )}

          <Card title="Where it went">
            {data.total > 0 ? (
              <>
                <div className="stack" role="img" aria-label={data.categories.map((c) => `${categoryName(c.id)} ${pct(c.share)}`).join(', ')}>
                  {data.categories
                    .filter((c) => c.total > 0)
                    .map((c) => (
                      <span key={c.id} className="seg" style={{ flexGrow: c.total, '--c': `var(--cat-${c.id})` } as React.CSSProperties} />
                    ))}
                </div>
                <ul className="cats">
                  {data.categories
                    .filter((c) => c.total > 0)
                    .map((c) => {
                      const change = c.prevTotal > 0 ? (c.total - c.prevTotal) / c.prevTotal : null;
                      return (
                        <li key={c.id}>
                          <Link className="cat" href={`/activity?category=${c.id}`}>
                            <i className="dot" style={{ '--c': `var(--cat-${c.id})` } as React.CSSProperties} />
                            <span className="cat-name">{categoryName(c.id)}</span>
                            <span className="cat-change" title={`vs ${prevName.toLowerCase()}`}>
                              {change === null ? 'new' : Math.abs(change) < 0.01 ? '=' : `${change > 0 ? '↑' : '↓'}${pct(Math.abs(change))}`}
                            </span>
                            <span className="cat-pct">{pct(c.share)}</span>
                            <span className="cat-amt">{money(c.total, { whole: true })}</span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </>
            ) : (
              <p className="muted">Nothing logged for this {noun}.</p>
            )}
          </Card>

          <Card title="Running total">
            <PaceChart
              current={data.pace.current}
              previous={data.pace.previous}
              keys={data.buckets.map((b) => b.key)}
              kind={kind}
              budget={budget?.amount ?? null}
              projected={data.period.isCurrent ? data.projected : null}
              money={money}
              names={[curName || `This ${noun}`, offset === 0 ? prevName : `The ${noun} before`]}
            />
          </Card>

          <Card title={kind === 'year' ? 'Month by month' : 'Day by day'}>
            <BucketBars buckets={data.buckets} kind={kind} money={money} />
          </Card>

          {data.weekdays && (
            <Card title="Your week">
              <WeekdayBars weekdays={data.weekdays} money={money} />
            </Card>
          )}

          {data.places.length > 0 && (
            <Card title="Top places">
              <ol className="places">
                {data.places.map((p) => (
                  <li key={p.title}>
                    <div className="place-row">
                      <span className="place-name">{p.title}</span>
                      <span className="place-count">{p.count}×</span>
                      <span className="place-amt">{money(p.total, { whole: true })}</span>
                    </div>
                    <div className="place-bar">
                      <span style={{ width: `${(p.total / data.places[0].total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {data.recent.length > 0 && (
            <Card title="Latest" action={<Link className="link" href="/activity">See all</Link>}>
              <ul className="spends">
                {data.recent.map((s) => (
                  <SpendRow key={s.id} spend={s} showDate today={data.period.today} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid skeleton" aria-hidden="true">
          <div className="card" />
          <div className="card" />
        </div>
      )}
      <p className="sr-only">Signed in as {me.username}</p>
    </main>
  );
}
