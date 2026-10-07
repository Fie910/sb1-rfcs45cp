// src/lib/rapatNotifications.ts
// Helper untuk notifikasi terkait rapat.

import { supabase } from '@/lib/supabase';
import { sendNotification } from './notification';
import type { RapatWithRelations, RapatPesertaWithGuru } from '@/types/database';

// =============================================================================
// NOTIF — Rapat Dibuat
// =============================================================================
export async function notifyRapatCreated(
  rapat: RapatWithRelations,
  currentGuruId: string
): Promise<void> {
  try {
    // Fetch peserta
    const { data: peserta } = await supabase
      .from('rapat_peserta')
      .select('guru_id')
      .eq('rapat_id', rapat.id);

    const pesertaIds = (peserta ?? [])
      .map((p: any) => p.guru_id)
      .filter((id: string) => id !== currentGuruId);

    if (pesertaIds.length === 0) return;

    const tanggal = new Date(rapat.tanggal + 'T00:00:00+07:00').toLocaleDateString(
      'id-ID',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    );
    const jam = rapat.waktu_mulai?.slice(0, 5) ?? '';

    await sendNotification({
      guruIds: pesertaIds,
      judul: '📅 Undangan Rapat Baru',
      pesan: `${rapat.judul}\n${tanggal}, ${jam} WIB\n${rapat.lokasi ?? '-'}\n\nCek detail di menu Rapat.`,
      tipe: 'rapat_baru',
      tautan: '/rapat',
    });
  } catch (err) {
    console.error('[notify] Rapat created:', err);
  }
}

// =============================================================================
// NOTIF — Rapat Diupdate (jadwal berubah, dll)
// =============================================================================
export async function notifyRapatUpdated(
  rapat: RapatWithRelations,
  currentGuruId: string
): Promise<void> {
  try {
    const { data: peserta } = await supabase
      .from('rapat_peserta')
      .select('guru_id')
      .eq('rapat_id', rapat.id);

    const pesertaIds = (peserta ?? [])
      .map((p: any) => p.guru_id)
      .filter((id: string) => id !== currentGuruId);

    if (pesertaIds.length === 0) return;

    await sendNotification({
      guruIds: pesertaIds,
      judul: '✏️ Rapat Diperbarui',
      pesan: `Rapat "${rapat.judul}" telah diperbarui. Cek detail jadwal terbaru di menu Rapat.`,
      tipe: 'rapat_update',
      tautan: '/rapat',
    });
  } catch (err) {
    console.error('[notify] Rapat updated:', err);
  }
}

// =============================================================================
// NOTIF — Rapat Dibatalkan
// =============================================================================
export async function notifyRapatCancelled(
  rapat: RapatWithRelations,
  currentGuruId: string
): Promise<void> {
  try {
    const { data: peserta } = await supabase
      .from('rapat_peserta')
      .select('guru_id')
      .eq('rapat_id', rapat.id);

    const pesertaIds = (peserta ?? [])
      .map((p: any) => p.guru_id)
      .filter((id: string) => id !== currentGuruId);

    if (pesertaIds.length === 0) return;

    await sendNotification({
      guruIds: pesertaIds,
      judul: '❌ Rapat Dibatalkan',
      pesan: `Rapat "${rapat.judul}" telah dibatalkan. Silakan cek menu Rapat untuk info lebih lanjut.`,
      tipe: 'rapat_cancel',
      tautan: '/rapat',
    });
  } catch (err) {
    console.error('[notify] Rapat cancelled:', err);
  }
}

// =============================================================================
// NOTIF — Notulensi Final
// =============================================================================
export async function notifyNotulensiFinal(
  rapat: RapatWithRelations,
  currentGuruId: string
): Promise<void> {
  try {
    const { data: peserta } = await supabase
      .from('rapat_peserta')
      .select('guru_id')
      .eq('rapat_id', rapat.id);

    const pesertaIds = (peserta ?? [])
      .map((p: any) => p.guru_id)
      .filter((id: string) => id !== currentGuruId);

    if (pesertaIds.length === 0) return;

    await sendNotification({
      guruIds: pesertaIds,
      judul: '✅ Notulensi Rapat Selesai',
      pesan: `Notulensi rapat "${rapat.judul}" sudah difinalisasi. Klik untuk melihat detail & action items.`,
      tipe: 'notulensi_final',
      tautan: '/rapat',
    });
  } catch (err) {
    console.error('[notify] Notulensi final:', err);
  }
}

// =============================================================================
// WA SHARE — Generate link share WhatsApp
// =============================================================================
export function buildWaShareLinkRapat(
  rapat: RapatWithRelations,
  recipientPhone?: string | null
): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${baseUrl}/rapat`;

  const tanggal = new Date(rapat.tanggal + 'T00:00:00+07:00').toLocaleDateString(
    'id-ID',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );
  const jam = rapat.waktu_mulai?.slice(0, 5) ?? '';

  const pesan =
    `*${rapat.judul}*\n\n` +
    `🗓️ ${tanggal}\n` +
    `🕐 ${jam} WIB\n` +
    `📍 ${rapat.lokasi ?? '-'}\n` +
    `👤 Pemimpin: ${rapat.pemimpin_nama ?? '-'}\n` +
    `📝 Notulis: ${rapat.notulis_nama ?? '-'}\n\n` +
    `Nomor: ${rapat.nomor_rapat ?? '-'}\n\n` +
    `Detail lengkap: ${url}`;

  const phone = recipientPhone
    ? recipientPhone.replace(/\D/g, '').replace(/^0/, '62').replace(/^8/, '628')
    : '';

  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`;
  }

  // Tanpa nomor → pakai share API (user pilih kontak)
  return `https://wa.me/?text=${encodeURIComponent(pesan)}`;
}

export function buildWaShareLinkNotulensi(
  rapat: RapatWithRelations,
  ringkasan: string | null,
  recipientPhone?: string | null
): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${baseUrl}/rapat`;

  const pesan =
    `*Notulensi Rapat: ${rapat.judul}*\n` +
    `Nomor: ${rapat.nomor_rapat ?? '-'}\n` +
    `Tanggal: ${new Date(rapat.tanggal + 'T00:00:00+07:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n` +
    `*Ringkasan:*\n${(ringkasan ?? '-').slice(0, 500)}\n\n` +
    `Lihat notulensi lengkap: ${url}`;

  const phone = recipientPhone
    ? recipientPhone.replace(/\D/g, '').replace(/^0/, '62').replace(/^8/, '628')
    : '';

  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(pesan)}`;
}