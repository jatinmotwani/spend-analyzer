'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtDate, WEEKDAY_NAMES } from '@/lib/client/format';
import type { PeriodKind } from '@/lib/dates';
import type { Bucket } from '@/lib/insights';

type Money = (n: number, opts?: { whole?: boolean }) => string;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type Tip = { x: number; y: number; title: string; rows: { label?: string; value: string; key?: 'ink' | 'muted' }[] };

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.max(70, Math.min(width - 70, tip.x));
  return (
    <div className="chart-tip" style={{ left, top: tip.y }} role="status">
      {tip.rows.map((r, i) => (
        <div key={i} className="chart-tip-row">
          {r.key && <i className={`tip-key ${r.key}`} />}
          <strong>{r.value}</strong>
          {r.label && <span>{r.label}</span>}
        </div>
      ))}
      <div className="chart-tip-title">{tip.title}</div>
    </div>
  );
}

export function bucketLabels(kind: PeriodKind, key: string) {
  if (kind === 'year') {
    const iso = `${key}-01`;
    return { short: fmtDate(iso, { month: 'narrow' }), full: fmtDate(iso, { month: 'long', year: 'numeric' }) };
  }
  return {
    short: kind === 'week' ? fmtDate(key, { weekday: 'narrow' }) : String(Number(key.slice(8))),
    full: fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short' }),
  };
}

const tickEvery = (n: number) => (n > 20 ? 7 : 1);

/* ---------------- daily / monthly bars ---------------- */

