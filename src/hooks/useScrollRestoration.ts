// src/hooks/useScrollRestoration.ts
import { useLayoutEffect, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Menyimpan & mengembalikan posisi scroll — meniru perilaku browser native:
 *
 *   - Klik menu (PUSH)    → scroll ke atas (halaman baru)
 *   - Klik back browser   → kembali ke posisi scroll sebelumnya
 *   - Refresh             → scroll ke atas
 *
 * Panggil SEKALI di AppLayout.
 */
export function useScrollRestoration() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'
  const positions = useRef<Record<string, number>>({});

  // 1) Simpan posisi scroll tiap kali user scroll / pindah halaman
  useEffect(() => {
    const saveScroll = () => {
      positions.current[pathname] = window.scrollY;
    };

    window.addEventListener('scroll', saveScroll, { passive: true });
    saveScroll(); // simpan posisi awal

    return () => {
      saveScroll(); // simpan posisi terakhir sebelum pindah
      window.removeEventListener('scroll', saveScroll);
    };
  }, [pathname]);

  // 2) Restore saat pathname berubah
  useLayoutEffect(() => {
    if (navigationType === 'POP') {
      // Back / forward — kembalikan posisi
      const y = positions.current[pathname] ?? 0;
      // RAF agar layout sudah settle dulu
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      });
    } else {
      // Klik menu — selalu mulai dari atas
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname, navigationType]);
}