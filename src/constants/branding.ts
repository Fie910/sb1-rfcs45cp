// src/constants/branding.ts
// Konstanta branding sekolah — dipakai di berbagai komponen UI & pesan

export const SEKOLAH_TAGLINE = 'Merawat Fitrah, Mengukir Karya';
export const SEKOLAH_TAGLINE_FITRAH = 'Merawat Fitrah';
export const SEKOLAH_TAGLINE_KARYA = 'Mengukir Karya';

/** Versi Arab (opsional) — untuk sentuhan visual di splash/login */
export const SEKOLAH_TAGLINE_ARAB = 'رِعَايَةُ الْفِطْرَةِ، نَقْشُ الْأَثَر';

/** Doa pendek yang bisa dipasangkan di loading */
export const TAGLINE_DOA =
  'Setiap langkah ke kelas dengan niat baik adalah amal yang mengalir pahalanya.';

/** Tagline dalam format single-line untuk WA & string contexts */
export const SEKOLAH_TAGLINE_WA = '_"Merawat Fitrah, Mengukir Karya"_';

// =============================================================================
// TOAST TAGLINE — Sentuhan halus untuk momen bermakna
// =============================================================================
/**
 * Pilih flavor sesuai konteks aksi:
 * - rahmat:  aksi yang menyentuh siswa / pembelajaran
 * - ibadah:  aksi yang terkait amanah / tanggung jawab
 * - jejak:   aksi yang menghasilkan karya / dokumen
 */
export const TOAST_TAGLINES = {
  rahmat: 'rawat fitrah, ukir karya ✨',
  ibadah: 'setiap amanah adalah ibadah 🌱',
  jejak: 'jejak baik yang mengukir karya ✨',
} as const;

/**
 * Bungkus pesan sukses dengan flavor tagline.
 * @example
 *   showToast('success', successMsg('Presensi tersimpan', 'rahmat'));
 *   // → "Presensi tersimpan — rawat fitrah, ukir karya ✨"
 */
export function successMsg(
  base: string,
  flavor: keyof typeof TOAST_TAGLINES = 'rahmat'
): string {
  return `${base} — ${TOAST_TAGLINES[flavor]}`;
}