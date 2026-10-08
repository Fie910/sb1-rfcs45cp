// src/lib/tahfidz/hitungHalaman.ts
// Utility kalkulasi halaman Al-Quran dari rentang surah+ayat.
// Mapping halaman mengikuti Mushaf Madinah (604 halaman).

import type { TahfidzSurah, TahfidzSetoran } from '@/types/database';
import type { TahfidzSurah, TahfidzHalamanDetail } from '@/types/database';
import { hitungHalamanPrecise } from './hitungHalamanPrecise';

type RentangSetoran = Pick<
  TahfidzSetoran,
  'surah_mulai' | 'ayat_mulai' | 'surah_selesai' | 'ayat_selesai'
>;

/**
 * Hitung halaman (desimal) untuk satu setoran.
 * - Single surah: proporsi ayat × total halaman surah
 * - Lintas surah: jumlahkan halaman per segmen
 */
export function hitungHalamanSetoran(
  setoran: RentangSetoran,
  surahMap: Map<number, TahfidzSurah>
): number {
  const { surah_mulai, ayat_mulai, surah_selesai, ayat_selesai } = setoran;

  if (surah_mulai === surah_selesai) {
    const surah = surahMap.get(surah_mulai);
    if (!surah || surah.jumlah_ayat <= 0) return 0;
    const jumlahAyatDisetor = ayat_selesai - ayat_mulai + 1;
    const totalHalamanSurah = surah.halaman_selesai - surah.halaman_mulai + 1;
    return (jumlahAyatDisetor / surah.jumlah_ayat) * totalHalamanSurah;
  }

  let total = 0;

  // Segmen 1: sisa surah_mulai
  const surahAwal = surahMap.get(surah_mulai);
  if (surahAwal && surahAwal.jumlah_ayat > 0) {
    const ayatSisa = surahAwal.jumlah_ayat - ayat_mulai + 1;
    const totalHalamanAwal = surahAwal.halaman_selesai - surahAwal.halaman_mulai + 1;
    total += (ayatSisa / surahAwal.jumlah_ayat) * totalHalamanAwal;
  }

  // Segmen 2: surah-surah di tengah (full)
  for (let n = surah_mulai + 1; n < surah_selesai; n++) {
    const surah = surahMap.get(n);
    if (surah) {
      total += surah.halaman_selesai - surah.halaman_mulai + 1;
    }
  }

  // Segmen 3: awal surah_selesai
  const surahAkhir = surahMap.get(surah_selesai);
  if (surahAkhir && surahAkhir.jumlah_ayat > 0) {
    const totalHalamanAkhir =
      surahAkhir.halaman_selesai - surahAkhir.halaman_mulai + 1;
    total += (ayat_selesai / surahAkhir.jumlah_ayat) * totalHalamanAkhir;
  }

  return total;
}

/**
 * Wrapper prioritas perhitungan halaman:
 *   1. Precise mapping (kalau halamanMap tersedia) — AKURAT
 *   2. Fallback formula lama (kalau halamanMap kosong)
 */
export function getHalamanSetoran(
  setoran: RentangSetoran,
  surahMap: Map<number, TahfidzSurah>,
  halamanMap?: TahfidzHalamanDetail[]
): number {
  if (halamanMap && halamanMap.length > 0) {
    return hitungHalamanPrecise(setoran, halamanMap);
  }
  return hitungHalamanSetoran(setoran, surahMap);
}

/**
 * Hitung total ayat untuk satu setoran (lintas surah).
 */
export function hitungTotalAyatSetoran(
  setoran: RentangSetoran,
  surahMap: Map<number, TahfidzSurah>
): number {
  const { surah_mulai, ayat_mulai, surah_selesai, ayat_selesai } = setoran;

  if (surah_mulai === surah_selesai) {
    return ayat_selesai - ayat_mulai + 1;
  }

  let total = 0;

  const surahAwal = surahMap.get(surah_mulai);
  if (surahAwal) total += surahAwal.jumlah_ayat - ayat_mulai + 1;

  for (let n = surah_mulai + 1; n < surah_selesai; n++) {
    const surah = surahMap.get(n);
    if (surah) total += surah.jumlah_ayat;
  }

  total += ayat_selesai;
  return total;
}

/**
 * Format halaman jadi string enak dibaca.
 */
export function formatHalaman(halaman: number): string {
  if (halaman < 0.005) return '0';
  if (halaman < 1) return halaman.toFixed(2);
  if (halaman < 10) return halaman.toFixed(1);
  return Math.round(halaman).toString();
}

/**
 * Format rentang hafalan → string deskriptif.
 * Contoh: "Al-Baqarah : 1-50" atau "Al-Baqarah : 250 → Ali Imran : 10"
 */
export function formatRentangHafalan(
  setoran: RentangSetoran,
  surahMap: Map<number, TahfidzSurah>
): string {
  const surahAwal = surahMap.get(setoran.surah_mulai);
  const surahAkhir = surahMap.get(setoran.surah_selesai);
  if (!surahAwal || !surahAkhir) return '—';

  if (setoran.surah_mulai === setoran.surah_selesai) {
    return `${surahAwal.nama_latin} : ${setoran.ayat_mulai}-${setoran.ayat_selesai}`;
  }
  return `${surahAwal.nama_latin} : ${setoran.ayat_mulai} → ${surahAkhir.nama_latin} : ${setoran.ayat_selesai}`;
}