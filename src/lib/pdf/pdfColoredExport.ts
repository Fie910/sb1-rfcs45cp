// src/lib/pdf/pdfColoredExport.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { PDF_THEME, loadImageAsDataUrl, type RGB } from './pdfShared'; // 🆕 Import RGB dari pdfShared

// =============================================================================
// TYPES
// =============================================================================
// export type RGB = [number, number, number]; // Dihapus, pakai dari pdfShared

export type PdfColumn = {
  header: string;
  halign?: 'left' | 'center' | 'right';
  width?: number | 'auto';
  textColor?: RGB;
  bold?: boolean;
  format?: (value: any, row: any) => string;
  colorize?: (value: any, row: any) => { bg?: RGB; text?: RGB } | null;
};

export type PdfStatBox = {
  label: string;
  value: string | number;
  color: RGB;
};

type PdfSignature = {
  nama: string;
  nip?: string | null;
  jabatan?: string;
  kota?: string;
  tanggal?: string;
};

export type PdfExportOptions = {
  filename: string;
  title: string;
  subtitle?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolLogoUrl?: string | null;
  schoolContact?: string | null;
  stats?: PdfStatBox[];
  columns: PdfColumn[];
  rows: any[];
  orientation?: 'p' | 'l';
  footerNote?: string;
  signature?: PdfSignature;
};

// =============================================================================
// COLOR PALETTE
// =============================================================================
export const PDF_COLORS: Record<string, RGB> = {
  indigo: PDF_THEME.navy,
  indigoLight: [238, 242, 255],
  emerald: [16, 185, 129],
  emeraldLight: [209, 250, 229],
  emeraldDark: [6, 95, 70],
  amber: [245, 158, 11],
  amberLight: [254, 243, 199],
  amberDark: [120, 53, 15],
  blue: [59, 130, 246],
  blueLight: [219, 234, 254],
  blueDark: [30, 64, 175],
  rose: [239, 68, 68],
  roseLight: [254, 226, 226],
  roseDark: [153, 27, 27],
  purple: [168, 85, 247],
  purpleLight: [243, 232, 255],
  purpleDark: [107, 33, 168],
  teal: [20, 184, 166],
  tealLight: [204, 251, 241],
  tealDark: [15, 118, 110],
  
  slate900: PDF_THEME.slate900,
  slate700: [51, 65, 85],
  slate500: PDF_THEME.slate600,
  slate300: [203, 213, 225],
  slate100: PDF_THEME.slate100,
  slate50: [248, 250, 252],
  white: [255, 255, 255],
  black: [0, 0, 0],
};

// =============================================================================
// HELPER — Warna Badge
// =============================================================================
export function getPersenWarna(pct: number): { bg: RGB; text: RGB } {
  if (pct >= 85) return { bg: PDF_COLORS.emeraldLight, text: PDF_COLORS.emeraldDark };
  if (pct >= 75) return { bg: PDF_COLORS.amberLight, text: PDF_COLORS.amberDark };
  return { bg: PDF_COLORS.roseLight, text: PDF_COLORS.roseDark };
}

