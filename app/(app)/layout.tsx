import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getUser } from '@/lib/server/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');
  const me = { username: user.username, currency: user.currency, monthlyBudget: user.monthlyBudget };
  return <AppShell initialMe={me}>{children}</AppShell>;
}
