import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getUser } from '@/lib/server/auth';

export const metadata = { title: 'Log in' };

export default async function LoginPage() {
  if (await getUser()) redirect('/');
  return (
    <main className="auth">
      <AuthForm mode="login" />
    </main>
  );
}
