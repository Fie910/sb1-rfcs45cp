// src/components/mitra/shared.ts
// Helper & konstanta untuk Modul Mitra DUDI & MoU.

import type {
  JenisMitra, SkalaMitra, StatusMitra, JenisMou, StatusMou, JenisAktivitasMitra,
} from '@/types/database';

// =============================================================================
// BADGE STYLES
// =============================================================================
export function getStatusMitraBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Aktif':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Nonaktif':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Blacklist':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getJenisMitraBadge(jenis: string | null | undefined): string {
  switch (jenis) {
    case 'PT': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'CV': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Yayasan': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'Sekolah': return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Pemerintah': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'UMKM': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusMouBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Draft': return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Review': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Ttd': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Aktif': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Expired': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Diperpanjang': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'Dicabut': return 'bg-slate-700 text-slate-400 border-slate-600';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getJenisAktivitasBadge(jenis: string | null | undefined): string {
  switch (jenis) {
    case 'PKL': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'UKK': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Rekrutmen': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Pelatihan Guru':
    case 'Pelatihan Siswa':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'CSR': return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    case 'Kunjungan Industri': return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Guest Teacher': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getExpiryStatusBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Expired': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'H7': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'H30': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Aman': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getExpiryStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'Expired': return 'Expired';
    case 'H7': return 'H-7 hari';
    case 'H30': return 'H-30 hari';
    case 'Aman': return 'Aman';
    default: return '-';
  }
}

export function getRatingStars(rating: number | null | undefined): string {
  const r = rating ?? 0;
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

// =============================================================================
// FORMATTERS
// =============================================================================
export function formatTanggal(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTanggalPanjang(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRupiah(n: number | null | undefined): string {
  if (!n || n <= 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Hitung hari ke-expired (negatif = sudah lewat) */
export function daysToExpiry(tanggalSelesai: string | null | undefined): number {
  if (!tanggalSelesai) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${tanggalSelesai.split('T')[0]}T00:00:00+07:00`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// HELPER URL
// =============================================================================
export function buildWaLink(nomorHp: string | null | undefined, pesan: string): string {
  if (!nomorHp) return '#';
  const clean = nomorHp.replace(/\D/g, '').replace(/^0/, '62').replace(/^8/, '628');
  return `https://wa.me/${clean}?text=${encodeURIComponent(pesan)}`;
}

// =============================================================================
// AKSES
// =============================================================================
const MITRA_MANAGER_ROLES = [
  'admin', 'kepala', 'wakil_kepala', 'takola', 'staf_takola',
];

export function isMitraManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return MITRA_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================
export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';
