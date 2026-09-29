import { Icon } from '@/components/Icon';

export const metadata = { title: 'Offline' };

export default function Offline() {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">
          <Icon name="mic" size={24} />
        </div>
        <h1 className="auth-title">You’re offline</h1>
        <p className="auth-sub">Spend needs a connection to load. It will pick up where you left off once you’re back.</p>
      </div>
    </main>
  );
}
