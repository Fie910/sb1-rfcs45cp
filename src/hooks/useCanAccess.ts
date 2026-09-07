// hooks/useCanAccess.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function useCanAccess(kodeMenu: string) {
  const { role } = useAuth(); // Mengambil role user yang sedang login
  const [canAccess, setCanAccess] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkPermission() {
      // Jika belum ada session/role, tolak akses
      if (!role) {
        setCanAccess(false);
        return;
      }

      // Role 'admin' selalu diberikan akses penuh secara otomatis
      if (role === 'admin') {
        setCanAccess(true);
        return;
      }

      try {
        // Query ke tabel role_permissions menggunakan kolom role_code
        const { data, error } = await supabase
          .from('role_permissions')
          .select('can_access, menus!inner(kode_menu)')
          .eq('role_code', role)
          .eq('menus.kode_menu', kodeMenu)
          .maybeSingle(); // maybeSingle() tidak melempar error jika data belum diisi admin

        if (error || !data) {
          setCanAccess(false);
        } else {
          setCanAccess(data.can_access);
        }
      } catch (err) {
        console.error('Gagal memeriksa hak akses:', err);
        setCanAccess(false);
      }
    }

    checkPermission();
  }, [role, kodeMenu]);

  return canAccess;
}