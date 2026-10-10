// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { resetAuditCache, logActivity, AUDIT_MODUL } from '@/utils/audit';
import type { Guru, GuruRole } from '@/types/database';
import type { PageKey } from '@/config/navigation';
import {
  saveGuruCache,
  loadGuruCache,
  savePermissionsCache,
  loadPermissionsCache,
  saveRoleNameCache,
  loadRoleNameCache,
} from '@/lib/offline/profileCache';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  guru: Guru | null;
  role: GuruRole | null;
  namaRole: string;
  permissions: PageKey[];
  isAdmin: boolean;
  isGuruPiket: boolean;
  loading: boolean;
  hasAccess: (pageKey: PageKey) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    namaLengkap?: string,
    nip?: string
  ) => Promise<{ error: string | null; user: User | null }>;
  signOut: () => Promise<void>;
  refreshGuru: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [guru, setGuru] = useState<Guru | null>(null);
  const [namaRole, setNamaRole] = useState<string>('');
  const [permissions, setPermissions] = useState<PageKey[]>([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // FETCH GURU — dengan cache fallback untuk mode offline
  // ==========================================================================
  const fetchGuru = async (uid: string) => {
    let guruData: Guru | null = null;

    try {
      const { data, error } = await supabase
        .from('gurus')
        .select(`
          *,
          divisis:divisi_id (
            id,
            nama_divisi
          )
        `)
        .eq('id', uid)
        .maybeSingle();

      if (error) throw error;

      guruData = (data as Guru) ?? null;

      // Simpan ke cache kalau berhasil fetch dari server
      if (guruData) {
        saveGuruCache(guruData as any);
      }
    } catch (err) {
      // Network error / offline → fallback ke cache
      console.warn('[auth] fetchGuru gagal, coba cache offline:', err);
      const cached = loadGuruCache();
      if (cached && cached.id === uid) {
        guruData = cached as unknown as Guru;
        console.info('[auth] memakai profil guru dari cache offline');
      } else {
        console.warn('[auth] tidak ada cache untuk user ini');
      }
    }

    setGuru(guruData);

    // Nama role — coba server, fallback cache
    if (guruData?.role) {
      let resolvedNamaRole: string | null = null;

      if (navigator.onLine) {
        try {
          const { data: roleData } = await supabase
            .from('roles')
            .select('nama_role')
            .eq('kode_role', guruData.role)
            .maybeSingle();
          resolvedNamaRole = roleData?.nama_role ?? null;
          if (resolvedNamaRole) {
            saveRoleNameCache(guruData.role, resolvedNamaRole);
          }
        } catch {
          /* fallback ke cache di bawah */
        }
      }

      if (!resolvedNamaRole) {
        resolvedNamaRole = loadRoleNameCache(guruData.role);
      }

      setNamaRole(resolvedNamaRole ?? '');

      // Fetch permissions dengan fallback cache
      await fetchPermissions(guruData.role);
    } else {
      setNamaRole('');
      setPermissions([]);
    }
  };

  // ==========================================================================
  // FETCH PERMISSIONS — dengan cache fallback
  // ==========================================================================
  const fetchPermissions = async (userRole: GuruRole) => {
    if (userRole === 'admin') {
      // Admin selalu punya akses penuh — tidak perlu list page
      setPermissions([]);
      savePermissionsCache('admin', []);
      return;
    }

    let allowedPages: PageKey[] | null = null;

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          can_access,
          role_code,
          menus:menu_id (
            kode_menu
          )
        `)
        .eq('role_code', userRole)
        .eq('can_access', true);

      if (error) throw error;

      allowedPages = (data ?? [])
        .map((item: any) => {
          const menuData = item.menus;
          return Array.isArray(menuData) ? menuData[0]?.kode_menu : menuData?.kode_menu;
        })
        .filter(Boolean) as PageKey[];

      // Simpan cache
      savePermissionsCache(userRole, allowedPages as string[]);
    } catch (err) {
      // Offline / error → pakai cache
      console.warn('[auth] fetchPermissions gagal, coba cache offline:', err);
      const cached = loadPermissionsCache(userRole);
      if (cached) {
        allowedPages = cached as PageKey[];
        console.info('[auth] memakai permissions dari cache offline');
      } else {
        allowedPages = [];
      }
    }

    setPermissions(allowedPages ?? []);
  };

  // ==========================================================================
  // BOOTSTRAP SESSION
  // ==========================================================================
  useEffect(() => {
    // Coba restore dari cache dulu (agar UI langsung tampil kalau offline)
    const cachedGuru = loadGuruCache();

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Kalau ada cache & offline → pakai cache dulu biar cepat
          if (!navigator.onLine && cachedGuru && cachedGuru.id === session.user.id) {
            setGuru(cachedGuru as unknown as Guru);
            const cachedPages = loadPermissionsCache(cachedGuru.role);
            if (cachedPages) setPermissions(cachedPages as PageKey[]);
            const cachedRole = loadRoleNameCache(cachedGuru.role);
            if (cachedRole) setNamaRole(cachedRole);
            setLoading(false);
          }
          // Selalu coba fetch dari server (akan fallback ke cache kalau gagal)
          fetchGuru(session.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        // Kalau getSession error sama sekali (jarang), coba cache
        if (cachedGuru) {
          setGuru(cachedGuru as unknown as Guru);
          const cachedPages = loadPermissionsCache(cachedGuru.role);
          if (cachedPages) setPermissions(cachedPages as PageKey[]);
        }
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchGuru(session.user.id);
      } else {
        setGuru(null);
        setNamaRole('');
        setPermissions([]);
        // Clear guru cache karena user sudah logout
        saveGuruCache(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // AUTH ACTIONS
  // ==========================================================================
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (
    email: string,
    password: string,
    namaLengkap?: string,
    nip?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nama_lengkap: namaLengkap,
          nip: nip,
          role: 'guru',
        },
      },
    });

    if (error) return { error: error.message, user: null };
    return { error: null, user: data.user };
  };

  const signOut = async () => {
    // Log LOGOUT sebelum session dihapus (fire-and-forget)
    logActivity({
      aksi: 'LOGOUT',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Logout dari aplikasi',
    });

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('Sesi server tidak aktif, logout lokal:', error);
    } finally {
      resetAuditCache();
      setSession(null);
      setUser(null);
      setGuru(null);
      setNamaRole('');
      setPermissions([]);

      // Clear cache profil & permissions, tapi JANGAN clear seluruh localStorage
      // (agar offline queue di IndexedDB tidak tergerus & setting lain tetap)
      saveGuruCache(null);
      try {
        localStorage.removeItem('smk_offline_permissions_v1');
        localStorage.removeItem('smk_offline_role_name_v1');
      } catch {
        /* ignore */
      }
    }
  };

  const refreshGuru = async () => {
    if (user) await fetchGuru(user.id);
  };

  const refreshPermissions = async () => {
    if (guru?.role) await fetchPermissions(guru.role);
  };

  const hasAccess = (pageKey: PageKey): boolean => {
    if (guru?.role === 'admin') return true;
    if (pageKey === 'dashboard' || pageKey === 'profil') return true;
    return permissions.includes(pageKey);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        guru,
        role: guru?.role ?? null,
        namaRole,
        permissions,
        isAdmin: guru?.role === 'admin',
        isGuruPiket: guru?.role === 'guru_piket',
        loading,
        hasAccess,
        signIn,
        signUp,
        signOut,
        refreshGuru,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}