// src/lib/offline/profileCache.ts
// Cache profil guru + permissions agar tetap terdeteksi saat offline.

const GURU_KEY = 'smk_offline_guru_v1';
const PERM_KEY = 'smk_offline_permissions_v1';
const ROLE_NAME_KEY = 'smk_offline_role_name_v1';
const ACCESS_PREFIX = 'smk_offline_can_access_v1_';

// ============================================================================
// GURU PROFILE CACHE
// ============================================================================
export interface CachedGuru {
  id: string;
  nama_lengkap: string;
  email: string;
  role: string;
  role2?: string | null;
  role3?: string | null;
  divisi_id?: string | null;
  nip?: string | null;
  jenis_ptk?: string | null;
  [k: string]: any;
}

export function saveGuruCache(g: CachedGuru | null) {
  try {
    if (!g) localStorage.removeItem(GURU_KEY);
    else localStorage.setItem(GURU_KEY, JSON.stringify(g));
  } catch {
    /* ignore quota errors */
  }
}

export function loadGuruCache(): CachedGuru | null {
  try {
    const raw = localStorage.getItem(GURU_KEY);
    return raw ? (JSON.parse(raw) as CachedGuru) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// PERMISSIONS CACHE (daftar PageKey yang boleh diakses per role)
// ============================================================================
export interface CachedPermissions {
  role: string;
  pages: string[];
  updatedAt: number;
}

export function savePermissionsCache(role: string, pages: string[]) {
  try {
    const payload: CachedPermissions = {
      role,
      pages,
      updatedAt: Date.now(),
    };
    localStorage.setItem(PERM_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadPermissionsCache(role: string): string[] | null {
  try {
    const raw = localStorage.getItem(PERM_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedPermissions;
    return p.role === role ? p.pages : null;
  } catch {
    return null;
  }
}

// ============================================================================
// ROLE NAME CACHE (nama_role dari tabel roles)
// ============================================================================
export function saveRoleNameCache(role: string, namaRole: string) {
  try {
    const raw = localStorage.getItem(ROLE_NAME_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[role] = namaRole;
    localStorage.setItem(ROLE_NAME_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadRoleNameCache(role: string): string | null {
  try {
    const raw = localStorage.getItem(ROLE_NAME_KEY);
    if (!raw) return null;
    const map: Record<string, string> = JSON.parse(raw);
    return map[role] ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// PER-MENU ACCESS CACHE (untuk useCanAccess)
// ============================================================================
function accessKey(role: string, kodeMenu: string): string {
  return `${ACCESS_PREFIX}${role}__${kodeMenu}`;
}

export function saveCanAccessCache(role: string, kodeMenu: string, canAccess: boolean) {
  try {
    localStorage.setItem(accessKey(role, kodeMenu), canAccess ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadCanAccessCache(role: string, kodeMenu: string): boolean | null {
  try {
    const raw = localStorage.getItem(accessKey(role, kodeMenu));
    if (raw === null) return null;
    return raw === '1';
  } catch {
    return null;
  }
}