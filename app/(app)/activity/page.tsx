import { Suspense } from 'react';
import { Activity } from '@/components/Activity';

export const metadata = { title: 'Activity' };

export default function ActivityPage() {
  return (
    <Suspense>
      <Activity />
    </Suspense>
  );
}
