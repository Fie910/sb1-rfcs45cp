// src/lib/pdf/pdfShared.ts

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { SEKOLAH_TAGLINE } from '@/constants/branding';

// =============================================================================
// TYPES & KONSTANTA WARNA
// =============================================================================
export type RGB = [number, number, number]; // 🆕 Tambah tipe RGB

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
  contentWidth: 170,
};

// 🆕 Palet Warna (Dengan tipe RGB yang tegas & tambahan slate200)
export const PDF_THEME: Record<'navy' | 'gold' | 'slate900' | 'slate600' | 'slate200' | 'slate100' | 'white' | 'black', RGB> = {
  navy: [15, 41, 82],       
  gold: [197, 155, 77],     
  slate900: [15, 23, 42],
  slate600: [71, 85, 105],
  slate200: [226, 232, 240], // 🆕 Tambahan slate200 (untuk garis tabel)
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
    weekday: 'long',
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
export async function drawKopSurat(
  doc: jsPDF,
  pengaturan: PengaturanSekolah,
  layout: PdfLayoutConstants = A4_LAYOUT
): Promise<number> {
  const { pageWidth, marginX } = layout;
  let y = 12;

  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', marginX, y, 24, 24);
      } catch {}
    }
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(pengaturan.nama_sekolah.toUpperCase(), pageWidth / 2, y + 7, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  if (pengaturan.alamat) {
    doc.text(pengaturan.alamat, pageWidth / 2, y + 13, { align: 'center' });
  }

  const kontakParts: string[] = [];
  if (pengaturan.telepon) kontakParts.push(`Telp: ${pengaturan.telepon}`);
  if (pengaturan.email) kontakParts.push(`Email: ${pengaturan.email}`);
  if (pengaturan.website) kontakParts.push(pengaturan.website);
  
  if (kontakParts.length > 0) {
    doc.setFontSize(8);
    doc.text(kontakParts.join(' · '), pageWidth / 2, y + 17, { align: 'center' });
  }

  y = 40;
  doc.setDrawColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, pageWidth - marginX, y);
  
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);

  doc.setTextColor(0);
  return y;
}

// =============================================================================
// PDF: FOOTER (Upgrade: Tagline + Metadata)
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
// PDF: WATERMARK LOGO (UPGRADE: Lebih Terlihat)
// =============================================================================
export async function drawWatermark(doc: jsPDF, logoUrl: string | null): Promise<void> {
  if (!logoUrl) return;
  const logoData = await loadImageAsDataUrl(logoUrl);
  if (!logoData) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Perbesar ukuran menjadi 140mm (sebelumnya 120mm)
  const size = 140; 
  const x = (pageWidth - size) / 2;
  const y = (pageHeight - size) / 2;

  // Simpan state grafis
  const currentGState = doc.saveGraphicsState();
  
  // ✅ Naikkan opacity dari 0.05 menjadi 0.12 (12%)
  const gState = new (doc as any).GState({ opacity: 0.24 });
  doc.setGState(gState);
  
  try {
    doc.addImage(logoData, 'PNG', x, y, size, size);
  } catch (err) {
    console.warn('Watermark gagal ditambahkan:', err);
  }

  // Kembalikan state
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.restoreGraphicsState();
}

  // Kembalikan ke state normal
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.restoreGraphicsState();
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