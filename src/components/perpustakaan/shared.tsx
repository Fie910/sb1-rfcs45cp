// src/components/perpustakaan/shared.tsx
// Helper & konstanta bersama untuk Modul Perpustakaan.

import {
  Book,
  BookOpen,
  BookMarked,
  Library,
  Newspaper,
  FileText,
} from 'lucide-react';
import type {
  KondisiBuku,
  JenisSerial,
  StatusAnggota,
  StatusPeminjamanPerpus,
  TipeAnggota,
} from '@/types/database';

// =============================================================================
// AKSES
// =============================================================================

const PUSTAKAWAN_ROLES = ['admin', 'kepala', 'wakil_kepala', 'pustakawan'];

export function isPustakawan(role: string | null | undefined): boolean {
  if (!role) return false;
  return PUSTAKAWAN_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// KONFIGURASI
// =============================================================================

/** Durasi peminjaman default (hari) */
export const DURASI_PINJAM_HARI = 7;

/** Maksimal perpanjangan */
//export const MAX_PERPANJANGAN = 1;

/** Denda per hari keterlambatan (Rupiah) */
export const DENDA_PER_HARI = 500;

/** Durasi keanggotaan siswa (bulan) */
export const DURASI_KEANGGOTAAN_BULAN = 12;

// =============================================================================
// BADGE STYLES
// =============================================================================

export function getKondisiBukuBadge(kondisi: KondisiBuku | string | null | undefined): string {
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

export function getStatusAnggotaBadge(status: StatusAnggota | string | null | undefined): string {
  switch (status) {
    case 'Aktif':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Nonaktif':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    case 'Diblock':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Expired':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStatusPeminjamanBadge(
  status: StatusPeminjamanPerpus | string | null | undefined
): string {
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

export function getTipeAnggotaBadge(tipe: TipeAnggota | string | null | undefined): string {
  switch (tipe) {
    case 'Siswa':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Guru':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Tendik':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Umum':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getJenisSerialBadge(jenis: JenisSerial | string | null | undefined): string {
  switch (jenis) {
    case 'Majalah':
      return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    case 'Jurnal':
      return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    case 'Koran':
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'Buletin':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}
export function getStatusBadgeInventarisasi(status: string | null | undefined): string {
  switch (status) {
    case 'Draft':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Final':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// ICON GETTERS
// =============================================================================

export function getJenisSerialIcon(jenis: JenisSerial | string | null | undefined) {
  switch (jenis) {
    case 'Majalah':
      return BookMarked;
    case 'Jurnal':
      return FileText;
    case 'Koran':
      return Newspaper;
    case 'Buletin':
      return BookOpen;
    default:
      return Library;
  }
}

/** Return Lucide icon sesuai warna kategori (untuk fallback cover) */
//export function getBookIcon() {
  //return Book;
}

// =============================================================================
// HELPERS — TANGGAL & DENDA
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

export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Hitung tanggal jatuh tempo dari tanggal pinjam.
 * Return string YYYY-MM-DD.
 */
export function calculateDueDate(tanggalPinjam: string, hari: number = DURASI_PINJAM_HARI): string {
  const d = new Date(`${tanggalPinjam}T00:00:00+07:00`);
  d.setDate(d.getDate() + hari);
  return d.toISOString().split('T')[0];
}

/**
 * Hitung hari keterlambatan dari tanggal jatuh tempo sampai hari ini.
 * Return 0 kalau tidak telat.
 */
export function calculateHariTerlambat(tanggalJatuhTempo: string): number {
  const due = new Date(`${tanggalJatuhTempo.split('T')[0]}T00:00:00+07:00`).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = now.getTime() - due;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

/**
 * Hitung denda berdasarkan hari terlambat.
 */
export function calculateDenda(hariTerlambat: number, perHari: number = DENDA_PER_HARI): number {
  return hariTerlambat * perHari;
}

/**
 * Hitung sisa hari sebelum jatuh tempo.
 * Return negatif kalau sudah lewat.
 */
export function sisaHariSebelumJatuhTempo(tanggalJatuhTempo: string): number {
  const due = new Date(`${tanggalJatuhTempo.split('T')[0]}T00:00:00+07:00`).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = due - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * True jika sudah melewati tanggal jatuh tempo (belum dikembalikan).
 */
export function isOverdue(tanggalJatuhTempo: string | null | undefined, status?: string): boolean {
  if (!tanggalJatuhTempo) return false;
  if (status === 'Dikembalikan') return false;
  return calculateHariTerlambat(tanggalJatuhTempo) > 0;
}

// =============================================================================
// KONSTANTA OPSI
// =============================================================================

export const KONDISI_BUKU_OPTIONS: KondisiBuku[] = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

export const TIPE_ANGGOTA_OPTIONS: TipeAnggota[] = ['Siswa', 'Guru', 'Tendik', 'Umum'];

export const STATUS_ANGGOTA_OPTIONS: StatusAnggota[] = ['Aktif', 'Nonaktif', 'Diblock', 'Expired'];

export const JENIS_SERIAL_OPTIONS: JenisSerial[] = [
  'Majalah',
  'Jurnal',
  'Koran',
  'Buletin',
  'Lainnya',
];

export const BAHASA_OPTIONS = [
  'Indonesia',
  'Inggris',
  'Arab',
  'Mandarin',
  'Jepang',
  'Lainnya',
];

// =============================================================================
// AUTO-GENERATE KODE
// =============================================================================

/**
 * Generate kode buku berdasarkan kategori Dewey.
 * Format: BKU-{DEWEY}-{SEQ}
 */
export function generateKodeBuku(kodeDewey: string | null | undefined, seq: number): string {
  const prefix = `BKU-${kodeDewey ?? '000'}`;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate kode anggota berdasarkan tipe.
 * Format: AGT-{TIPE}-{SEQ}
 */
export function generateKodeAnggota(tipe: TipeAnggota, seq: number): string {
  const prefix = tipe.toUpperCase().slice(0, 3);
  return `AGT-${prefix}-${String(seq).padStart(4, '0')}`;
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';