// src/lib/audit.ts
// Helper untuk mencatat aktivitas user ke tabel audit_logs.
//
// Prinsip:
// - JANGAN pernah throw error → logging tidak boleh ganggu flow utama
// - Cache info user (nama + role) selama session biar hemat query
// - Fallback ke email kalau nama lengkap tidak ada
//
// Cara pakai:
//   await logActivity({
//     aksi: 'CREATE',
//     modul: AUDIT_MODUL.SURAT,
//     deskripsi: 'Menambah surat masuk No. 045/2026',
//     targetId: surat.id,
//   });

import { supabase } from '@/lib/supabase';

// =============================================================================
// TIPE
// =============================================================================

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'VIEW';

// Konstanta nama modul — pakai ini supaya konsisten (bukan string manual)
export const AUDIT_MODUL = {
  SURAT: 'surat',
  DISPOSISI: 'disposisi',
  IZIN: 'izin',
  TODO: 'todo',
  TODO_TEMPLATE: 'todo_template',
  BUKU_TAMU: 'buku_tamu',
  PENGUMUMAN: 'pengumuman',
  KEGIATAN: 'kegiatan',
  GURU: 'guru',
  SISWA: 'siswa',
  KELAS: 'kelas',
  HAK_AKSES: 'hak_akses',
  HARI_LIBUR: 'hari_libur',
  AUTH: 'auth',
  JADWAL_KBM: 'jadwal_kbm',
  PRESENSI: 'presensi',
  NILAI: 'nilai',
  SARAN_PENGADUAN: 'saran_pengaduan',
  SARPRAS: 'sarpras',
} as const;

export type AuditModul = (typeof AUDIT_MODUL)[keyof typeof AUDIT_MODUL];

type LogParams = {
  aksi: AuditAction;
  modul: string;
  deskripsi: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

// =============================================================================
// CACHE USER INFO
// =============================================================================

let cachedUserInfo: {
  id: string;
  nama: string;
  role: string;
} | null = null;

let cachedForUserId: string | null = null;

async function getUserInfo(userId: string) {
  if (cachedUserInfo && cachedForUserId === userId) {
    return cachedUserInfo;
  }

  try {
    const { data } = await supabase
      .from('gurus')
      .select('nama_lengkap, role')
      .eq('id', userId)
      .maybeSingle();

    cachedUserInfo = {
      id: userId,
      nama: data?.nama_lengkap ?? 'Unknown',
      role: data?.role ?? 'unknown',
    };
    cachedForUserId = userId;

    return cachedUserInfo;
  } catch (err) {
    console.error('[audit] Gagal ambil info guru:', err);
    return {
      id: userId,
      nama: 'Unknown',
      role: 'unknown',
    };
  }
}

/**
 * Reset cache user (dipanggil saat logout).
 */
export function resetAuditCache() {
  cachedUserInfo = null;
  cachedForUserId = null;
}

// =============================================================================
// FUNGSI UTAMA
// =============================================================================

export async function logActivity(params: LogParams): Promise<void> {
  try {
    // 1. Ambil session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      // Tidak ada session — skip logging (mis. dipanggil setelah logout)
      return;
    }

    // 2. Ambil info user (dari cache atau fetch)
    const userInfo = await getUserInfo(session.user.id);

    // 3. Potong deskripsi supaya tidak overflow
    const deskripsi =
      params.deskripsi.length > 1000
        ? params.deskripsi.slice(0, 997) + '...'
        : params.deskripsi;

    // 4. Insert log
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userInfo.id,
      user_nama: userInfo.nama,
      user_role: userInfo.role,
      aksi: params.aksi,
      modul: params.modul,
      target_id: params.targetId ?? null,
      deskripsi,
      metadata: params.metadata ?? null,
    });

    if (error) {
      // Log ke console, tapi JANGAN throw
      console.error('[audit] Gagal insert log:', error.message);
    }
  } catch (err) {
    console.error('[audit] Unexpected error saat logging:', err);
  }
}