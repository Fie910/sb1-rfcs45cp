// src/lib/tahfidz/hitungHalamanPrecise.ts
// Perhitungan halaman akurat berdasarkan mapping mushaf Madinah.
//
// Algoritma:
// 1. Konversi setoran & setiap baris mapping ke "global ayah index" (1-6236)
// 2. Untuk setiap halaman, hitung jumlah ayat setoran yang beririsan
// 3. Proporsi = ayat_setoran_di_halaman / total_ayat_di_halaman
// 4. Jumlahkan proporsi dari semua halaman yang beririsan

import type { TahfidzHalamanDetail } from '@/types/database';
import { toGlobalAyah } from './cumulativeAyah';

type RentangSetoran = {
  surah_mulai: number;
  ayat_mulai: number;
  surah_selesai: number;
  ayat_selesai: number;
};

export function hitungHalamanPrecise(
  setoran: RentangSetoran,
  halamanMap: TahfidzHalamanDetail[]
): number {
  const setoranMulai = toGlobalAyah(setoran.surah_mulai, setoran.ayat_mulai);
  const setoranSelesai = toGlobalAyah(setoran.surah_selesai, setoran.ayat_selesai);

  if (setoranMulai === 0 || setoranSelesai === 0) return 0;
  if (setoranSelesai < setoranMulai) return 0;

  // Group mapping by halaman
  const byPage = new Map<number, TahfidzHalamanDetail[]>();
  for (const row of halamanMap) {
    if (!byPage.has(row.halaman)) byPage.set(row.halaman, []);
    byPage.get(row.halaman)!.push(row);
  }

  let totalHalaman = 0;

  for (const [, rows] of byPage) {
    let totalAyatDiHalaman = 0;
    let ayatSetoranDiHalaman = 0;

    for (const row of rows) {
      const rowMulai = toGlobalAyah(row.surah_nomor, row.ayat_mulai);
      const rowSelesai = toGlobalAyah(row.surah_nomor, row.ayat_selesai);
      const rowCount = rowSelesai - rowMulai + 1;

      totalAyatDiHalaman += rowCount;

      // Cek irisan
      const overlapMulai = Math.max(rowMulai, setoranMulai);
      const overlapSelesai = Math.min(rowSelesai, setoranSelesai);

      if (overlapMulai <= overlapSelesai) {
        ayatSetoranDiHalaman += overlapSelesai - overlapMulai + 1;
      }
    }

    if (totalAyatDiHalaman > 0) {
      totalHalaman += ayatSetoranDiHalaman / totalAyatDiHalaman;
    }
  }

  return totalHalaman;
}