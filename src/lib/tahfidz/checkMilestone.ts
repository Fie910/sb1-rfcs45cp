// src/lib/tahfidz/checkMilestone.ts
// Service untuk cek & auto-award milestone poin prestasi ketika siswa capai threshold.

import { supabase } from '@/lib/supabase';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import type { TahfidzSurah, TahfidzSetoran, TahfidzMilestone } from '@/types/database';
import { hitungHalamanSetoran } from './hitungHalaman';

export type MilestoneResult = {
  awarded: {
    milestone: TahfidzMilestone;
    prestasi_id: string | null;
  }[];
  total_poin_baru: number;
};

/**
 * Cek apakah siswa mencapai milestone baru setelah setoran.
 * Kalau iya, auto-insert ke `kesiswaan_prestasi` + log di `tahfidz_milestone_tercapai`.
 * Return list milestone yang baru dicapai.
 */
export async function checkAndAwardMilestone(
  siswaId: number,
  surahMap: Map<number, TahfidzSurah>,
  currentGuruId: string | null
): Promise<MilestoneResult> {
  const result: MilestoneResult = { awarded: [], total_poin_baru: 0 };

  try {
    // 1. Hitung total halaman
    const { data: setoran } = await supabase
      .from('tahfidz_setoran')
      .select('surah_mulai, ayat_mulai, surah_selesai, ayat_selesai')
      .eq('siswa_id', siswaId);

    const totalHalaman = (setoran ?? []).reduce(
      (sum, s) => sum + hitungHalamanSetoran(s as any, surahMap),
      0
    );

    if (totalHalaman <= 0) return result;

    // 2. Ambil semua milestone aktif
    const { data: milestones } = await supabase
      .from('tahfidz_milestone')
      .select('*')
      .eq('is_aktif', true)
      .order('threshold_halaman');

    if (!milestones || milestones.length === 0) return result;

    // 3. Ambil milestone yang SUDAH dicapai (untuk skip)
    const { data: sudah } = await supabase
      .from('tahfidz_milestone_tercapai')
      .select('milestone_id')
      .eq('siswa_id', siswaId);

    const sudahSet = new Set((sudah ?? []).map((x) => x.milestone_id));

    // 4. Cek milestone baru
    const newMilestones = (milestones as TahfidzMilestone[]).filter(
      (m) => totalHalaman >= m.threshold_halaman && !sudahSet.has(m.id)
    );

    if (newMilestones.length === 0) return result;

    // 5. Ambil data siswa untuk kesiswaan_prestasi
    const { data: siswa } = await supabase
      .from('siswas')
      .select('id, nama_lengkap')
      .eq('id', siswaId)
      .single();

    if (!siswa) return result;

    // 6. Award satu per satu
    for (const m of newMilestones) {
      // Insert ke kesiswaan_prestasi
      const { data: prestasi, error: prestasiErr } = await supabase
        .from('kesiswaan_prestasi')
        .insert({
          siswa_id: siswaId,
          nama_prestasi: `Tahfidz: ${m.nama}`,
          tingkat: 'Sekolah',
          peringkat: null,
          poin: m.poin_prestasi,
          tanggal: new Date().toISOString().slice(0, 10),
          penyelenggara: 'Program Tahfidz Sekolah',
          pencatat_id: currentGuruId,
        })
        .select()
        .single();

      if (prestasiErr) {
        console.error('[milestone] Gagal insert prestasi:', prestasiErr.message);
        continue;
      }

      // Insert ke tahfidz_milestone_tercapai
      await supabase.from('tahfidz_milestone_tercapai').insert({
        siswa_id: siswaId,
        milestone_id: m.id,
        tanggal_tercapai: new Date().toISOString().slice(0, 10),
        prestasi_id: prestasi?.id ?? null,
        created_by: currentGuruId,
        catatan: `Otomatis saat total ${totalHalaman.toFixed(1)} halaman`,
      });

      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.TAHFIDZ,
        targetId: String(siswaId),
        deskripsi: `Milestone tercapai: ${siswa.nama_lengkap} - ${m.nama} (+${m.poin_prestasi} poin)`,
      });

      result.awarded.push({ milestone: m, prestasi_id: prestasi?.id ?? null });
      result.total_poin_baru += m.poin_prestasi;
    }
  } catch (err) {
    console.error('[checkAndAwardMilestone] Error:', err);
  }

  return result;
}