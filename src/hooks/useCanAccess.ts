// src/hooks/useCanAccess.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  saveCanAccessCache,
  loadCanAccessCache,
} from '@/lib/offline/profileCache';

export function useCanAccess(kodeMenu: string) {
  const { role } = useAuth();
  const [canAccess, setCanAccess] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkPermission() {
      // Belum ada role → tolak akses
      if (!role) {
        setCanAccess(false);
        return;
      }

      // Admin selalu punya akses penuh
      if (role === 'admin') {
        setCanAccess(true);
        return;
      }

      // Coba network dulu
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('role_permissions')
            .select('can_access, menus!inner(kode_menu)')
            .eq('role_code', role)
            .eq('menus.kode_menu', kodeMenu)
            .maybeSingle();

          if (!error && data) {
            const allowed = data.can_access === true;
            setCanAccess(allowed);
            // Cache hasilnya untuk offline
            saveCanAccessCache(role, kodeMenu, allowed);
            return;
          }
          // Kalau error atau data null — coba cache
        } catch (err) {
          console.warn('[useCanAccess] fetch gagal, coba cache:', err);
        }
      }

      // Fallback: cache
      const cached = loadCanAccessCache(role, kodeMenu);
      if (cached !== null) {
        setCanAccess(cached);
        return;
      }

      // Tidak ada cache & tidak bisa fetch → tolak
      setCanAccess(false);
    }

    checkPermission();
  }, [role, kodeMenu]);

  return canAccess;
}