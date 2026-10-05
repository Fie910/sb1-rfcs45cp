// src/lib/pdfShared.ts
// Shared helper untuk semua generator PDF (notulensi, surat izin, QR arsip).
// Mengurangi duplikasi KOP surat, footer, QR, formatter, dan fetch pengaturan.

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from './supabase';

// =============================================================================
// TYPES
// =============================================================================

export type PengaturanSekolah = {
  nama_sekolah: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  nama_kepsek: string | null;
  nip_kepsek: string | null;
};

export type PdfLayoutConstants = {
  pageWidth: number;
  pageHeight: number;
  marginX: number;
  contentWidth: number;
};

export const A4_LAYOUT: PdfLayoutConstants = {
  pageWidth: 210,
  pageHeight: 297,
  marginX: 20,
  contentWidth: 170, // 210 - 20*2
};

// =============================================================================
// FORMATTERS
// =============================================================================

/** Format "2026-10-05" → "Senin, 5 Oktober 2026" */
export function formatTanggalPanjang(dateStr: string): string {
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

/** Format "2026-10-05" → "5 Oktober 2026" */
export function formatTanggalPendek(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Format "2026-10-05" → "5 Okt 2026" */
export function formatTanggalSuperPendek(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format jam "07:30:00" → "07:30" */
export function formatJam(t: string | null | undefined): string {
  if (!t) return '-';
  return t.slice(0, 5);
}

/** Tanggal hari ini dalam format "5 Oktober 2026" (untuk tanda tangan). */
export function tanggalHariIni(): string {
  return new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// SUPABASE
// =============================================================================

/**
 * Ambil pengaturan sekolah. Kalau includeKepsek = true, juga fetch nama & NIP kepsek dari gurus.
 */
export async function fetchPengaturan(includeKepsek = false): Promise<PengaturanSekolah> {
  const { data } = await supabase
    .from('pengaturan_sekolahs')
    .select('*')
    .limit(1)
    .maybeSingle();

  let namaKepsek = data?.nama_kepsek ?? null;
  let nipKepsek = data?.nip_kepsek ?? null;

  if (includeKepsek && !namaKepsek) {
    const { data: kepsek } = await supabase
      .from('gurus')
      .select('nama_lengkap, nip')
      .eq('role', 'kepala')
      .maybeSingle();
    namaKepsek = kepsek?.nama_lengkap ?? '.......................';
    nipKepsek = kepsek?.nip ?? null;
  }

  return {
    nama_sekolah: data?.nama_sekolah ?? 'SMK KH. A. Wahab Muhsin Sukahideng',
    alamat: data?.alamat ?? null,
    telepon: data?.telepon ?? null,
    email: data?.email ?? null,
    website: data?.website ?? null,
    logo_url: data?.logo_url ?? null,
    nama_kepsek: namaKepsek,
    nip_kepsek: nipKepsek,
  };
}

// =============================================================================
// IMAGE & QR
// =============================================================================

/** Fetch gambar dari URL → data URL (base64). Berguna untuk jsPDF.addImage(). */
export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Generate QR code → data URL (PNG base64). */
export async function generateQrDataUrl(text: string, size = 300): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
}

// =============================================================================
// VERIFICATION URL
// =============================================================================

export type VerifikasiType = 'arsip' | 'notulensi' | 'surat';

/** Build URL verifikasi dengan opsi hash short (untuk deteksi perubahan). */
export function buildVerifyUrl(
  type: VerifikasiType,
  token: string,
  contentHash?: string | null
): string {
  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://app-anda.com';
  const hashShort = contentHash ? contentHash.slice(0, 16) : '';
  const query = hashShort ? `?h=${hashShort}` : '';
  return `${baseUrl}/verifikasi-${type}/${token}${query}`;
}

// =============================================================================
// PDF: KOP SURAT
// =============================================================================

/**
 * Gambar KOP surat (logo + nama sekolah + alamat + kontak + garis).
 * Return nilai Y setelah KOP selesai (siap untuk konten berikutnya).
 */
export async function drawKopSurat(
  doc: jsPDF,
  pengaturan: PengaturanSekolah,
  layout: PdfLayoutConstants = A4_LAYOUT
): Promise<number> {
  const { pageWidth, marginX, contentWidth } = layout;
  let y = 15;

  // Logo
  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', marginX, y, 22, 22);
      } catch {
        // ignore logo invalid
      }
    }
  }

  // Nama sekolah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pengaturan.nama_sekolah.toUpperCase(), pageWidth / 2, y + 6, {
    align: 'center',
  });

  // Alamat
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.alamat) {
    const alamatLines = doc.splitTextToSize(pengaturan.alamat, contentWidth - 40);
    doc.text(alamatLines, pageWidth / 2, y + 12, { align: 'center' });
    y += alamatLines.length * 4;
  }

  // Kontak
  const kontakParts: string[] = [];
  if (pengaturan.telepon) kontakParts.push(`Telp: ${pengaturan.telepon}`);
  if (pengaturan.email) kontakParts.push(`Email: ${pengaturan.email}`);
  if (pengaturan.website) kontakParts.push(pengaturan.website);
  if (kontakParts.length > 0) {
    doc.setFontSize(8);
    doc.text(kontakParts.join(' · '), pageWidth / 2, y + 14, { align: 'center' });
  }

  // Garis pembatas tebal + tipis
  y = 38;
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 1.2, pageWidth - marginX, y + 1.2);

  return y;
}

// =============================================================================
// PDF: FOOTER
// =============================================================================

/**
 * Gambar footer di semua halaman.
 */
export function drawFooter(
  doc: jsPDF,
  pengaturan: PengaturanSekolah,
  layout: PdfLayoutConstants = A4_LAYOUT,
  customMessage?: string
): void {
  const { pageWidth, pageHeight, contentWidth } = layout;
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    const message =
      customMessage ??
      `Dokumen ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}.`;
    doc.text(
      `${message} Halaman ${i}/${totalPages}.`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center', maxWidth: contentWidth }
    );
  }
  doc.setTextColor(0);
}

// =============================================================================
// PDF: QR VERIFIKASI
// =============================================================================

/**
 * Gambar QR code verifikasi + caption di posisi (x, y).
 */
export async function drawQrVerifikasi(
  doc: jsPDF,
  verifyUrl: string,
  x: number,
  y: number,
  size: number,
  captions: string[] = ['Scan untuk verifikasi', 'keaslian dokumen']
): Promise<void> {
  try {
    const qrDataUrl = await generateQrDataUrl(verifyUrl, size * 8);
    doc.addImage(qrDataUrl, 'PNG', x, y, size, size);

    doc.setFontSize(6);
    doc.setTextColor(120);
    captions.forEach((line, i) => {
      doc.text(line, x + size / 2, y + size + 2.5 + i * 2.5, { align: 'center' });
    });
    doc.setTextColor(0);
  } catch {
    // Fallback: kotak placeholder
    doc.setDrawColor(200);
    doc.rect(x, y, size, size);
  }
}