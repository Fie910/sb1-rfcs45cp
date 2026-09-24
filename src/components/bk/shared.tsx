// src/components/bk/shared.tsx
// Helper & konstanta bersama untuk modul Bimbingan & Konseling.

import {
  User,
  Users,
  GraduationCap,
  MessageCircle,
} from 'lucide-react';
import type {
  BidangBK,
  StatusKonseling,
  StatusCurhat,
  StatusRujukan,
  TingkatUrgensi,
  TipeKonseling,
} from '@/types/database';

// =============================================================================
// AKSES
// =============================================================================

export const BK_MANAGER_ROLES = ['admin', 'kepala_sekolah', 'wakil_kepala', 'bk'];

export function isBkManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return BK_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// BADGE STYLES
// =============================================================================

export function getBidangBadge(bidang: BidangBK | string | null): string {
  switch (bidang) {
    case 'Pribadi':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'Sosial':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Belajar':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Karier':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusKonselingBadge(status: StatusKonseling | string | null): string {
  switch (status) {
    case 'Diajukan':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Dijadwalkan':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Berlangsung':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Batal':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusCurhatBadge(status: StatusCurhat | string | null): string {
  switch (status) {
    case 'Baru':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Dibaca':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Dibalas':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusRujukanBadge(status: StatusRujukan | string | null): string {
  switch (status) {
    case 'Baru':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Ditangani':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Dirujuk Eksternal':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getUrgensiBadge(urgensi: TingkatUrgensi | string | null): string {
  switch (urgensi) {
    case 'Rendah':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Sedang':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Tinggi':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Darurat':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// ICON HELPERS
// =============================================================================

export function getTipeKonselingIcon(tipe: TipeKonseling | string | null) {
  switch (tipe) {
    case 'Individual':
    case 'Online':
      return User;
    case 'Kelompok':
      return Users;
    case 'Klasikal':
      return GraduationCap;
    default:
      return MessageCircle;
  }
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

export function formatWaktuRange(
  mulai: string | null | undefined,
  selesai: string | null | undefined
): string {
  if (!mulai && !selesai) return '-';
  const m = mulai?.slice(0, 5) ?? '';
  const s = selesai?.slice(0, 5) ?? '';
  if (m && s) return `${m} - ${s} WIB`;
  return m || s;
}

// =============================================================================
// KONSTANTA OPSI
// =============================================================================

export const BIDANG_OPTIONS: BidangBK[] = ['Pribadi', 'Sosial', 'Belajar', 'Karier'];
export const TIPE_KONSELING_OPTIONS: TipeKonseling[] = [
  'Individual',
  'Kelompok',
  'Klasikal',
  'Online',
];
export const STATUS_KONSELING_OPTIONS: StatusKonseling[] = [
  'Diajukan',
  'Dijadwalkan',
  'Berlangsung',
  'Selesai',
  'Batal',
];
export const URGENSI_OPTIONS: TingkatUrgensi[] = ['Rendah', 'Sedang', 'Tinggi', 'Darurat'];
export const SUMBER_RUJUKAN_OPTIONS = [
  'Wali Kelas',
  'Kesiswaan',
  'Guru Mapel',
  'Orang Tua',
  'Inisiatif BK',
] as const;

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';