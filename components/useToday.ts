'use client';

import { useEffect, useState } from 'react';
import { localToday } from '@/lib/dates';

/** The device's local date, refreshed when the app comes back to the foreground (e.g. after midnight). */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setToday(localToday());
    update();
    const onVisible = () => document.visibilityState === 'visible' && update();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return today;
}
