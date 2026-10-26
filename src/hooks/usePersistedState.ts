// src/hooks/usePersistedState.ts
import { useState, useEffect } from 'react';

/**
 * useState yang otomatis tersimpan di localStorage.
 * Sangat berguna untuk filter halaman (tanggal, guru, dll).
 * 
 * @example
 * const [filterGuru, setFilterGuru] = usePersistedState('rekap_izin_filter_guru', '');
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.warn('[usePersistedState] Gagal baca cache:', key, e);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn('[usePersistedState] Gagal simpan:', key, e);
    }
  }, [key, state]);

  return [state, setState];
}