'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mutate, SWRConfig } from 'swr';
import { localToday } from '@/lib/dates';
import { api, ApiError, fetcher, isNetworkError } from '@/lib/client/api';
import { money } from '@/lib/client/format';
import { categoryName } from '@/lib/categories';
import type { Spend } from '@/lib/insights';
import { Dock } from './Dock';
import { EditSheet } from './EditSheet';
import { Sheet } from './Sheet';
import { useSpeech } from './useSpeech';

export type Me = { username: string; currency: string; monthlyBudget: number };

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };

type Shell = {
  me: Me;
  setMe: (patch: Partial<Me>) => void;
  money: (n: number, opts?: { whole?: boolean }) => string;
  addFromText: (text: string, source: 'voice' | 'text') => Promise<void>;
  openType: (prefill?: string) => void;
  openEdit: (spend: Spend) => void;
  toast: (text: string, action?: Toast['action']) => void;
  refresh: () => Promise<unknown>;
};

const ShellContext = createContext<Shell | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell outside AppShell');
  return ctx;
}

const PENDING_KEY = 'spend.pending.v2';
type Pending = { text: string; today: string; source: 'voice' | 'text' };

function readPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}
function writePending(items: Pending[]) {
  try {
    if (items.length) localStorage.setItem(PENDING_KEY, JSON.stringify(items));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked */
  }
}

export function AppShell({ initialMe, children }: { initialMe: Me; children: React.ReactNode }) {
  const [me, setMeState] = useState(initialMe);
  const [toastState, setToast] = useState<Toast | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [editing, setEditing] = useState<Spend | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((text: string, action?: Toast['action']) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 4000);
  }, []);

  const refresh = useCallback(() => mutate((key) => typeof key === 'string' && key.startsWith('/api/')), []);
  const fmt = useCallback((n: number, opts?: { whole?: boolean }) => money(n, me.currency, opts), [me.currency]);

  const openType = useCallback((prefill = '') => {
    setTypeText(prefill);
    setTypeOpen(true);
  }, []);

  const addFromText = useCallback(
    async (text: string, source: 'voice' | 'text') => {
      const today = localToday();
      setBusy(true);
      try {
        const { created } = await api.post<{ created: Spend[] }>('/api/spends', { text, today, source });
        await refresh();
        const first = created[0];
        const msg =
          created.length === 1
            ? `${fmt(first.amount)} · ${first.title} · ${categoryName(first.category)}`
            : `Added ${created.length} spends · ${fmt(created.reduce((a, s) => a + s.amount, 0))}`;
        toast(msg, {
          label: 'Undo',
          run: async () => {
            await api.del('/api/spends', { ids: created.map((s) => s.id) });
            await refresh();
          },
        });
      } catch (e) {
        if (isNetworkError(e)) {
          writePending([...readPending(), { text, today, source }]);
          toast('You’re offline. Saved it, and it will be added when you’re back.');
        } else if (e instanceof ApiError && e.code === 'no_amount') {
          toast(e.message, { label: 'Edit', run: () => openType(text) });
        } else {
          toast(e instanceof ApiError ? e.message : 'Couldn’t add that. Try again.');
        }
      } finally {
        setBusy(false);
      }
    },
    [fmt, openType, refresh, toast],
  );

  // keeps the session sliding while the app is in use, and picks up settings changed on another device
  useEffect(() => {
    api
      .get<Me>('/api/me')
      .then(({ username, currency, monthlyBudget }) => setMeState({ username, currency, monthlyBudget }))
      .catch(() => {});
  }, []);

  // flush anything captured while offline
  useEffect(() => {
    async function flush() {
      const queue = readPending();
      if (!queue.length || !navigator.onLine) return;
      const left: Pending[] = [];
      let added = 0;
      for (const p of queue) {
        try {
          await api.post('/api/spends', { text: p.text, source: p.source, today: localToday() === p.today ? p.today : localToday() });
          added += 1;
        } catch (e) {
          if (isNetworkError(e)) left.push(p);
        }
      }
      writePending(left);
      if (added) {
        await refresh();
        toast(`Synced ${added} spend${added === 1 ? '' : 's'} saved offline.`);
      }
    }
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [refresh, toast]);

  const speech = useSpeech({
    onFinal: (text) => addFromText(text, 'voice'),
    onError: (message) => toast(message, { label: 'Type', run: () => openType() }),
  });

  const onMic = useCallback(() => {
    if (speech.listening) return speech.stop();
    if (!speech.supported) {
      openType();
      toast('Voice isn’t supported in this browser. Type it instead.');
      return;
    }
    speech.start();
  }, [openType, speech, toast]);

  // home-screen shortcut: /?add=voice
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === 'voice') {
      window.history.replaceState(null, '', window.location.pathname);
      onMic();
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Shell>(
    () => ({
      me,
      setMe: (patch) => setMeState((m) => ({ ...m, ...patch })),
      money: fmt,
      addFromText,
      openType,
      openEdit: setEditing,
      toast,
      refresh,
    }),
    [me, fmt, addFromText, openType, toast, refresh],
  );

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, keepPreviousData: true, dedupingInterval: 4000 }}>
      <ShellContext.Provider value={value}>
        <div className={`shell${speech.listening ? ' is-listening' : ''}${busy ? ' is-busy' : ''}`}>{children}</div>

        {speech.listening && (
          <div className="live" role="status">
            <p className="live-label">Listening</p>
            <p className={`live-text${speech.transcript ? '' : ' placeholder'}`}>
              {speech.transcript || 'Try “350 on dinner at Social and 120 for an auto”'}
            </p>
          </div>
        )}

        {toastState && (
          <div className="toast" role="status" key={toastState.id}>
            <span className="toast-text">{toastState.text}</span>
            {toastState.action && (
              <button
                className="link"
                onClick={() => {
                  setToast(null);
                  toastState.action?.run();
                }}
              >
                {toastState.action.label}
              </button>
            )}
          </div>
        )}

        <Dock listening={speech.listening} busy={busy} onMic={onMic} onType={() => openType()} />

        <Sheet open={typeOpen} onClose={() => setTypeOpen(false)} label="Type a spend" initialFocus="first">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = typeText.trim();
              setTypeOpen(false);
              if (text) addFromText(text, 'text');
            }}
          >
            <h3 className="sheet-title">What did you spend?</h3>
            <input
              autoFocus
              value={typeText}
              maxLength={300}
              enterKeyHint="done"
              autoComplete="off"
              placeholder="e.g. 250 on lunch at Subway"
              onChange={(e) => setTypeText(e.target.value)}
            />
            <p className="hint">Add a few at once: “90 for coffee and 400 on a cab yesterday”.</p>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setTypeOpen(false)}>
                Cancel
              </button>
              <button className="btn solid" disabled={!typeText.trim()}>
                Add
              </button>
            </div>
          </form>
        </Sheet>

        <EditSheet spend={editing} onClose={() => setEditing(null)} />
      </ShellContext.Provider>
    </SWRConfig>
  );
}
