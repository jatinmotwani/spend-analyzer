'use client';

import { useEffect, useState } from 'react';
import { CATEGORY_IDS, CATEGORY_NAMES, type CategoryId } from '@/lib/categories';
import { localToday } from '@/lib/dates';
import { api, ApiError } from '@/lib/client/api';
import { currencySymbol } from '@/lib/client/format';
import type { Spend } from '@/lib/insights';
import { useShell } from './AppShell';
import { Sheet } from './Sheet';

export function EditSheet({ spend, onClose }: { spend: Spend | null; onClose: () => void }) {
  const { me, refresh, toast } = useShell();
  const [form, setForm] = useState({ amount: '', title: '', note: '', date: '', category: 'other' as CategoryId });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (spend) {
      setForm({ amount: String(spend.amount), title: spend.title, note: spend.note, date: spend.date, category: spend.category });
      setError('');
    }
  }, [spend]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!spend) return;
    const amount = Number.parseFloat(form.amount);
    if (!(amount > 0)) return setError('Enter an amount above zero.');
    if (!form.title.trim()) return setError('Add where or what it was.');
    setSaving(true);
    try {
      await api.patch(`/api/spends/${spend.id}`, {
        amount,
        title: form.title,
        note: form.note,
        date: form.date,
        category: form.category,
      });
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t save. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!spend) return;
    const s = spend;
    onClose();
    try {
      await api.del(`/api/spends/${s.id}`);
      await refresh();
      toast(`Deleted ${s.title}`, {
        label: 'Undo',
        run: async () => {
          await api.post('/api/spends', {
            today: localToday(),
            source: 'manual',
            items: [{ amount: s.amount, title: s.title, note: s.note, category: s.category, date: s.date, heard: s.heard }],
          });
          await refresh();
        },
      });
    } catch {
      toast('Couldn’t delete that. Try again.');
    }
  }

  return (
    <Sheet open={Boolean(spend)} onClose={onClose} label="Edit spend">
      <form onSubmit={save} noValidate>
        <label className="amount-field">
          <span>{currencySymbol(me.currency)}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            aria-label="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </label>
        <div className="fields">
          <div className="field">
            <label htmlFor="edit-title">Where or what</label>
            <input id="edit-title" maxLength={60} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="edit-note">Note</label>
              <input id="edit-note" maxLength={120} placeholder="optional" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="edit-date">Date</label>
              <input id="edit-date" type="date" max={localToday()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
        </div>
        <fieldset className="chips">
          <legend>Category</legend>
          {CATEGORY_IDS.map((id) => (
            <label className="chip" key={id}>
              <input type="radio" name="category" value={id} checked={form.category === id} onChange={() => setForm({ ...form, category: id })} />
              <span>
                <i className="dot" style={{ '--c': `var(--cat-${id})` } as React.CSSProperties} />
                {CATEGORY_NAMES[id]}
              </span>
            </label>
          ))}
        </fieldset>
        {spend?.heard ? <p className="heard">Heard: “{spend.heard}”</p> : null}
        <p className="hint">Change the category once and similar spends will follow it next time.</p>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="row-actions">
          <button type="button" className="btn ghost danger" onClick={remove}>
            Delete
          </button>
          <button className="btn solid" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
