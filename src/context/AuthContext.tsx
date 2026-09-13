import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Guru, GuruRole } from '@/types/database';
import type { PageKey } from '@/config/navigation';

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

  // Fetch profil guru beserta relasi data divisi dari divisi_id
  const fetchGuru = async (uid: string) => {
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

    if (error) {
      console.error('Gagal mengambil data profil guru:', error);
    }

    const guruData = data as Guru | null;
    setGuru(guruData);

    if (guruData?.role) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('nama_role')
        .eq('kode_role', guruData.role)
        .maybeSingle();

      setNamaRole(roleData?.nama_role ?? '');
      await fetchPermissions(guruData.role);
    } else {
      setNamaRole('');
    }
  };

  const fetchPermissions = async (userRole: GuruRole) => {
    if (userRole === 'admin') {
      setPermissions([]);
      return;
    }

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

    if (error || !data) {
      console.error('Gagal mengambil hak akses:', error);
      setPermissions([]);
      return;
    }

    const allowedPages = data
      .map((item: any) => {
        const menuData = item.menus;
        return Array.isArray(menuData) ? menuData[0]?.kode_menu : menuData?.kode_menu;
      })
      .filter(Boolean) as PageKey[];

    setPermissions(allowedPages);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchGuru(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
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
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

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
          role: 'guru'
        }
      }
    });

    if (error) return { error: error.message, user: null };
    return { error: null, user: data.user };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('Sesi server tidak aktif, logout lokal:', error);
    } finally {
      setSession(null);
      setUser(null);
      setGuru(null);
      setNamaRole('');
      setPermissions([]);
      localStorage.clear();
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