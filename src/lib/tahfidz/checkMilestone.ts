// src/lib/tahfidz/checkMilestone.ts
// Cek & auto-award milestone dengan:
// 1. Filter semester (Ganjil: Jul-Des, Genap: Jan-Jun)
// 2. Filter target range (kalau target pakai range surah-ayat)
// 3. Reset per semester (unique: siswa + milestone + tahun_ajaran + semester)

import { supabase } from '@/lib/supabase';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzMilestone,
} from '@/types/database';
import { getHalamanSetoran } from './hitungHalaman';
import {
  getSemesterDateRange,
  isSetoranDalamTarget,
  type SemesterType,
} from './semester';

export type MilestoneResult = {
  awarded: {
    milestone: TahfidzMilestone;
    prestasi_id: string | null;
  }[];
  total_poin_baru: number;
  info: {
    tahun_ajaran: string | null;
    semester: SemesterType | null;
    date_range: { start: string; end: string } | null;
    total_setoran: number;
    setoran_dihitung: number;
    setoran_diabaikan: number;
    filter_range_aktif: boolean;
    total_halaman: number;
  };
};

export async function checkAndAwardMilestone(
  siswaId: number,
  surahMap: Map<number, TahfidzSurah>,
  currentGuruId: string | null,
  halamanMap: TahfidzHalamanDetail[]
): Promise<MilestoneResult> {
  const result: MilestoneResult = {
    awarded: [],
    total_poin_baru: 0,
    info: {
      tahun_ajaran: null,
      semester: null,
      date_range: null,
      total_setoran: 0,
      setoran_dihitung: 0,
      setoran_diabaikan: 0,
      filter_range_aktif: false,
      total_halaman: 0,
    },
  };

  try {
    // 1. Ambil tahun ajaran aktif
    const { data: tahunAktif } = await supabase
      .from('tahun_ajarans')
      .select('id, tahun, semester')
      .eq('is_aktif', true)
      .maybeSingle();

    if (!tahunAktif) {
      console.warn('[milestone] Tidak ada tahun ajaran aktif');
      return result;
    }

    result.info.tahun_ajaran = tahunAktif.tahun;
    result.info.semester = tahunAktif.semester as SemesterType;

    // 2. Date range semester
    const dateRange = getSemesterDateRange(
      tahunAktif.tahun,
      tahunAktif.semester as SemesterType
    );
    result.info.date_range = dateRange;

    // 3. Ambil setoran siswa — filter tanggal semester
    const { data: setoran } = await supabase
      .from('tahfidz_setoran')
      .select('surah_mulai, ayat_mulai, surah_selesai, ayat_selesai, halaman_snapshot, tanggal')
      .eq('siswa_id', siswaId)
      .gte('tanggal', dateRange.start)
      .lte('tanggal', dateRange.end);

    result.info.total_setoran = setoran?.length ?? 0;
    if (!setoran || setoran.length === 0) return result;

    // 4. Target aktif semester ini
    const { data: targetData } = await supabase
      .from('tahfidz_target')
      .select('surah_mulai, ayat_mulai, surah_selesai, ayat_selesai')
      .eq('siswa_id', siswaId)
      .eq('tahun_ajaran_id', tahunAktif.id)
      .maybeSingle();

    const hasRange =
      targetData?.surah_mulai != null &&
      targetData?.ayat_mulai != null &&
      targetData?.surah_selesai != null &&
      targetData?.ayat_selesai != null;

    result.info.filter_range_aktif = hasRange;

    // 5. Filter setoran kalau ada target range
    let setoranToCount = setoran;
    if (hasRange) {
      setoranToCount = setoran.filter((s) =>
        isSetoranDalamTarget(
          {
            surah_mulai: s.surah_mulai,
            ayat_mulai: s.ayat_mulai,
            surah_selesai: s.surah_selesai,
            ayat_selesai: s.ayat_selesai,
          },
          {
            surah_mulai: targetData!.surah_mulai!,
            ayat_mulai: targetData!.ayat_mulai!,
            surah_selesai: targetData!.surah_selesai!,
            ayat_selesai: targetData!.ayat_selesai!,
          }
        )
      );
      result.info.setoran_diabaikan = setoran.length - setoranToCount.length;
    }
    result.info.setoran_dihitung = setoranToCount.length;

    // 6. Total halaman
    const totalHalaman = setoranToCount.reduce(
      (sum, s) => sum + getHalamanSetoran(s as any, surahMap, halamanMap),
      0
    );
    result.info.total_halaman = totalHalaman;

    if (totalHalaman <= 0) return result;

    // 7. Milestone aktif
    const { data: milestones } = await supabase
      .from('tahfidz_milestone')
      .select('*')
      .eq('is_aktif', true)
      .order('threshold_halaman');

    if (!milestones || milestones.length === 0) return result;

    // 8. Milestone sudah dicapai di semester ini
    const { data: sudah } = await supabase
      .from('tahfidz_milestone_tercapai')
      .select('milestone_id')
      .eq('siswa_id', siswaId)
      .eq('tahun_ajaran_id', tahunAktif.id)
      .eq('semester', tahunAktif.semester);

    const sudahSet = new Set((sudah ?? []).map((x) => x.milestone_id));

    // 9. Milestone baru
    const newMilestones = (milestones as TahfidzMilestone[]).filter(
      (m) => totalHalaman >= m.threshold_halaman && !sudahSet.has(m.id)
    );

    if (newMilestones.length === 0) return result;

    // 10. Nama siswa
    const { data: siswa } = await supabase
      .from('siswas')
      .select('id, nama_lengkap')
      .eq('id', siswaId)
      .single();

    if (!siswa) return result;

    // 11. Award
    for (const m of newMilestones) {
      const { data: prestasi, error: prestasiErr } = await supabase
        .from('kesiswaan_prestasi')
        .insert({
          siswa_id: siswaId,
          nama_prestasi: `Tahfidz: ${m.nama}`,
          tingkat: 'Sekolah',
          peringkat: null,
          poin: m.poin_prestasi,
          tanggal: new Date().toISOString().slice(0, 10),
          penyelenggara: `Program Tahfidz ${tahunAktif.tahun} - ${tahunAktif.semester}`,
          pencatat_id: currentGuruId,
        })
        .select()
        .single();

      if (prestasiErr) {
        console.error('[milestone] Gagal insert prestasi:', prestasiErr.message);
        continue;
      }

      await supabase.from('tahfidz_milestone_tercapai').insert({
        siswa_id: siswaId,
        milestone_id: m.id,
        tahun_ajaran_id: tahunAktif.id,
        semester: tahunAktif.semester,
        tanggal_tercapai: new Date().toISOString().slice(0, 10),
        prestasi_id: prestasi?.id ?? null,
        created_by: currentGuruId,
        catatan: `TA ${tahunAktif.tahun} ${tahunAktif.semester} · ${totalHalaman.toFixed(1)} hal`,
      });

      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.TAHFIDZ,
        targetId: String(siswaId),
        deskripsi: `Milestone ${tahunAktif.semester}: ${siswa.nama_lengkap} - ${m.nama} (+${m.poin_prestasi} poin)`,
      });

      result.awarded.push({ milestone: m, prestasi_id: prestasi?.id ?? null });
      result.total_poin_baru += m.poin_prestasi;
    }
  } catch (err) {
    console.error('[checkAndAwardMilestone] Error:', err);
  }

  return result;
}