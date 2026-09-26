// src/components/arsip/shared.ts
// Helper & konstanta untuk Modul Arsip Digital.

// =============================================================================
// BADGE STYLES
// =============================================================================
export function getStatusDokumenBadge(status: string | null | undefined): string {
  switch (status) {
    case 'Draft':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Aktif':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Obsolete':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Dicabut':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Selesai':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getKategoriBadge(warna: string | null | undefined): string {
  switch (warna) {
    case 'indigo': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'emerald': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'teal': return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'amber': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'blue': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'purple': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'cyan': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'rose': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'pink': return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getAksesLevelBadge(level: string | null | undefined): string {
  switch (level) {
    case 'Public':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Internal':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Confidential':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getStorageProviderBadge(provider: string | null | undefined): string {
  switch (provider) {
    case 'supabase': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'google_drive': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'dropbox': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'telegram': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'external': return 'bg-slate-800 text-slate-300 border-slate-700';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// FORMATTERS
// =============================================================================
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatTanggalArsip(dateStr: string | null | undefined): string {
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

// =============================================================================
// RETENSI HELPERS
// =============================================================================
/** Hitung selisih hari ke tanggal retensi (negatif = sudah lewat) */
export function daysToRetensi(tanggalRetensi: string | null | undefined): number {
  if (!tanggalRetensi) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${tanggalRetensi.split('T')[0]}T00:00:00+07:00`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Badge untuk status retensi */
export function getRetensiBadge(tanggalRetensi: string | null | undefined): {
  label: string;
  style: string;
} | null {
  const days = daysToRetensi(tanggalRetensi);
  if (days > 90) return null;
  if (days < 0) {
    return {
      label: `Lewat ${Math.abs(days)} hari`,
      style: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    };
  }
  if (days <= 30) {
    return {
      label: `${days}h lagi`,
      style: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    };
  }
  return {
    label: `${days}h lagi`,
    style: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };
}

/** Cek apakah dokumen siap dimusnahkan */
export function isSiapDimusnahkan(tanggalRetensi: string | null | undefined): boolean {
  return daysToRetensi(tanggalRetensi) <= 0;
}

// =============================================================================
// FILE HELPERS
// =============================================================================
/** Ambil icon berdasarkan MIME type */
export function getFileIcon(mimeType: string | null | undefined): string {
  if (!mimeType) return 'File';
  if (mimeType === 'application/pdf') return 'FileText';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'FileText';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Sheet';
  return 'File';
}

/** Cek apakah file bisa di-preview di browser */
export function isPreviewable(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return (
    mimeType === 'application/pdf' ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp'
  );
}

/** Cek apakah file gambar */
export function isImageFile(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
}

/** Cek apakah file PDF */
export function isPdfFile(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf';
}

// =============================================================================
// COMPRESSION HELPERS
// =============================================================================
/** Kompres gambar → WebP (mirip pola DokumenSection) */
export async function compressImageToWebP(
  file: File,
  quality = 0.8,
  maxWidth = 1600
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Blob error')); return; }
          const name = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          resolve(new File([blob], name, { type: 'image/webp' }));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('Image load error'));
  });
}

// =============================================================================
// AKSES
// =============================================================================
export const ARSIP_MANAGER_ROLES = [
  'admin', 'kepala', 'wakil_kepala', 'takola', 'staf_takola',
];

export const ARSIP_KATEGORI_MANAGER_ROLES = [
  'admin', 'kepala', 'wakil_kepala',
];

export function isArsipManager(role: string | null | undefined): boolean {
  if (!role) return false;
  return ARSIP_MANAGER_ROLES.includes(role.toLowerCase());
}

export function canManageKategori(role: string | null | undefined): boolean {
  if (!role) return false;
  return ARSIP_KATEGORI_MANAGER_ROLES.includes(role.toLowerCase());
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================
export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';