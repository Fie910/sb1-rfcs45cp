// src/hooks/useGlobalHaptics.ts
import { useEffect } from 'react';
import { haptic, type HapticPattern } from '@/lib/haptics';

/**
 * Memasang haptic otomatis ke SEMUA elemen interaktif:
 *   - <button> (non-disabled)
 *   - <a href> (link internal maupun eksternal)
 *   - [role="button"]
 *   - .tactile
 *   - [data-haptic]
 *
 * Untuk override per elemen, cukup tambah atribut:
 *   <button data-haptic="success">Simpan</button>
 *
 * Panggil hook ini SEKALI di komponen root (AppLayout).
 */
export function useGlobalHaptics() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest<HTMLElement>(
        'button:not(:disabled), a[href], [role="button"], .tactile, [data-haptic]',
      );
      if (!interactive) return;

      const custom = interactive.dataset.haptic as HapticPattern | undefined;
      haptic(custom ?? 'light');
    };

    // pointerdown lebih awal dari click → terasa lebih responsif
    document.addEventListener('pointerdown', handlePointerDown, {
      passive: true,
    });
    return () =>
      document.removeEventListener('pointerdown', handlePointerDown);
  }, []);
}