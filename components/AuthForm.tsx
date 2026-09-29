'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { PinInput } from './PinInput';
import { Icon } from './Icon';

const REGION_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', AE: 'AED', JP: 'JPY',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR',
};

function guessCurrency() {
  try {
    return REGION_CURRENCY[new Intl.Locale(navigator.language).maximize().region ?? ''] ?? 'INR';
  } catch {
    return 'INR';
  }
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const signup = mode === 'signup';
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length !== 6) return setError({ field: 'pin', message: 'Your PIN needs 6 digits.' });
    if (signup && pin !== confirm) return setError({ field: 'confirm', message: 'Those PINs don’t match.' });
    setBusy(true);
    try {
      if (signup) await api.post('/api/auth/signup', { username, pin, invite, currency: guessCurrency() });
      else await api.post('/api/auth/login', { username, pin });
      router.replace('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Can’t reach the server. Check your connection.';
      const field = err instanceof ApiError ? { invalid_username: 'username', taken: 'username', bad_invite: 'invite' }[err.code] : undefined;
      setError({ field: field ?? (err instanceof ApiError && err.code.includes('pin') ? 'pin' : undefined), message });
      if (!signup) setPin('');
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <div className="auth-mark" aria-hidden="true">
        <Icon name="mic" size={24} />
      </div>
      <h1 className="auth-title">{signup ? 'Make some room' : 'Welcome back'}</h1>
      <p className="auth-sub">
        {signup ? 'A calm place to notice where your money goes.' : 'Your spends are waiting where you left them.'}
      </p>

      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          required
          autoFocus
          value={username}
          aria-invalid={error?.field === 'username' || undefined}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. jatin"
        />
      </div>

      <PinInput
        label={signup ? 'Choose a 6-digit PIN' : 'PIN'}
        value={pin}
        onChange={setPin}
        name="pin"
        autoComplete={signup ? 'new-password' : 'current-password'}
        invalid={error?.field === 'pin'}
      />

      {signup && (
        <>
          <PinInput label="Repeat PIN" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={error?.field === 'confirm'} />
          <div className="field">
            <label htmlFor="invite">Invite code</label>
            <input
              id="invite"
              name="invite"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              value={invite}
              aria-invalid={error?.field === 'invite' || undefined}
              onChange={(e) => setInvite(e.target.value)}
            />
          </div>
        </>
      )}

      <p className="form-error" role="alert">
        {error?.message}
      </p>

      <button className="btn solid block" disabled={busy}>
        {busy ? (signup ? 'Creating…' : 'Unlocking…') : signup ? 'Create account' : 'Log in'}
      </button>

      <p className="auth-switch">
        {signup ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
