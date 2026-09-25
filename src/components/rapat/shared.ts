// src/components/rapat/shared.ts
// Helper & konstanta untuk Modul Rapat & Notulensi.

// =============================================================================
// BADGE STYLES
// =============================================================================
export function getStatusRapatBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Draft':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Akan Datang':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Berlangsung':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Dibatalkan':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getJenisRapatBadge(jenis: string | null | undefined): string {
  switch (jenis) {
    case 'Rapat Dinas':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Rapat Divisi':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'Rapat Koordinasi':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Rapat Pleno':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Rapat Khusus':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Rapat Evaluasi':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getKehadiranBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Hadir':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Terlambat':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Izin':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Tidak Hadir':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Belum Dikonfirmasi':
      return 'bg-slate-800 text-slate-400 border-slate-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getNotulensiBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Final':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Draft':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

// =============================================================================
// FORMATTERS
// =============================================================================
export function formatTanggalRapat(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTanggalPendek(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatJam(time: string | null | undefined): string {
  if (!time) return '-';
  return time.slice(0, 5); // 'HH:MM'
}

export function formatWaktuRapat(
  mulai: string | null | undefined,
  selesai: string | null | undefined
): string {
  if (!mulai) return '-';
  const m = formatJam(mulai);
  const s = selesai ? formatJam(selesai) : null;
  return s ? `${m} — ${s} WIB` : `${m} WIB`;
}

// =============================================================================
// DATE HELPERS
// =============================================================================
/** Cek apakah tanggal sudah lewat */
export function isPast(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.getTime() < today.getTime();
}

/** Cek apakah tanggal hari ini */
export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/** Hitung selisih hari dari sekarang (negatif = sudah lewat) */
export function daysFromNow(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// INPUT CLASSES (reuse pola dari modul lain)
// =============================================================================
export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';

// =============================================================================
// AKSES
// =============================================================================
export const RAPAT_MANAGER_ROLES = [
  'admin', 'kepala', 'wakil_kepala', 'takola', 'staf_takola',
  'akademik', 'kesiswaan', 'sarpras', 'keuangan',
];

export function isRapatManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return RAPAT_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// RE-EXPORT CONSTANTS dari types — biar komponen cukup import dari 'shared'
// =============================================================================
export {
  JENIS_RAPAT_OPTIONS,
  STATUS_RAPAT_OPTIONS,
  JABATAN_RAPAT_OPTIONS,
  KEHADIRAN_RAPAT_OPTIONS,
} from '@/types/database';