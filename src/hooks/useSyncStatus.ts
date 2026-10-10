//src/hooks/useSyncStatus.ts

import { useEffect, useState } from 'react';
import { getPendingCount, subscribeSync, flushQueue } from '../lib/offline/syncQueue';

export function useSyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const c = await getPendingCount();
      if (mounted) setPending(c);
    };
    refresh();
    const unsub = subscribeSync(refresh);

    const onOnline = async () => {
      setOnline(true);
      setFlushing(true);
      try { await flushQueue(); } finally { setFlushing(false); refresh(); }
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const iv = setInterval(refresh, 3000);
    return () => {
      mounted = false;
      unsub();
      clearInterval(iv);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { online, pending, flushing };
}