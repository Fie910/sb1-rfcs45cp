// src/components/sarpras/shared.tsx
// Helper & konstanta bersama untuk seluruh modul Inventaris Sarpras.

import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  Wrench,
  ShieldCheck,
} from 'lucide-react';

// =============================================================================
// AKSES
// =============================================================================

export const SARPRAS_MANAGER_ROLES = ['admin', 'kepala', 'wakil_kepala', 'sarpras'];

export function isSarprasManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return SARPRAS_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// BADGE STYLES
// =============================================================================

export function getKondisiBadge(kondisi: string | null): string {
  switch (kondisi) {
    case 'Baik':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Rusak Ringan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Rusak Berat':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusAsetBadge(status: string | null): string {
  switch (status) {
    case 'Aktif':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Dipinjam':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Perbaikan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Hilang':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Dihapus':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusPeminjamanBadge(status: string | null): string {
  switch (status) {
    case 'Dipinjam':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Dikembalikan':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Terlambat':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Hilang':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusPemeliharaanBadge(status: string | null): string {
  switch (status) {
    case 'Dijadwalkan':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Berlangsung':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Dibatalkan':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusPenghapusanBadge(status: string | null): string {
  switch (status) {
    case 'Menunggu':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Disetujui':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Ditolak':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Selesai':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getJenisPemeliharaanBadge(jenis: string | null): string {
  switch (jenis) {
    case 'Preventif':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Korektif':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Kalibrasi':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Inspeksi':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// ICON GETTERS
// =============================================================================

export function getKondisiIcon(kondisi: string | null) {
  switch (kondisi) {
    case 'Baik':
      return CheckCircle2;
    case 'Rusak Ringan':
      return AlertTriangle;
    case 'Rusak Berat':
      return XCircle;
    default:
      return Package;
  }
}

export function getStatusAsetIcon(status: string | null) {
  switch (status) {
    case 'Aktif':
      return CheckCircle2;
    case 'Dipinjam':
      return Send;
    case 'Perbaikan':
      return Wrench;
    case 'Hilang':
      return XCircle;
    case 'Dihapus':
      return ShieldCheck;
    default:
      return Clock;
  }
}

// =============================================================================
// FORMATTERS
// =============================================================================

/** Format Rp 1.234.567 */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format ringkas Rp 1,2 jt */
export function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value}`;
}

/** Format tanggal YYYY-MM-DD → "12 Sep 2026" */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Format timestamp → "12 Sep 2026, 14:30" */
export function formatDateTime(dateStr: string | null | undefined): string {
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
// KONSTANTA PILIHAN
// =============================================================================

export const SATUAN_OPTIONS = [
  'unit',
  'buah',
  'set',
  'lusin',
  'meter',
  'kg',
  'liter',
  'paket',
];

export const SUMBER_DANA_OPTIONS = [
  'BOS',
  'Komite',
  'Hibah',
  'Yayasan',
  'Pemerintah Daerah',
  'CSR',
  'Lainnya',
];

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';