export function formatTanggalPdf(d: string): string {
  const date = new Date(`${d}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTanggalPanjangPdf(d: string): string {
  const date = new Date(`${d}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// HELPER — Fetch Kepala Sekolah
// =============================================================================
export async function fetchKepalaSekolahData(): Promise<{
  nama: string;
  nip: string | null;
} | null> {
  try {
    const { data: setting } = await supabase
      .from('pengaturan_sekolahs')
      .select('nama_kepsek, nip_kepsek')
      .limit(1)
      .maybeSingle();

    if (setting?.nama_kepsek) {
      return { nama: setting.nama_kepsek, nip: setting.nip_kepsek ?? null };
    }

    const { data: guru } = await supabase
      .from('gurus')
      .select('nama_lengkap, nip')
      .eq('role', 'kepala')
      .maybeSingle();

    if (guru?.nama_lengkap) {
      return { nama: guru.nama_lengkap, nip: guru.nip ?? null };
    }

    return null;
  } catch (err) {
    console.warn('[pdfColoredExport] Gagal fetch kepala sekolah:', err);
    return null;
  }
}

// =============================================================================
// INTERNAL — Draw Stat Box
// =============================================================================
function drawStatBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: RGB
) {
  const lightBg: RGB = [
    Math.round(color[0] * 0.12 + 255 * 0.88),
    Math.round(color[1] * 0.12 + 255 * 0.88),
    Math.round(color[2] * 0.12 + 255 * 0.88),
  ];

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(
    PDF_THEME.slate600[0],
    PDF_THEME.slate600[1],
    PDF_THEME.slate600[2]
  );
  doc.text(label, x + w / 2, y + h - 2.5, { align: 'center' });
}

// =============================================================================
// INTERNAL — Draw Signature
// =============================================================================
function drawSignatureBlock(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  signature: PdfSignature
): void {
  const marginX = 12;
  const rightX = pageWidth - marginX;

  const jabatan = signature.jabatan ?? 'Kepala Sekolah';
  const kota = signature.kota ?? 'Sukahideng';
  const tanggal = signature.tanggal ?? new Date().toISOString().slice(0, 10);

  const nipY = pageHeight - 20;
  const namaY = pageHeight - 25;
  const jabatanY = pageHeight - 50;
  const titimangsaY = pageHeight - 55;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(
    PDF_THEME.slate900[0],
    PDF_THEME.slate900[1],
    PDF_THEME.slate900[2]
  );
  doc.text(`${kota}, ${formatTanggalPanjangPdf(tanggal)}`, rightX, titimangsaY, {
    align: 'right',
  });

  doc.text(`${jabatan},`, rightX, jabatanY, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(signature.nama, rightX, namaY, { align: 'right' });

  if (signature.nip) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`NIP. ${signature.nip}`, rightX, nipY, { align: 'right' });
  }
}

// =============================================================================
// MAIN — EXPORT COLORED PDF
// =============================================================================
export function exportColoredPdf(options: PdfExportOptions): void {
  const {
    filename,
    title,
    subtitle,
    schoolName = 'SMK KH. A. WAHAB MUHSIN SUKAHIDENG',
    schoolAddress = 'Jl. Pahlawan KHZ Musthafa Sukarapih Sukarame Tasikmalaya Jawa Barat',
    schoolLogoUrl,
    schoolContact,
    stats,
    columns,
    rows,
    orientation = 'l',
    footerNote,
    signature,
  } = options;

  const doc = new jsPDF(orientation, 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;

  // ══════════════════════════════════════════════
  // 1. KOP SURAT + LOGO
  // ══════════════════════════════════════════════
  const hasLogo = Boolean(schoolLogoUrl);
  const logoSize = 18;
  const logoX = hasLogo ? marginX + 2 : 0;
  const logoY = 8;

  if (hasLogo && schoolLogoUrl) {
    try {
      doc.addImage(schoolLogoUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch {}
  }

  const textCenter = hasLogo
    ? marginX + (contentWidth + logoSize + 4) / 2
    : pageWidth / 2;

  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(schoolName, textCenter, 13, { align: 'center' });

  if (schoolAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    doc.text(schoolAddress, textCenter, 18, { align: 'center' });
  }

  if (schoolContact) {
    doc.setFontSize(8);
    doc.text(schoolContact, textCenter, 22, { align: 'center' });
  }

  // Garis Ganda
  doc.setDrawColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.setLineWidth(1.2);
  doc.line(marginX, 25, pageWidth - marginX, 25);
  
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX, 26.5, pageWidth - marginX, 26.5);

  // ══════════════════════════════════════════════
  // 2. JUDUL
  // ══════════════════════════════════════════════
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(title, pageWidth / 2, 35, { align: 'center' });

  let cursorY = 40;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    doc.text(subtitle, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 5;
  }

  // ══════════════════════════════════════════════
  // 3. KPI BOXES
  // ══════════════════════════════════════════════
  let tableStartY = cursorY + 4;

  if (stats && stats.length > 0) {
    const gap = 4;
    const boxW = (contentWidth - gap * (stats.length - 1)) / stats.length;
    const boxH = 17;
    const boxY = tableStartY;

    stats.forEach((s, i) => {
      const x = marginX + i * (boxW + gap);
      drawStatBox(doc, x, boxY, boxW, boxH, s.label, String(s.value), s.color);
    });

    tableStartY = boxY + boxH + 5;
  }

  // ══════════════════════════════════════════════
  // 4. TABEL
  // ══════════════════════════════════════════════
  const headers = columns.map((c) => c.header);
  const body = rows.map((row) =>
    columns.map((col) => {
      const rawValue = (row as any)[col.header];
      if (col.format) return col.format(rawValue, row);
      return rawValue ?? '-';
    })
  );

  const columnStyles: Record<number, any> = {};
  columns.forEach((col, i) => {
    columnStyles[i] = {
      halign: col.halign ?? 'left',
      cellWidth: col.width ?? 'auto',
      fontStyle: col.bold ? 'bold' : 'normal',
    };
    if (col.textColor) columnStyles[i].textColor = col.textColor;
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [headers],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: PDF_COLORS.slate300,
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
      textColor: PDF_THEME.slate900,
    },
    headStyles: {
      fillColor: PDF_THEME.navy,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.slate50,
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const colIndex = data.column.index;
      const col = columns[colIndex];
      if (!col?.colorize) return;

      const row = rows[data.row.index];
      const value = data.cell.raw;
      const override = col.colorize(value, row);
      if (!override) return;

      if (override.bg) data.cell.styles.fillColor = override.bg;
      if (override.text) data.cell.styles.textColor = override.text;
    },
  });

  // ══════════════════════════════════════════════
  // 5. SIGNATURE
  // ══════════════════════════════════════════════
  if (signature) {
    const lastTableY = (doc as any).lastAutoTable?.finalY ?? 0;
    const needY = pageHeight - 65;

    if (lastTableY > needY) {
      doc.addPage();
    }

    const currentPageHeight = doc.internal.pageSize.getHeight();
    drawSignatureBlock(doc, pageWidth, currentPageHeight, signature);
  }

  // ══════════════════════════════════════════════
  // 6. FOOTER
  // ══════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  const cetakTanggal = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);

    const leftText = footerNote
      ? `${footerNote} · Dicetak: ${cetakTanggal}`
      : `Dicetak: ${cetakTanggal}`;
    doc.text(leftText, marginX, pageHeight - 6);

    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - marginX, pageHeight - 6, {
      align: 'right',
    });
  }

  // ══════════════════════════════════════════════
  // 7. SAVE
  // ══════════════════════════════════════════════
  const finalName = filename.toLowerCase().endsWith('.pdf')
    ? filename
    : `${filename}.pdf`;
  doc.save(finalName);
}

