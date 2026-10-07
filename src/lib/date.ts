//src/lib/date.ts
import type { HariMinggu } from '@/types/database';

// =============================================================================
// KONSTANTA
// =============================================================================

const WIB_TZ = 'Asia/Jakarta';

// =============================================================================
// TANGGAL — Format YYYY-MM-DD
// =============================================================================

/**
 * Mendapatkan tanggal dalam format YYYY-MM-DD berbasis WIB.
 * Menerima parameter Date opsional (untuk testing).
 */
export function getWibDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

/**
 * Alias `getWibDateString()` — semantik "hari ini WIB".
 * Menggantikan helper duplikat: getTodayDateWib, getTodayDateStrWib,
 * getWIBTodayString, getTodayWIB.
 */
export function getTodayDateWib(): string {
  return getWibDateString();
}

/**
 * Tanggal 1 bulan berjalan (YYYY-MM-01) berbasis WIB.
 * Menggantikan: getFirstDayOfMonthWib, getFirstDayOfMonth,
 * getStartOfMonthWIB, getWIBFirstDayOfMonthString.
 */
export function getFirstDayOfMonthWib(): string {
  const today = getWibDateString();
  return `${today.slice(0, 7)}-01`;
}

/**
 * Tanggal terakhir bulan berjalan (YYYY-MM-DD) berbasis WIB.
 * Menggantikan: getLastDayOfMonth.
 */
export function getLastDayOfMonthWib(): string {
  const today = getWibDateString();
  const [yearStr, monthStr] = today.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Bulan berjalan dalam format YYYY-MM berbasis WIB.
 * Cocok untuk filter bulan (AttendanceSummary).
 */

// =============================================================================
// NAMA HARI (Bahasa Indonesia)
// =============================================================================

/**
 * Nama hari (Senin..Minggu) dari hari ini berbasis WIB.
 * Menggantikan: getTodayHariWib, getTodayHariWIB.
 */
export function getTodayHariWib(): HariMinggu {
  const hari = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: WIB_TZ,
  }).format(new Date());

  const cleanHari = hari.replace("'", '').replace('’', '');
  return (cleanHari.charAt(0).toUpperCase() + cleanHari.slice(1)) as HariMinggu;
}

/**
 * Nama hari (Senin..Minggu) dari string tanggal YYYY-MM-DD.
 * Menggantikan: getHariFromDateString, getHariFromDate.
 */
export function getHariFromDateString(dateStr: string): HariMinggu {
  const dateObj = new Date(`${dateStr}T12:00:00+07:00`);
  const hari = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: WIB_TZ,
  }).format(dateObj);

  const cleanHari = hari.replace("'", '').replace('’', '');
  return (cleanHari.charAt(0).toUpperCase() + cleanHari.slice(1)) as HariMinggu;
}

/**
 * @deprecated Gunakan `getTodayHariWib()` sebagai gantinya.
 * Dipertahankan untuk backward compatibility.
 */
export function getHariIniLokal(): string {
  return getTodayHariWib();
}

// =============================================================================
// WAKTU — Format HH:mm
// =============================================================================

/**
 * Jam saat ini dalam format HH:mm berbasis WIB.
 * Menggantikan: getCurrentTimeStrWib (duplikat).
 */
export function getCurrentTimeStrWib(): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: WIB_TZ,
  })
    .format(new Date())
    .replace('.', ':');
}

/**
 * Cek apakah waktu saat ini (WIB) berada di antara waktu mulai & selesai.
 * Format waktu: HH:mm
 */
export function isJadwalAktif(waktuMulai: string, waktuSelesai: string): boolean {
  if (!waktuMulai || !waktuSelesai) return false;

  const now = getCurrentTimeStrWib();
  const mulai = waktuMulai.slice(0, 5);
  const selesai = waktuSelesai.slice(0, 5);

  return now >= mulai && now <= selesai;
}

// =============================================================================
// FORMAT TANGGAL (Display)
// =============================================================================

/**
 * Format tanggal YYYY-MM-DD → "Senin, 12 September 2026"
 * Menggantikan: formatDateWIB (versi panjang).
 */
export function formatDateWibLong(dateStr: string): string {
  if (!dateStr) return '-';
  const dateObj = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00+07:00`);

  return dateObj.toLocaleDateString('id-ID', {
    timeZone: WIB_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format tanggal YYYY-MM-DD → "Sen, 12 Sep 2026"
 */
export function formatDateWibShort(dateStr: string): string {
  if (!dateStr) return '-';
  const dateObj = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00+07:00`);

  return dateObj.toLocaleDateString('id-ID', {
    timeZone: WIB_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format tanggal YYYY-MM-DD → "12/09/2026"
 * Menggantikan: formatTanggal (versi dd/mm/yyyy di TodoListPage).
 */
export function formatTanggalDDMMYYYY(dateString: string | null): string | null {
  if (!dateString) return null;
  const rawDate = dateString.split('T')[0];
  const [year, month, day] = rawDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Format tanggal YYYY-MM-DD → "12 September 2026" (tanpa nama hari).
 */
export function formatDateWibNoDay(dateStr: string): string {
  if (!dateStr) return '-';
  const dateObj = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00+07:00`);

  return dateObj.toLocaleDateString('id-ID', {
    timeZone: WIB_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}