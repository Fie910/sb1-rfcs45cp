// src/components/kedisiplinan/shared.tsx
// Helper & konstanta bersama untuk Modul Kedisiplinan Siswa.

import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Award,
  Trophy,
  Star,
  Medal,
  Sparkles,
} from 'lucide-react';
import type {
  KategoriPelanggaranLevel,
  KategoriPrestasiJenis,
  LevelSP,
  StatusSP,
  TingkatPrestasi,
} from '@/types/database';

// =============================================================================
// AKSES
// =============================================================================

export const KEDISIPLINAN_MANAGER_ROLES = [
  'admin',
  'kepala',
  'wakil_kepala',
  'kesiswaan',
  'bk',
];

export function isKedisiplinanManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return KEDISIPLINAN_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// KONSTANTA — THRESHOLD SP
// =============================================================================

export const THRESHOLD_SP: Record<LevelSP, number> = {
  SP1: 25,
  SP2: 50,
  SP3: 75,
};

/**
 * Rekomendasi level SP berdasarkan total poin pelanggaran.
 * Return null kalau belum mencapai SP1.
 */
export function getRekomendasiSP(totalPoinPelanggaran: number): LevelSP | null {
  if (totalPoinPelanggaran >= THRESHOLD_SP.SP3) return 'SP3';
  if (totalPoinPelanggaran >= THRESHOLD_SP.SP2) return 'SP2';
  if (totalPoinPelanggaran >= THRESHOLD_SP.SP1) return 'SP1';
  return null;
}

// =============================================================================
// BADGE STYLES — PELANGGARAN
// =============================================================================

export function getLevelPelanggaranBadge(level: KategoriPelanggaranLevel | string | null | undefined ): string {
  switch (level) {
    case 'Ringan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Sedang':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'Berat':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getLevelPelanggaranIcon(level: KategoriPelanggaranLevel | string | null | undefined) {
  switch (level) {
    case 'Ringan':
      return AlertCircle;
    case 'Sedang':
      return AlertTriangle;
    case 'Berat':
      return ShieldAlert;
    default:
      return AlertCircle;
  }
}

// =============================================================================
// BADGE STYLES — PRESTASI
// =============================================================================

export function getKategoriPrestasiBadge(jenis: KategoriPrestasiJenis | string | null): string {
  switch (jenis) {
    case 'Akademik':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Non-Akademik':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Keagamaan':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'Lainnya':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getTingkatPrestasiBadge(tingkat: TingkatPrestasi | string | null): string {
  switch (tingkat) {
    case 'Sekolah':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Kecamatan':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Kabupaten':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Provinsi':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Nasional':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Internasional':
      return 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 border-amber-500/40';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getTingkatPrestasiIcon(tingkat: TingkatPrestasi | string | null) {
  switch (tingkat) {
    case 'Internasional':
      return Sparkles;
    case 'Nasional':
      return Trophy;
    case 'Provinsi':
      return Medal;
    case 'Kabupaten':
    case 'Kecamatan':
      return Award;
    case 'Sekolah':
      return Star;
    default:
      return Award;
  }
}

// =============================================================================
// BADGE STYLES — SP
// =============================================================================

export function getLevelSPBadge(level: LevelSP | string | null): string {
  switch (level) {
    case 'SP1':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'SP2':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'SP3':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusSPBadge(status: StatusSP | string | null): string {
  switch (status) {
    case 'Aktif':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Dicabut':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// POIN COLOR — untuk angka
// =============================================================================

/**
 * Warna angka poin pelanggaran berdasarkan level.
 */
export function getPoinPelanggaranColor(poin: number): string {
  if (poin >= 30) return 'text-rose-400';
  if (poin >= 15) return 'text-orange-400';
  return 'text-amber-400';
}

/**
 * Warna angka poin prestasi berdasarkan tingkat.
 */
export function getPoinPrestasiColor(poin: number): string {
  if (poin >= 60) return 'text-amber-300';
  if (poin >= 40) return 'text-blue-400';
  if (poin >= 25) return 'text-teal-400';
  return 'text-emerald-400';
}

/**
 * Warna poin bersih (untuk rekap).
 */
export function getPoinBersihColor(poin: number): string {
  if (poin >= THRESHOLD_SP.SP3) return 'text-rose-400';
  if (poin >= THRESHOLD_SP.SP2) return 'text-orange-400';
  if (poin >= THRESHOLD_SP.SP1) return 'text-amber-400';
  if (poin > 0) return 'text-emerald-400';
  return 'text-slate-300';
}

// =============================================================================
// FORMATTERS
// =============================================================================

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeWib(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// KONSTANTA OPSI
// =============================================================================

export const KATEGORI_PELANGGARAN_LEVELS: KategoriPelanggaranLevel[] = ['Ringan', 'Sedang', 'Berat'];
export const KATEGORI_PRESTASI_JENIS: KategoriPrestasiJenis[] = [
  'Akademik',
  'Non-Akademik',
  'Keagamaan',
  'Lainnya',
];
export const TINGKAT_PRESTASI_OPTIONS: TingkatPrestasi[] = [
  'Sekolah',
  'Kecamatan',
  'Kabupaten',
  'Provinsi',
  'Nasional',
  'Internasional',
];
export const LEVEL_SP_OPTIONS: LevelSP[] = ['SP1', 'SP2', 'SP3'];
export const STATUS_SP_OPTIONS: StatusSP[] = ['Aktif', 'Dicabut', 'Selesai'];

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';