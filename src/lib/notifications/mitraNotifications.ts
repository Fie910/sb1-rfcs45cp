// src/lib/mitraNotifications.ts
// Helper notifikasi & reminder untuk Modul Mitra DUDI & MoU.

import { supabase } from '@/lib/supabase';
import { sendNotification, getGuruIdsByRole } from './notification';

// =============================================================================
// TYPES
// =============================================================================
type MouReminderData = {
  id: string;
  nomor_mou: string | null;
  judul: string;
  mitra_id: string;
  mitra_nama: string | null;
  tanggal_selesai: string;
  hari_ke_expired: number;
  level_reminder: 'H7' | 'H30';
  pic_nama: string | null;
  pic_no_hp: string | null;
  reminder_h30_sent_at: string | null;
  reminder_h7_sent_at: string | null;
};

// Role yang menerima reminder
const REMINDER_ROLES = ['admin', 'kepala', 'wakil_kepala', 'takola', 'staf_takola'];

// =============================================================================
// CEK & KIRIM REMINDER
// =============================================================================
export async function checkAndSendMouReminders(): Promise<{
  sent: number;
  errors: number;
}> {
  const result = { sent: 0, errors: 0 };

  try {
    // 1. Ambil semua MoU yang butuh reminder
    const { data: mouList, error } = await supabase
      .from('v_mou_perlu_reminder')
      .select('*')
      .eq('butuh_reminder', true);

    if (error) {
      console.warn('[mou-reminder] Query error:', error);
      return result;
    }

    if (!mouList || mouList.length === 0) {
      return result;
    }

    // 2. Ambil penerima (role manager)
    let penerimaIds: string[] = [];
    try {
      const arrays = await Promise.all(
        REMINDER_ROLES.map((role) => getGuruIdsByRole(role))
      );
      penerimaIds = Array.from(new Set(arrays.flat()));
    } catch (err) {
      console.warn('[mou-reminder] Gagal ambil penerima:', err);
      return result;
    }

    if (penerimaIds.length === 0) {
      return result;
    }

    // 3. Loop & kirim reminder
    for (const mou of mouList as MouReminderData[]) {
      try {
        const isH7 = mou.level_reminder === 'H7';
        const days = mou.hari_ke_expired;

        const judul = isH7 
          ? `⚠️ MoU Expired dalam ${days} Hari` 
          : `📋 MoU Akan Expired (${days} hari lagi)`;

        const pesan = 
          `MoU dengan *${mou.mitra_nama ?? 'mitra'}* akan berakhir pada ` +
          `${formatTanggalPendek(mou.tanggal_selesai)} (${days} hari lagi).\n\n` +
          `Nomor: ${mou.nomor_mou ?? '-'}\n` +
          `Judul: ${mou.judul}\n\n` +
          `Segera lakukan perpanjangan atau tindak lanjut.`;

        await sendNotification({
          guruIds: penerimaIds,
          judul,
          pesan,
          tipe: 'mou_expiry_reminder',
          tautan: '/mitra',
        });

        // 4. Update flag reminder
        const updateField = isH7 ? 'reminder_h7_sent_at' : 'reminder_h30_sent_at';
        const { error: updateErr } = await supabase
          .from('mou')
          .update({ [updateField]: new Date().toISOString() })
          .eq('id', mou.id);

        if (updateErr) {
          console.warn('[mou-reminder] Gagal update flag:', updateErr);
          result.errors++;
        } else {
          result.sent++;
        }
      } catch (err) {
        console.warn('[mou-reminder] Error per MoU:', err);
        result.errors++;
      }
    }

    return result;
  } catch (err) {
    console.warn('[mou-reminder] Unexpected error:', err);
    return result;
  }
}

// =============================================================================
// MANUAL REMINDER — Kirim reminder untuk MoU tertentu
// =============================================================================
export async function sendManualMouReminder(mou: {
  id: string;
  nomor_mou: string | null;
  judul: string;
  mitra_nama: string | null;
  tanggal_selesai: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const days = Math.round(
      (new Date(mou.tanggal_selesai).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let penerimaIds: string[] = [];
    try {
      const arrays = await Promise.all(
        REMINDER_ROLES.map((role) => getGuruIdsByRole(role))
      );
      penerimaIds = Array.from(new Set(arrays.flat()));
    } catch (err) {
      return { success: false, message: 'Gagal ambil daftar penerima' };
    }

    if (penerimaIds.length === 0) {
      return { success: false, message: 'Tidak ada penerima (tidak ada manager)' };
    }

    await sendNotification({
      guruIds: penerimaIds,
      judul: `📢 Reminder Manual: MoU ${mou.mitra_nama ?? ''}`,
      pesan: 
        `MoU *${mou.judul}* (${mou.nomor_mou ?? '-'}) ` +
        `berakhir pada ${formatTanggalPendek(mou.tanggal_selesai)} ` +
        `(${days} hari lagi).`,
      tipe: 'mou_manual_reminder',
      tautan: '/mitra',
    });

    return {
      success: true,
      message: `Reminder terkirim ke ${penerimaIds.length} penerima`,
    };
  } catch (err: any) {
    return { success: false, message: err.message ?? 'Error' };
  }
}

// =============================================================================
// HELPER
// =============================================================================
function formatTanggalPendek(dateStr: string): string {
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// HOOK — auto-trigger saat mount
// =============================================================================
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 30 * 60 * 1000; // 30 menit

/**
 * Trigger cek reminder dengan throttle 30 menit.
 * Dipakai di MitraPage atau halaman manapun yang perlu auto-cek.
 */
export async function checkMouRemindersThrottled(): Promise<number> {
  const now = Date.now();
  if (now - lastCheckTime < MIN_CHECK_INTERVAL) {
    return 0;
  }
  lastCheckTime = now;

  const result = await checkAndSendMouReminders();
  return result.sent;
}