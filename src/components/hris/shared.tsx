// src/components/hris/shared.tsx
// Helper & konstanta bersama untuk Modul HRIS.

import {
  ShieldCheck,
  FileText,
  GraduationCap,
  Briefcase,
  Users,
  User,
  UserCheck,
  Crown,
  Award,
  Sparkles,
} from 'lucide-react';
import type {
  Agama,
  GolonganDarah,
  HubunganKeluarga,
  JenisPTK,
  JenisPekerjaan,
  JenjangPendidikan,
  KategoriDokumen,
  StatusKepegawaian,
  StatusPernikahan,
} from '@/types/database';

// =============================================================================
// AKSES
// =============================================================================
export const HR_MANAGER_ROLES = ['admin', 'kepala', 'wakil_kepala', 'takola'];

export function isHrManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return HR_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// KONSTANTA OPSI
// =============================================================================
export const STATUS_KEPEGAWAIAN_OPTIONS: StatusKepegawaian[] = [
  'Tetap', 'Kontrak', 'Honorer', 'Magang', 'GTT/PTT',
];

export const JENIS_PTK_OPTIONS: JenisPTK[] = [
  'Guru', 'Kepala Sekolah', 'Wakil Kepala', 'Kepala Divisi',
  'Staf Administrasi', 'Pustakawan', 'Laboran', 'Satpam', 'Kebersihan', 'Lainnya',
];

export const AGAMA_OPTIONS: Agama[] = [
  'Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya',
];

export const GOLONGAN_DARAH_OPTIONS: GolonganDarah[] = ['A', 'B', 'AB', 'O'];

export const STATUS_PERNIKAHAN_OPTIONS: StatusPernikahan[] = [
  'Belum Menikah', 'Menikah', 'Cerai Hidup', 'Cerai Mati',
];

export const JENJANG_PENDIDIKAN_OPTIONS: JenjangPendidikan[] = [
  'SD', 'SMP', 'SMA/SMK', 'D3', 'D4', 'S1', 'S2', 'S3',
];

export const JENIS_PEKERJAAN_OPTIONS: JenisPekerjaan[] = ['Internal', 'Eksternal'];

export const HUBUNGAN_KELUARGA_OPTIONS: HubunganKeluarga[] = [
  'Ayah', 'Ibu', 'Suami', 'Istri', 'Anak', 'Saudara', 'Lainnya',
];

export const KATEGORI_DOKUMEN_OPTIONS: KategoriDokumen[] = [
  'SK Pengangkatan',
  'SK Kenaikan Pangkat',
  'SK Berkala',
  'Sertifikat Pendidik',
  'Sertifikat Pelatihan',
  'Ijazah',
  'Transkrip Nilai',
  'KTP',
  'KK',
  'NPWP',
  'BPJS Kesehatan',
  'BPJS Ketenagakerjaan',
  'Buku Rekening',
  'Kontrak Kerja',
  'Surat Tugas',
  'Piagam Penghargaan',
  'Lainnya',
];

/** Dokumen wajib untuk semua pegawai (untuk kelengkapan tracker) */
export const DOKUMEN_WAJIB: KategoriDokumen[] = [
  'KTP',
  'KK',
  'Ijazah',
  'SK Pengangkatan',
];

/** Dokumen wajib untuk pegawai dengan status tertentu */
export const DOKUMEN_WAJIB_BERDASARKAN_STATUS: Record<string, KategoriDokumen[]> = {
  Tetap: ['Sertifikat Pendidik', 'NPWP', 'BPJS Kesehatan', 'Buku Rekening'],
  Kontrak: ['Kontrak Kerja', 'BPJS Kesehatan', 'Buku Rekening'],
  Honorer: ['Buku Rekening'],
  'GTT/PTT': ['Buku Rekening'],
  Magang: [],
};

