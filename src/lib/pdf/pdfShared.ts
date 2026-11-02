// src/lib/pdf/pdfShared.ts

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { SEKOLAH_TAGLINE } from '@/constants/branding';

// =============================================================================
// HELPER KOMPRESI GAMBAR (Bypass CORS & Optimasi Ukuran)
// =============================================================================

async function compressImageToBase64(
  url: string | null | undefined,
  format: 'jpeg' | 'png' = 'jpeg',
  maxWidth = 150, // Diturunkan jadi 150px
  quality = 0.7   // Kualitas diturunkan ke 0.7
): Promise<string | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      if (format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(`image/${format}`, quality));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// =============================================================================
// TYPES & KONSTANTA WARNA
// =============================================================================
export type RGB = [number, number, number];
export type PdfAction = 'save' | 'preview';

export type PengaturanSekolah = {
  nama_sekolah: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  logo_pemda_url: string | null;
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
  contentWidth: 170,
};

// 🆕 Palet Warna (Dengan tipe RGB yang tegas & tambahan slate200)
export const PDF_THEME: Record<'navy' | 'gold' | 'slate900' | 'slate600' | 'slate200' | 'slate100' | 'white' | 'black', RGB> = {
  navy: [15, 41, 82],
  gold: [197, 155, 77],
  slate900: [15, 23, 42],
  slate600: [71, 85, 105],
  slate200: [226, 232, 240],
  slate100: [241, 245, 249],
  white: [255, 255, 255],
  black: [0, 0, 0],
};

// =============================================================================
// FORMATTERS
// =============================================================================
export function formatTanggalPanjang(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatJam(t: string | null | undefined): string {
  if (!t) return '-';
  return t.slice(0, 5);
}

export function tanggalHariIni(): string {
  return new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// SUPABASE & IMAGE
// =============================================================================
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
    logo_pemda_url: data?.logo_pemda_url ?? null,
    nama_kepsek: namaKepsek,
    nip_kepsek: nipKepsek,
  };
}

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
export async function drawKopSurat(doc: jsPDF, pengaturan: any): Promise<number> {
  const { pageWidth, marginX, contentWidth } = A4_LAYOUT;
  let y = 12;

  // ✅ Logo disesuaikan ke ukuran 250px (tidak pecah), kualitas 0.8 (file kecil)
  const logoKiri = await compressImageToBase64(pengaturan.logo_pemda_url, 'jpeg', 250, 0.8);
  const logoKanan = await compressImageToBase64(pengaturan.logo_url, 'jpeg', 250, 0.8);

  if (logoKiri) {
    doc.addImage(logoKiri, 'JPEG', marginX, y - 5, 25, 25);
  }
  if (logoKanan) {
    doc.addImage(logoKanan, 'JPEG', pageWidth - marginX - 22, y - 5, 26, 26);
  }

  // Teks Kop (TEMA WARNA TETAP)
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('PEMERINTAH PROVINSI JAWA BARAT', pageWidth / 2, y, { align: 'center' }); y += 5;
  doc.text('DINAS PENDIDIKAN', pageWidth / 2, y, { align: 'center' }); y += 5;
  doc.text('YAYASAN KH. ZAINAL MUHSIN SUKAHIDENG', pageWidth / 2, y, { align: 'center' }); y += 6;

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('SMK KH. A. WAHAB MUHSIN', pageWidth / 2, y, { align: 'center' }); y += 5;

  doc.setFontSize(12);
  doc.setFont('times', 'italic');
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('TERAKREDITASI "A"', pageWidth / 2, y, { align: 'center' }); y += 6.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  const alamat = pengaturan.alamat_sekolah || 'Jln. Pahlawan KHZ. Musthafa Sukarapih Sukarame Tasikmalaya 46461 ';
  const email = pengaturan.email_sekolah || 'Email: smk.kh.a.wahabmuhsin@gmail.com';
  doc.text(`${alamat} | ${email}`, pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.setDrawColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, pageWidth - marginX, y);

  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);

  doc.setTextColor(0);
  return y + 10;
}

// =============================================================================
// PDF: FOOTER
// =============================================================================
export function drawFooter(
  doc: jsPDF,
  pengaturan: PengaturanSekolah,
  layout: PdfLayoutConstants = A4_LAYOUT,
  customMessage?: string
): void {
  const { pageWidth, pageHeight, contentWidth, marginX } = layout;
  const totalPages = doc.getNumberOfPages();
  const cetakTanggal = tanggalHariIni();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // --- Garis Pemisah (Slate 300) ---
    doc.setDrawColor(PDF_THEME.slate200[0], PDF_THEME.slate200[1], PDF_THEME.slate200[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    // --- Row 1: Metadata (Kiri) & Halaman (Kanan) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);

    const message = customMessage ?? `Dokumen ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}.`;
    const leftText = `${message} · Dicetak: ${cetakTanggal}`;

    doc.text(leftText, marginX, pageHeight - 9);
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 9, { align: 'right' });

    // --- Row 2: Tagline (Tengah, Italic Serif) ---
    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.text(`—  ${SEKOLAH_TAGLINE}  —`, pageWidth / 2, pageHeight - 4.5, { align: 'center' });
  }
  doc.setTextColor(0);
}

// =============================================================================
// PDF: WATERMARK LOGO (Semua Halaman)
// =============================================================================

export async function drawWatermark(doc: jsPDF, logoUrl: string | null) {
  if (!logoUrl) return;

  // Watermark ukuran 150px
  const watermark = await compressImageToBase64(logoUrl, 'png', 150, 1);
  if (!watermark) return;

  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const size = 120; // Ukuran gambar di kertas A4 (dalam mm)
  const x = (pageWidth - size) / 2;
  const y = (pageHeight - size) / 2;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    const gState = new (doc as any).GState({ opacity: 0.1 });
    doc.setGState(gState);

    // Gunakan kompresi 'FAST' pada jsPDF untuk watermark
    doc.addImage(watermark, 'PNG', x, y, size, size, undefined, 'FAST');

    doc.setGState(new (doc as any).GState({ opacity: 1 }));
    doc.restoreGraphicsState();
  }
}

// =============================================================================
// PDF: QR VERIFIKASI
// =============================================================================
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

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    captions.forEach((line, i) => {
      doc.text(line, x + size / 2, y + size + 2.5 + i * 2.5, { align: 'center' });
    });
    doc.setTextColor(0);
  } catch {
    doc.setDrawColor(200);
    doc.rect(x, y, size, size);
  }
}