// src/hooks/useLazyTabs.ts
// Helper prefetch tab lazy saat browser idle.

import { useEffect, useRef } from 'react';

export function usePrefetchTabs(
  importers: Record<string, () => Promise<any>>,
  activeTab: string
) {
  const prefetched = useRef<Set<string>>(new Set());

  useEffect(() => {
    const run = () => {
      Object.entries(importers).forEach(([key, importer]) => {
        if (key === activeTab) return;
        if (prefetched.current.has(key)) return;
        prefetched.current.add(key);
        importer().catch(() => prefetched.current.delete(key));
      });
    };

    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(run, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const id = setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, [activeTab, importers]);
}