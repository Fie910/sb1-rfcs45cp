// src/hooks/useBottomNavTabs.ts
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'mobile-bottom-nav-paths';

/** Tab default saat user baru pertama kali pakai aplikasi */
export const DEFAULT_TAB_PATHS = [
  '/',
  '/agenda',
  '/presensi',
  '/todo',
  '/profil',
];

/** Batas maksimal tab yang bisa dipasang (agar tidak sesak) */
export const MAX_TABS = 5;

/**
 * Hook untuk menyimpan preferensi tab bottom-nav per user (per perangkat).
 * Data disimpan di localStorage, jadi tidak hilang saat logout.
 */
export function useBottomNavTabs() {
  const [paths, setPathsState] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_TAB_PATHS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_TAB_PATHS;
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.every((p) => typeof p === 'string') &&
        parsed.length > 0
      ) {
        return parsed.slice(0, MAX_TABS);
      }
    } catch {
      // localStorage corrupt — abaikan dan pakai default
    }
    return DEFAULT_TAB_PATHS;
  });

  const setPaths = useCallback((next: string[]) => {
    const safe = next.slice(0, MAX_TABS);
    setPathsState(safe);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      // localStorage penuh / diblokir — tetap jalan di memori
    }
  }, []);

  const reset = useCallback(() => {
    setPathsState(DEFAULT_TAB_PATHS);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // abaikan
    }
  }, []);

  return { paths, setPaths, reset };
}