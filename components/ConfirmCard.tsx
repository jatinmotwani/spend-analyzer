'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORY_IDS, CATEGORY_NAMES } from '@/lib/categories';
import { localToday } from '@/lib/dates';
import type { Draft } from '@/lib/drafts';
import { currencySymbol, dayLabel } from '@/lib/client/format';

export const AUTO_SAVE_MS = 4000;

export type Pending = { heard: string; source: 'voice' | 'text'; drafts: Draft[] };

/**
 * What we understood, shown before saving. Left alone it saves itself after a few
 * seconds; touching anything pauses the timer so the user can fix the guess.
 */
export function ConfirmCard({
  pending,
  currency,
  saving,
  onSave,
  onDiscard,
}: {
  pending: Pending;
  currency: string;
  saving: boolean;
  onSave: (drafts: Draft[]) => void;
  onDiscard: () => void;
}) {
  const [drafts, setDrafts] = useState(pending.drafts);
  const [held, setHeld] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState('');
  const today = localToday();
  const symbol = currencySymbol(currency);
  const latest = useRef({ drafts, onSave });
  latest.current = { drafts, onSave };

  // auto-save once, unless the user has started fiddling
  useEffect(() => {
    if (held) return;
    const t = setTimeout(() => {
      setHeld(true); // a failed auto-save leaves the card waiting for a manual Save
      latest.current.onSave(latest.current.drafts);
    }, AUTO_SAVE_MS);
    return () => clearTimeout(t);
  }, [held]);

  const hold = () => setHeld(true);
  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  function save() {
    if (drafts.some((d) => !(d.amount > 0))) return setError('Every spend needs an amount above zero.');
    if (drafts.some((d) => !d.title.trim())) return setError('Every spend needs a name.');
    onSave(drafts);
  }

  return (
    <div
      className={`confirm${held ? ' held' : ''}`}
      role="dialog"
      aria-label="Check before saving"
      onPointerDown={hold}
      onFocusCapture={hold}
      onKeyDown={(e) => {
        hold();
        if (e.key === 'Escape') onDiscard();
      }}
    >
      {!held && <span className="confirm-timer" style={{ animationDuration: `${AUTO_SAVE_MS}ms` }} aria-hidden="true" />}
      <p className="confirm-heard">“{pending.heard}”</p>

      <ul className="drafts">
        {drafts.map((d, i) => (
          <li key={i} className="draft">
            <div className="draft-main">
              <label className="draft-amount">
                <span>{symbol}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  aria-label="Amount"
                  value={Number.isFinite(d.amount) ? d.amount : ''}
                  onChange={(e) => update(i, { amount: Number.parseFloat(e.target.value) })}
                />
              </label>
              <input
                className="draft-title"
                aria-label="Where or what"
                maxLength={60}
                value={d.title}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              {drafts.length > 1 && (
                <button className="draft-remove" aria-label={`Remove ${d.title}`} onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}>
                  ×
                </button>
              )}
            </div>
            <div className="draft-meta">
              <button
                className={`draft-chip${picking === i ? ' on' : ''}`}
                aria-expanded={picking === i}
                onClick={() => setPicking(picking === i ? null : i)}
              >
                <i className="dot" style={{ '--c': `var(--cat-${d.category})` } as React.CSSProperties} />
                {CATEGORY_NAMES[d.category]}
                {d.learned && <span className="draft-learned" title="From your past corrections">✓</span>}
              </button>
              <label className="draft-chip date">
                {dayLabel(d.date, today)}
                <input type="date" max={today} value={d.date} aria-label="Date" onChange={(e) => e.target.value && update(i, { date: e.target.value })} />
              </label>
            </div>
            {picking === i && (
              <div className="cat-picker" role="group" aria-label="Category">
                {CATEGORY_IDS.map((id) => (
                  <button
                    key={id}
                    className={`chip-btn${d.category === id ? ' on' : ''}`}
                    onClick={() => {
                      update(i, { category: id, learned: false });
                      setPicking(null);
                    }}
                  >
                    <i className="dot" style={{ '--c': `var(--cat-${id})` } as React.CSSProperties} />
                    {CATEGORY_NAMES[id]}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-actions">
        <button className="btn ghost" onClick={onDiscard}>
          Discard
        </button>
        <button className="btn solid" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
