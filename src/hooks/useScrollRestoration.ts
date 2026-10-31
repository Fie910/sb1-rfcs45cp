// src/hooks/useScrollRestoration.ts
import { useLayoutEffect, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Simpan & pulihkan posisi scroll — meniru perilaku browser native:
 *
 *   - Klik menu (PUSH)   → selalu mulai dari atas
 *   - Klik back (POP)    → kembali ke posisi terakhir halaman itu
 *   - Refresh            → mulai dari atas
 *
 * Panggil SEKALI di AppLayout.
 */
export function useScrollRestoration() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef<Record<string, number>>({});

  // -------------------------------------------------------------------
  // 1) Simpan posisi tiap kali user scroll.
  //    TIDAK menyimpan saat effect setup — itu justru menimpa nilai
  //    yang benar dengan nilai halaman sebelumnya (bug lama).
  // -------------------------------------------------------------------
  useEffect(() => {
    const saveScroll = () => {
      positions.current[pathname] = window.scrollY;
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveScroll);
    };
  }, [pathname]);

  // -------------------------------------------------------------------
  // 2) Pulihkan posisi saat navigasi.
  //    Untuk POP: langsung set, lalu retry beberapa kali untuk menangani
  //    konten async yang belum selesai dimuat.
  // -------------------------------------------------------------------
  useLayoutEffect(() => {
    // Klik menu / replace → selalu mulai dari atas
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
      return;
    }

    const target = positions.current[pathname] ?? 0;
    let cancelled = false;

    const tryRestore = () => {
      if (cancelled) return;
      // Hanya paksa scroll kalau masih belum pas
      if (Math.abs(window.scrollY - target) > 2) {
        window.scrollTo(0, target);
      }
    };

    // Restore langsung + retry beberapa kali (untuk konten async)
    tryRestore();
    const timers = [
      window.setTimeout(tryRestore, 30),
      window.setTimeout(tryRestore, 100),
      window.setTimeout(tryRestore, 250),
      window.setTimeout(tryRestore, 500),
      window.setTimeout(tryRestore, 900),
    ];

    // Batalkan retry kalau user sudah mulai scroll sendiri
    const cancel = () => { cancelled = true; };
    window.addEventListener('wheel', cancel, { passive: true, once: true });
    window.addEventListener('touchmove', cancel, { passive: true, once: true });
    window.addEventListener('keydown', cancel, { once: true });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchmove', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, [pathname, navigationType]);
}