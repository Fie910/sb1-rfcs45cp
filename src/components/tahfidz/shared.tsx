// src/components/tahfidz/shared.tsx
// Helper & konstanta untuk modul Tahfidz Quran.

import type { KualitasHafalan, JenisSetoran } from '@/types/database';

// =============================================================================
// AKSES / ROLE
// =============================================================================

export type GuruRoleFields = {
  role?: string | null;
  role2?: string | null;
  role3?: string | null;
};

const MANAGER_ROLES = ['admin', 'kepala', 'wakil_kepala'];

/**
 * Cek apakah user boleh kelola modul Tahfidz.
 * - Manager (admin/kepala/wakil) → selalu bisa
 * - Guru dengan role2 atau role3 = 'tahfidz' → bisa
 */
export function isTahfidzManager(guru: GuruRoleFields | null | undefined): boolean {
  if (!guru) return false;
  const roles = [guru.role, guru.role2, guru.role3]
    .map((r) => (r ?? '').toLowerCase())
    .filter(Boolean);
  return roles.some((r) => MANAGER_ROLES.includes(r) || r === 'tahfidz');
}

/**
 * Cek apakah user adalah guru tahfidz (khusus, bukan admin).
 */
export function isGuruTahfidz(guru: GuruRoleFields | null | undefined): boolean {
  if (!guru) return false;
  const roles = [guru.role, guru.role2, guru.role3]
    .map((r) => (r ?? '').toLowerCase())
    .filter(Boolean);
  return roles.includes('tahfidz');
}

// =============================================================================
// BADGE STYLES
// =============================================================================

export function getJenisSetoranBadge(jenis: JenisSetoran | string | null | undefined): string {
  switch (jenis) {
    case 'Tahfidz':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Murojaah':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getKualitasBadge(kualitas: KualitasHafalan | string | null | undefined): string {
  switch (kualitas) {
    case 'Lancar':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Cukup':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Perlu Ulang':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getNilaiBadge(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined) return 'text-slate-500';
  if (nilai >= 90) return 'text-emerald-400';
  if (nilai >= 80) return 'text-teal-400';
  if (nilai >= 70) return 'text-amber-400';
  if (nilai >= 60) return 'text-orange-400';
  return 'text-rose-400';
}

// =============================================================================
// FORMATTERS
// =============================================================================

export function formatTanggalShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTanggalLong(dateStr: string | null | undefined): string {
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

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';