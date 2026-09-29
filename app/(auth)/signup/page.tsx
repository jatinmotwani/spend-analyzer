import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { Icon } from '@/components/Icon';
import { getUser } from '@/lib/server/auth';
import { env } from '@/lib/server/env';

export const metadata = { title: 'Sign up' };

export default async function SignupPage() {
  if (await getUser()) redirect('/');
  return (
    <main className="auth">
      {env.signupCode ? (
        <AuthForm mode="signup" />
      ) : (
        <div className="auth-card">
          <div className="auth-mark" aria-hidden="true">
            <Icon name="mic" size={24} />
          </div>
          <h1 className="auth-title">Signups are closed</h1>
          <p className="auth-sub">This is a private space. Ask the owner for an invite.</p>
          <p className="auth-switch">
            <Link href="/login">Back to log in</Link>
          </p>
        </div>
      )}
    </main>
  );
}