// =============================================================================
// 🆕 ASYNC WRAPPER — Auto-fetch pengaturan + logo + kepsek
// =============================================================================
export async function exportColoredPdfBranded(
  options: Omit<PdfExportOptions, 'schoolName' | 'schoolAddress' | 'schoolLogoUrl' | 'schoolContact' | 'signature'> & {
    includeSignature?: boolean;
  }
): Promise<void> {
  let schoolName = 'SMK KH. A. WAHAB MUHSIN SUKAHIDENG';
  let schoolAddress = 'Jl. Pahlawan KHZ Musthafa Sukarapih Sukarame Tasikmalaya Jawa Barat';
  let schoolLogoUrl: string | null = null;
  let schoolContact: string | null = null;

  try {
    const { data } = await supabase
      .from('pengaturan_sekolahs') 
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      schoolName = data.nama_sekolah?.toUpperCase() ?? schoolName;
      schoolAddress = data.alamat ?? schoolAddress;

      const contactParts: string[] = [];
      if (data.telepon) contactParts.push(`Telp: ${data.telepon}`);
      if (data.email) contactParts.push(`Email: ${data.email}`);
      if (data.website) contactParts.push(data.website);
      schoolContact = contactParts.length > 0 ? contactParts.join(' · ') : null;

      if (data.logo_url) {
        schoolLogoUrl = await loadImageAsDataUrl(data.logo_url);
      }
    }
  } catch (err) {
    console.warn('[pdfColoredExport] Gagal fetch pengaturan:', err);
  }

  let signature: PdfSignature | undefined;
  if (options.includeSignature !== false) {
    const kepsek = await fetchKepalaSekolahData();
    if (kepsek) {
      signature = {
        nama: kepsek.nama,
        nip: kepsek.nip,
        jabatan: 'Kepala Sekolah',
        kota: 'Sukahideng',
      };
    }
  }

  exportColoredPdf({
    ...options,
    schoolName,
    schoolAddress,
    schoolLogoUrl,
    schoolContact,
    signature,
  });
}