export function BucketBars({ buckets, kind, money }: { buckets: Bucket[]; kind: PeriodKind; money: Money }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const n = buckets.length;
  const H = 150;
  const top = 22;
  const base = H - 24;
  const gap = n > 20 ? 2 : n > 7 ? 5 : 8;
  const bw = W ? (W - gap * (n - 1)) / n : 0;
  const max = Math.max(...buckets.map((b) => b.total), 1);
  const past = buckets.filter((b) => !b.future);
  const avg = past.length ? past.reduce((a, b) => a + b.total, 0) / past.length : 0;
  const y = (v: number) => base - (v / max) * (base - top);
  const r = Math.min(3, bw / 2);
  const indexAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - rect.left) / rect.width) * n)));
  };
  const s = sel === null ? null : buckets[sel];
  const labels = s ? bucketLabels(kind, s.key) : null;

  return (
    <div
      ref={ref}
      className="chart"
      tabIndex={0}
      aria-label={`${kind === 'year' ? 'Monthly' : 'Daily'} spending chart. Use arrow keys to read values.`}
      onPointerMove={(e) => setSel(indexAt(e.clientX))}
      onPointerDown={(e) => setSel(indexAt(e.clientX))}
      onPointerLeave={() => setSel(null)}
      onBlur={() => setSel(null)}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const cur = sel ?? Math.max(0, buckets.findIndex((b) => b.current));
        setSel(Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
      }}
    >
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className={sel !== null ? 'hovering' : ''}>
          <line className="axis" x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} />
          {avg > 0 && <line className="avg" x1={0} x2={W} y1={y(avg)} y2={y(avg)} />}
          {buckets.map((b, i) => {
            const x = i * (bw + gap);
            if (b.total > 0) {
              const h = Math.max(base - y(b.total), 3);
              return (
                <path
                  key={b.key}
                  className={`bar${b.current ? ' now' : ''}${sel === i ? ' hl' : ''}`}
                  d={`M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                />
              );
            }
            return b.future ? null : <rect key={b.key} className="stub" x={x} y={base - 2} width={bw} height={2} rx={1} />;
          })}
          {buckets.map((b, i) =>
            i % tickEvery(n) === 0 || n <= 12 ? (
              <text key={b.key} className={`tick${b.current ? ' now' : ''}`} x={i * (bw + gap) + bw / 2} y={H - 6} textAnchor="middle">
                {bucketLabels(kind, b.key).short}
              </text>
            ) : null,
          )}
          {avg > 0 && (
            <text className="avg-label" x={0} y={y(avg) - 6}>
              avg {money(avg, { whole: true })}
            </text>
          )}
        </svg>
      )}
      <Tooltip
        width={W}
        tip={
          s && labels
            ? { x: sel! * (bw + gap) + bw / 2, y: s.total ? y(s.total) : base, title: labels.full, rows: [{ value: s.future ? '—' : money(s.total) }] }
            : null
        }
      />
      <table className="sr-only">
        <tbody>
          {past.map((b) => (
            <tr key={b.key}>
              <th>{bucketLabels(kind, b.key).full}</th>
              <td>{money(b.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- cumulative pace vs previous period ---------------- */

export function PaceChart({
  current,
  previous,
  keys,
  kind,
  budget,
  projected,
  money,
  names,
}: {
  current: number[];
  previous: number[];
  keys: string[];
  kind: PeriodKind;
  budget: number | null;
  projected: number | null;
  money: Money;
  names: [string, string];
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const n = keys.length;
  const H = 190;
  const top = 18;
  const base = H - 24;
  const padX = 6;
  const prev = previous.slice(0, n);
  const max = Math.max(current.at(-1) ?? 0, prev.at(-1) ?? 0, budget ?? 0, projected ?? 0, 1) * 1.06;
  const x = (i: number) => padX + (n > 1 ? (i / (n - 1)) * (W - padX * 2) : 0);
  const y = (v: number) => base - (v / max) * (base - top);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = current.length - 1;
  const indexAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(((clientX - rect.left - padX) / (rect.width - padX * 2)) * (n - 1))));
  };

  const tip: Tip | null =
    sel === null
      ? null
      : {
          x: x(sel),
          y: Math.min(y(current[sel] ?? prev[sel] ?? 0), y(prev[sel] ?? 0)),
          title: kind === 'month' ? `By day ${sel + 1}` : `By ${bucketLabels(kind, keys[sel]).full.split(',')[0]}`,
          rows: [
            ...(sel <= last ? [{ label: names[0], value: money(current[sel], { whole: true }), key: 'ink' as const }] : []),
            ...(sel < prev.length ? [{ label: names[1], value: money(prev[sel], { whole: true }), key: 'muted' as const }] : []),
          ],
        };

  return (
    <div className="pace">
      <div className="legend">
        <span>
          <i className="tip-key ink" />
          {names[0]}
        </span>
        <span>
          <i className="tip-key muted" />
          {names[1]}
        </span>
        {projected !== null && (
          <span>
            <i className="tip-key dashed" />
            Pace
          </span>
        )}
      </div>
      <div
        ref={ref}
        className="chart"
        tabIndex={0}
        aria-label={`Running total: ${names[0]} ${money(current.at(-1) ?? 0)}; ${names[1]} ${money(prev[Math.min(last, prev.length - 1)] ?? 0)} at the same point.`}
        onPointerMove={(e) => setSel(indexAt(e.clientX))}
        onPointerDown={(e) => setSel(indexAt(e.clientX))}
        onPointerLeave={() => setSel(null)}
        onBlur={() => setSel(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setSel(Math.max(0, Math.min(n - 1, (sel ?? last) + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
      >
        {W > 0 && n > 1 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <line className="axis" x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} />
            {budget ? (
              <>
                <line className="budget-line" x1={0} x2={W} y1={y(budget)} y2={y(budget)} />
                <text className="avg-label" x={W} y={y(budget) - 6} textAnchor="end">
                  budget {money(budget, { whole: true })}
                </text>
              </>
            ) : null}
            {prev.length > 1 && <path className="line muted" d={line(prev)} />}
            {projected !== null && last >= 0 && last < n - 1 && (
              <path className="line dashed" d={`M${x(last)},${y(current[last])}L${x(n - 1)},${y(projected)}`} />
            )}
            {current.length > 0 && <path className="line ink" d={line(current)} />}
            {last >= 0 && <circle className="end-dot" cx={x(last)} cy={y(current[last])} r={4} />}
            {keys.map((k, i) =>
              i % tickEvery(n) === 0 || n <= 12 ? (
                <text key={k} className="tick" x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : 'middle'}>
                  {bucketLabels(kind, k).short}
                </text>
              ) : null,
            )}
            {sel !== null && (
              <>
                <line className="crosshair" x1={x(sel)} x2={x(sel)} y1={top - 6} y2={base} />
                {sel <= last && <circle className="hover-dot ink" cx={x(sel)} cy={y(current[sel])} r={4} />}
                {sel < prev.length && <circle className="hover-dot muted" cx={x(sel)} cy={y(prev[sel])} r={4} />}
              </>
            )}
          </svg>
        )}
        <Tooltip tip={tip} width={W} />
      </div>
    </div>
  );
}

/* ---------------- weekday rhythm ---------------- */

export function WeekdayBars({ weekdays, money }: { weekdays: { weekday: number; average: number }[]; money: Money }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const H = 120;
  const top = 20;
  const base = H - 24;
  const gap = 10;
  const bw = W ? (W - gap * 6) / 7 : 0;
  const max = Math.max(...weekdays.map((d) => d.average), 1);
  const peak = weekdays.reduce((a, b) => (b.average > a.average ? b : a)).weekday;
  const y = (v: number) => base - (v / max) * (base - top);
  const r = Math.min(4, bw / 2);
  const s = sel === null ? null : weekdays[sel];
  return (
    <div
      ref={ref}
      className="chart"
      tabIndex={0}
      aria-label="Average spend per weekday"
      onPointerLeave={() => setSel(null)}
      onBlur={() => setSel(null)}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        setSel(Math.max(0, Math.min(6, (sel ?? peak) + (e.key === 'ArrowRight' ? 1 : -1))));
      }}
    >
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className={sel !== null ? 'hovering' : ''}>
          <line className="axis" x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} />
          {weekdays.map((d, i) => {
            const x = i * (bw + gap);
            const h = Math.max(base - y(d.average), d.average > 0 ? 3 : 0);
            return (
              <g key={i} onPointerEnter={() => setSel(i)} onPointerDown={() => setSel(i)}>
                <rect className="hit" x={x - gap / 2} y={0} width={bw + gap} height={H} />
                {h > 0 ? (
                  <path
                    className={`bar${d.weekday === peak ? ' now' : ''}${sel === i ? ' hl' : ''}`}
                    d={`M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                  />
                ) : (
                  <rect className="stub" x={x} y={base - 2} width={bw} height={2} rx={1} />
                )}
                <text className={`tick${d.weekday === peak ? ' now' : ''}`} x={x + bw / 2} y={H - 6} textAnchor="middle">
                  {WEEKDAY_NAMES[d.weekday].slice(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip
        width={W}
        tip={s ? { x: sel! * (bw + gap) + bw / 2, y: y(s.average), title: `${WEEKDAY_NAMES[s.weekday]}s, on average`, rows: [{ value: money(s.average, { whole: true }) }] } : null}
      />
    </div>
  );
}