// =============================================================================
// BADGE STYLES
// =============================================================================
export function getStatusKepegawaianBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Tetap':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Kontrak':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Honorer':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'GTT/PTT':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'Magang':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getJenisPtkBadge(jenis: string | null | undefined): string {
  switch (jenis) {
    case 'Guru':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Kepala Sekolah':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Wakil Kepala':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Kepala Divisi':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Pustakawan':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'Laboran':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getKategoriDokumenBadge(kat: KategoriDokumen | string | null | undefined): string {
  if (!kat) return 'bg-slate-800 text-slate-300 border-slate-700';
  if (kat.startsWith('SK')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
  if (kat.startsWith('Sertifikat')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (['KTP', 'KK', 'NPWP'].includes(kat)) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (kat.startsWith('BPJS')) return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  if (['Ijazah', 'Transkrip Nilai'].includes(kat)) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  if (['Kontrak Kerja', 'Buku Rekening'].includes(kat)) return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  if (kat === 'Piagam Penghargaan') return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

export function getDokumenExpiryBadge(tanggalExpired: string | null | undefined): {
  label: string;
  style: string;
} | null {
  if (!tanggalExpired) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${tanggalExpired.split('T')[0]}T00:00:00+07:00`);
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Expired', style: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  }
  if (diffDays <= 30) {
    return {
      label: `${diffDays}h lagi`,
      style: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    };
  }
  if (diffDays <= 90) {
    return {
      label: `${diffDays}h lagi`,
      style: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    };
  }
  return null;
}

export function getJenjangBadge(jenjang: JenjangPendidikan | string | null | undefined): string {
  switch (jenjang) {
    case 'S3':
      return 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 border-amber-500/40';
    case 'S2':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'S1':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'D4':
    case 'D3':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'SMA/SMK':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// ICON GETTERS
// =============================================================================
export function getJenjangIcon(jenjang: JenjangPendidikan | string | null | undefined) {
  switch (jenjang) {
    case 'S3':
      return Crown;
    case 'S2':
      return Award;
    case 'S1':
      return GraduationCap;
    case 'D4':
    case 'D3':
      return GraduationCap;
    default:
      return GraduationCap;
  }
}

export function getHubunganIcon(hubungan: HubunganKeluarga | string | null | undefined) {
  switch (hubungan) {
    case 'Suami':
    case 'Istri':
      return UserCheck;
    case 'Anak':
      return Sparkles;
    case 'Ayah':
    case 'Ibu':
      return Users;
    default:
      return User;
  }
}

export function getKategoriDokumenIcon(kat: KategoriDokumen | string | null | undefined) {
  if (!kat) return FileText;
  if (kat.startsWith('SK')) return ShieldCheck;
  if (kat.startsWith('Sertifikat')) return Award;
  if (['Ijazah', 'Transkrip Nilai'].includes(kat)) return GraduationCap;
  if (['Kontrak Kerja'].includes(kat)) return Briefcase;
  return FileText;
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

export function hitungUmur(tanggalLahir: string | null | undefined): number | null {
  if (!tanggalLahir) return null;
  const today = new Date();
  const lahir = new Date(`${tanggalLahir.split('T')[0]}T00:00:00+07:00`);
  let umur = today.getFullYear() - lahir.getFullYear();
  const monthDiff = today.getMonth() - lahir.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < lahir.getDate())) {
    umur--;
  }
  return umur;
}

export function hitungMasaKerja(tanggalBergabung: string | null | undefined): string {
  if (!tanggalBergabung) return '-';
  const today = new Date();
  const mulai = new Date(`${tanggalBergabung.split('T')[0]}T00:00:00+07:00`);
  let years = today.getFullYear() - mulai.getFullYear();
  let months = today.getMonth() - mulai.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years <= 0 && months <= 0) {
    const days = Math.floor((today.getTime() - mulai.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} hari`;
  }
  if (years <= 0) return `${months} bulan`;
  if (months === 0) return `${years} tahun`;
  return `${years} tahun ${months} bulan`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// =============================================================================
// HITUNG KELENGKAPAN PROFIL
// =============================================================================
type ProfilFields = {
  nik?: string | null;
  tanggal_lahir?: string | null;
  no_hp?: string | null;
  alamat_ktp?: string | null;
  bank_nomor_rekening?: string | null;
  bpjs_kesehatan_no?: string | null;
  nama_kontak_darurat?: string | null;
  foto_profil_url?: string | null;
};

/** Return % kelengkapan profil (0-100) */
export function hitungKelengkapanProfil(profil: ProfilFields | null | undefined): number {
  if (!profil) return 0;
  const checks: boolean[] = [
    Boolean(profil.nik),
    Boolean(profil.tanggal_lahir),
    Boolean(profil.no_hp),
    Boolean(profil.alamat_ktp),
    Boolean(profil.bank_nomor_rekening),
    Boolean(profil.bpjs_kesehatan_no),
    Boolean(profil.nama_kontak_darurat),
    Boolean(profil.foto_profil_url),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================
export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';