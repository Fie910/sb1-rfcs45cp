//src/lib/offline/profileCache.ts

const GURU_KEY = 'smk_offline_guru_v1';
const PERM_KEY = 'smk_offline_permissions_v1';

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
  } catch {}
}
export function loadGuruCache(): CachedGuru | null {
  try {
    const raw = localStorage.getItem(GURU_KEY);
    return raw ? (JSON.parse(raw) as CachedGuru) : null;
  } catch { return null; }
}

export interface CachedPermissions {
  role: string;
  allowedPaths: string[];  // daftar path yang boleh diakses
  badgeCounts?: Record<string, number>;
  updatedAt: number;
}

export function savePermissionsCache(p: CachedPermissions) {
  try {
    localStorage.setItem(PERM_KEY, JSON.stringify(p));
  } catch {}
}
export function loadPermissionsCache(role: string): CachedPermissions | null {
  try {
    const raw = localStorage.getItem(PERM_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedPermissions;
    return p.role === role ? p : null;
  } catch { return null; }
}