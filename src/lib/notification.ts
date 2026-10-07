// src/lib/notification.ts
// Helper terpusat untuk mengirim notifikasi in-app + memicu push notification.
//
// Cara pakai:
//   await sendNotification({
//     guruIds: 'uuid-tunggal-atau-array',
//     judul: 'Judul notifikasi',
//     pesan: 'Isi pesan',
//     tipe: 'tugas', // lihat TIPE_NOTIFIKASI di bawah
//     tautan: '/todo',
//   });
//
// Push notification akan otomatis dikirim oleh webhook Supabase → Edge Function
// `send-push`, 

import { supabase } from '@/lib/supabase';


export type SendNotificationPayload = {
  /** Satu UUID atau array UUID guru penerima */
  guruIds: string | string[];
  judul: string;
  pesan: string;
  tipe: string;
  /** Path relatif di aplikasi, mis. "/todo", "/piket". Default: "/" */
  tautan?: string | null;
};

type SendResult = {
  sent: number;
  error: string | null;
};

// =============================================================================
// UTAMA — Kirim notifikasi ke satu atau banyak guru
// =============================================================================

/**
 * Kirim notifikasi ke daftar guru. Otomatis:
 * - Deduplikasi & filter ID kosong
 * - Insert batch (1 query, bukan loop)
 * - Trigger push via webhook (kecuali tipe non-push)
 */
export async function sendNotification(
  payload: SendNotificationPayload
): Promise<SendResult> {
  const ids = Array.isArray(payload.guruIds) ? payload.guruIds : [payload.guruIds];
  const uniqueIds = Array.from(new Set(ids.filter((id) => !!id)));

  if (uniqueIds.length === 0) {
    return { sent: 0, error: null };
  }

  const rows = uniqueIds.map((guruId) => ({
    guru_id: guruId,
    judul: payload.judul,
    pesan: payload.pesan,
    tipe: payload.tipe,
    tautan: payload.tautan ?? '/',
    is_read: false,
  }));

  const { error } = await supabase.from('notifikasi').insert(rows);

  if (error) {
    console.error('[notification] Gagal insert:', error.message);
    return { sent: 0, error: error.message };
  }

  return { sent: uniqueIds.length, error: null };
}

// =============================================================================
// HELPER — Broadcast & ambil penerima
// =============================================================================

/**
 * Broadcast ke SEMUA guru di sekolah.
 * Cocok untuk: pengumuman global, agenda sekolah besar, libur nasional.
 */
export async function broadcastToAllGurus(
  payload: Omit<SendNotificationPayload, 'guruIds'>
): Promise<SendResult> {
  const { data, error } = await supabase.from('gurus').select('id');

  if (error || !data) {
    return { sent: 0, error: error?.message ?? 'Gagal mengambil daftar guru' };
  }

  return sendNotification({
    ...payload,
    guruIds: data.map((g) => g.id),
  });
}

/**
 * Ambil daftar ID guru berdasarkan kode role.
 * Contoh role: 'kepegawaian', 'kesiswaan', 'akademik', 'admin'.
 */
export async function getGuruIdsByRole(role: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('gurus')
    .select('id')
    .eq('role', role);

  if (error) {
    console.error('[notification] Gagal ambil guru by role:', error.message);
    return [];
  }
  return data?.map((g) => g.id) ?? [];
}

/**
 * Ambil daftar ID guru dalam satu divisi.
 */
export async function getGuruIdsByDivisi(divisiId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('gurus')
    .select('id')
    .eq('divisi_id', divisiId);

  if (error) {
    console.error('[notification] Gagal ambil guru by divisi:', error.message);
    return [];
  }
  return data?.map((g) => g.id) ?? [];
}

/**
 * Ambil daftar ID guru piket pada hari tertentu.
 * @param hari — 'Senin' | 'Selasa' | ... | 'Sabtu'
 */
export async function getGuruIdsPiketHari(hari: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('jadwal_pikets')
    .select('guru_id')
    .eq('hari_piket', hari);

  if (error) {
    console.error('[notification] Gagal ambil guru piket:', error.message);
    return [];
  }
  return data?.map((j) => j.guru_id) ?? [];
}

