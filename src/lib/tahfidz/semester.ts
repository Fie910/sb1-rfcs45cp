// src/lib/tahfidz/semester.ts
// Helper semester date range (standar Indonesia).
//
// TA 2025/2026:
//   - Ganjil: 2025-07-01 s/d 2025-12-31
//   - Genap:  2026-01-01 s/d 2026-06-30

export type SemesterType = 'Ganjil' | 'Genap';

/**
 * Parse tahun ajaran "2025/2026" → date range per semester.
 */
export function getSemesterDateRange(
  tahunAjaran: string,
  semester: SemesterType
): { start: string; end: string } {
  const parts = tahunAjaran.split(/[\/\-]/).map((s) => s.trim());
  const startYear = parseInt(parts[0], 10);
  const endYear = parseInt(parts[1], 10) || startYear + 1;

  if (!Number.isFinite(startYear)) {
    const now = new Date();
    const y = now.getFullYear();
    return semester === 'Ganjil'
      ? { start: `${y}-07-01`, end: `${y}-12-31` }
      : { start: `${y + 1}-01-01`, end: `${y + 1}-06-30` };
  }

  if (semester === 'Ganjil') {
    return { start: `${startYear}-07-01`, end: `${startYear}-12-31` };
  }
  return { start: `${endYear}-01-01`, end: `${endYear}-06-30` };
}

/**
 * Cek apakah tanggal masuk dalam semester tertentu.
 */
export function isDateInSemester(
  tanggal: string,
  tahunAjaran: string,
  semester: SemesterType
): boolean {
  const { start, end } = getSemesterDateRange(tahunAjaran, semester);
  return tanggal >= start && tanggal <= end;
}

/**
 * Cek apakah setoran ada di dalam target (composite surah+ayat).
 * Return true kalau SELURUH setoran berada dalam range target.
 */
export function isSetoranDalamTarget(
  setoran: {
    surah_mulai: number;
    ayat_mulai: number;
    surah_selesai: number;
    ayat_selesai: number;
  },
  target: {
    surah_mulai: number;
    ayat_mulai: number;
    surah_selesai: number;
    ayat_selesai: number;
  }
): boolean {
  // Composite value: surah * 1000 + ayat (aman karena max ayat = 286)
  const setoranMulaiVal = setoran.surah_mulai * 1000 + setoran.ayat_mulai;
  const setoranSelesaiVal = setoran.surah_selesai * 1000 + setoran.ayat_selesai;
  const targetMulaiVal = target.surah_mulai * 1000 + target.ayat_mulai;
  const targetSelesaiVal = target.surah_selesai * 1000 + target.ayat_selesai;

  return setoranMulaiVal >= targetMulaiVal && setoranSelesaiVal <= targetSelesaiVal;
}