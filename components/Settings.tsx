'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CATEGORY_IDS, type CategoryId } from '@/lib/categories';
import { api, ApiError } from '@/lib/client/api';
import { currencySymbol } from '@/lib/client/format';
import { useShell } from './AppShell';
import { PinInput } from './PinInput';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'HKD', 'NZD', 'ZAR', 'BRL', 'MXN', 'IDR', 'MYR', 'PHP', 'THB', 'PKR', 'BDT', 'LKR', 'NPR', 'SAR', 'SEK', 'NOK', 'DKK'];
const LEGACY_KEY = 'spend.v1.spends';

type Legacy = { amount: number; title: string; note?: string; category: string; date: string; heard?: string };

function readLegacy(): Legacy[] {
  try {
    const items = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

export function Settings() {
  const router = useRouter();
  const { me, setMe, toast, refresh } = useShell();
  const [currency, setCurrency] = useState(me.currency);
  const [budget, setBudget] = useState(me.monthlyBudget ? String(me.monthlyBudget) : '');
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [pinOpen, setPinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [legacy, setLegacy] = useState<Legacy[]>([]);
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    setLegacy(readLegacy());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null;
  const dirty = currency !== me.currency || (Number(budget) || 0) !== me.monthlyBudget;

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    const monthlyBudget = Math.max(0, Number.parseFloat(budget) || 0);
    setSavingPrefs(true);
    try {
      await api.patch('/api/me', { currency, monthlyBudget });
      setMe({ currency, monthlyBudget });
      await refresh();
      toast('Saved.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t save.');
    } finally {
      setSavingPrefs(false);
    }
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError('');
    try {
      await api.post('/api/me/pin', { currentPin, newPin });
      setPinOpen(false);
      setCurrentPin('');
      setNewPin('');
      toast('PIN changed. Other devices were signed out.');
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : 'Couldn’t change your PIN.');
    }
  }

  async function logout(everywhere = false) {
    await api.post('/api/auth/logout', { everywhere }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError('');
    try {
      await api.del('/api/me', { pin: deletePin });
      router.replace('/signup');
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Couldn’t delete your account.');
    }
  }

  async function importLegacy() {
    const items = legacy
      .filter((s) => s && s.amount > 0 && typeof s.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date))
      .map((s) => ({
        amount: Math.round(s.amount * 100) / 100,
        title: s.title.slice(0, 60) || 'Spend',
        note: (s.note ?? '').slice(0, 120),
        category: (CATEGORY_IDS as readonly string[]).includes(s.category) ? (s.category as CategoryId) : 'other',
        date: s.date,
        heard: (s.heard ?? '').slice(0, 300),
      }));
    try {
      const { imported } = await api.post<{ imported: number }>('/api/spends/import', { items });
      localStorage.removeItem(LEGACY_KEY);
      setLegacy([]);
      await refresh();
      toast(`Imported ${imported} spends.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Import failed.');
    }
  }

  return (
    <main className="page narrow">
      <header className="topbar">
        <h1 className="page-title">You</h1>
      </header>

      <section className="profile">
        <span className="avatar" aria-hidden="true">
          {me.username[0]?.toUpperCase()}
        </span>
        <div>
          <p className="profile-name">{me.username}</p>
          <p className="muted">Your spends live in your own database. No AI, no ads, no trackers.</p>
        </div>
      </section>

      <form className="card settings-card" onSubmit={savePrefs}>
        <h2>Preferences</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
                <option key={c} value={c}>
                  {c}
                  {names ? ` · ${names.of(c)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="budget">Monthly budget</label>
            <div className="prefix-input">
              <span>{currencySymbol(currency)}</span>
              <input id="budget" type="number" inputMode="decimal" min={0} step={1} placeholder="No budget" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
          </div>
        </div>
        <p className="hint">A budget adds a pace line to your month and tells you what you can spend per day.</p>
        <button className="btn solid" disabled={!dirty || savingPrefs}>
          {savingPrefs ? 'Saving…' : 'Save'}
        </button>
      </form>

      <section className="card settings-card">
        <h2>Security</h2>
        {pinOpen ? (
          <form onSubmit={changePin} className="stack-form">
            <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} autoComplete="current-password" />
            <PinInput label="New PIN" value={newPin} onChange={setNewPin} autoComplete="new-password" />
            <p className="form-error" role="alert">
              {pinError}
            </p>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setPinOpen(false)}>
                Cancel
              </button>
              <button className="btn solid" disabled={currentPin.length !== 6 || newPin.length !== 6}>
                Change PIN
              </button>
            </div>
          </form>
        ) : (
          <div className="list-actions">
            <button className="row-btn" onClick={() => setPinOpen(true)}>
              Change PIN
            </button>
            <button className="row-btn" onClick={() => logout(false)}>
              Log out
            </button>
            <button className="row-btn" onClick={() => logout(true)}>
              Log out of every device
            </button>
          </div>
        )}
      </section>

      <section className="card settings-card">
        <h2>Your data</h2>
        <div className="list-actions">
          <a className="row-btn" href="/api/spends/export" download>
            Export everything as CSV
          </a>
          {legacy.length > 0 && (
            <button className="row-btn" onClick={importLegacy}>
              Import {legacy.length} spends saved on this device
            </button>
          )}
          {install && (
            <button
              className="row-btn"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              Install app on this device
            </button>
          )}
          {!deleteOpen && (
            <button className="row-btn danger" onClick={() => setDeleteOpen(true)}>
              Delete account
            </button>
          )}
        </div>
        {deleteOpen && (
          <form onSubmit={deleteAccount} className="stack-form danger-zone">
            <p>This permanently deletes your account and every spend. Enter your PIN to confirm.</p>
            <PinInput label="PIN" value={deletePin} onChange={setDeletePin} autoComplete="current-password" />
            <p className="form-error" role="alert">
              {deleteError}
            </p>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setDeleteOpen(false)}>
                Keep my account
              </button>
              <button className="btn danger-solid" disabled={deletePin.length !== 6}>
                Delete forever
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
