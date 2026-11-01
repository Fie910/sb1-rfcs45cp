// src/hooks/useGlobalHaptics.ts
import { useEffect } from 'react';
import { haptic, type HapticPattern } from '@/lib/haptics';

/**
 * Haptic SELEKTIF — hanya trigger pada aksi penting.
 *
 * Elemen yang trigger haptic:
 *   1. Ada atribut `data-haptic="pattern"` secara eksplisit
 *      Contoh: <button data-haptic="success">Simpan</button>
 *   2. Tombol submit form: <button type="submit">
 *      Otomatis haptic="light"
 *
 * Elemen yang TIDAK trigger (diabaikan):
 *   - Klik link navigasi (a[href])
 *   - Klik item sidebar
 *   - Klik bottom tab
 *   - Klik tombol biasa (button tanpa type submit dan tanpa data-haptic)
 *   - Toggle, filter, icon close, dll.
 *
 * Kalau user mematikan haptic via setting, fungsi ini tetap jalan
 * tapi `haptic()` sendiri akan no-op karena guard di lib/haptics.ts.
 */
export function useGlobalHaptics() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest<HTMLElement>(
        '[data-haptic], button[type="submit"]:not(:disabled)',
      );
      if (!interactive) return;

      const custom = interactive.dataset.haptic as HapticPattern | undefined;
      haptic(custom ?? 'light');
    };

    document.addEventListener('pointerdown', handlePointerDown, {
      passive: true,
    });
    return () =>
      document.removeEventListener('pointerdown', handlePointerDown);
  }, []);
}