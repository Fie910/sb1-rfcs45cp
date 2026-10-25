// src/hooks/useSchoolBranding.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type SchoolBranding = {
  nama_sekolah: string;
  logo_url: string | null;
};

const CACHE_KEY = 'smk_school_branding_v1';
let memoryCache: SchoolBranding | null = null;

const DEFAULT: SchoolBranding = {
  nama_sekolah: '',
  logo_url: null,
};

export function useSchoolBranding() {
  const [branding, setBranding] = useState<SchoolBranding>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as SchoolBranding;
          return { ...DEFAULT, ...parsed };
        }
      } catch { /* ignore */ }
    }
    return DEFAULT;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memoryCache) {
      setBranding(memoryCache);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // ✅ Pakai RPC yang aman untuk anon
        const { data, error } = await supabase.rpc('get_school_branding');

        if (error) {
          console.warn('[useSchoolBranding] RPC error:', error.message);
        }

        // RPC return array, ambil row pertama
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (row) {
          const rawLogo = (row.logo_url ?? '').trim();
          const logo = rawLogo.length > 0 ? rawLogo : null;

          const b: SchoolBranding = {
            nama_sekolah: (row.nama_sekolah ?? '').trim(),
            logo_url: logo,
          };

          console.log('[useSchoolBranding] Fetched:', b);

          memoryCache = b;
          setBranding(b);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(b));
          } catch { /* ignore quota */ }
        } else {
          console.warn('[useSchoolBranding] RPC return 0 row');
        }
      } catch (err) {
        console.warn('[useSchoolBranding] Gagal fetch:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { ...branding, loading };
}

/** Panggil setelah update logo di halaman Pengaturan Sekolah */
export function invalidateSchoolBrandingCache() {
  memoryCache = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}