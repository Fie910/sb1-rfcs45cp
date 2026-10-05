// src/lib/pdfColoredExport.ts
// Helper terpusat untuk export PDF berwarna — mirror tampilan aplikasi.
// Dipakai oleh semua halaman Rekap (Kesiswaan, Siswa, Guru, dst).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// =============================================================================
// TYPES
// =============================================================================
export type RGB = [number, number, number];

export type PdfColumn = {
  /** Label header kolom */
  header: string;
  /** Alignment body cell */
  halign?: 'left' | 'center' | 'right';
  /** Lebar kolom (mm atau 'auto') */
  width?: number | 'auto';
  /** Warna teks body (default: slate-900) */
  textColor?: RGB;
  /** Bold body cell */
  bold?: boolean;
  /** Custom formatter — return string yang akan ditampilkan */
  format?: (value: any, row: any) => string;
  /**
   * Callback untuk conditional coloring per cell.
   * Return { bg, text } untuk mengoverride warna, atau null untuk pakai default.
   */
  colorize?: (value: any, row: any) => { bg?: RGB; text?: RGB } | null;
};

export type PdfStatBox = {
  label: string;
  value: string | number;
  color: RGB;
};

export type PdfExportOptions = {
  /** Nama file (dengan/tanpa .pdf) */
  filename: string;
  /** Judul laporan */
  title: string;
  /** Subjudul (mis. periode) */
  subtitle?: string;
  /** Nama sekolah — kalau kosong pakai default */
  schoolName?: string;
  /** Alamat sekolah */
  schoolAddress?: string;
  /** Kotak KPI di atas tabel (opsional) */
  stats?: PdfStatBox[];
  /** Definisi kolom */
  columns: PdfColumn[];
  /** Data baris */
  rows: any[];
  /** Orientasi halaman — default 'l' (landscape) */
  orientation?: 'p' | 'l';
  /** Teks footer tambahan (opsional) */
  footerNote?: string;
};

// =============================================================================
// COLOR PALETTE
// =============================================================================
export const PDF_COLORS: Record<string, RGB> = {
  indigo: [79, 70, 229],
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
  slate900: [15, 23, 42],
  slate700: [51, 65, 85],
  slate500: [100, 116, 139],
  slate300: [203, 213, 225],
  slate100: [241, 245, 249],
  slate50: [248, 250, 252],
  white: [255, 255, 255],
  black: [0, 0, 0],
};

// =============================================================================
// HELPER — Warna Badge Persentase
// =============================================================================
/**
 * Return warna bg + text untuk badge persentase.
 * - ≥85% → hijau
 * - 75-84% → kuning
 * - <75%  → merah
 */
export function getPersenWarna(pct: number): { bg: RGB; text: RGB } {
  if (pct >= 85) return { bg: PDF_COLORS.emeraldLight, text: PDF_COLORS.emeraldDark };
  if (pct >= 75) return { bg: PDF_COLORS.amberLight, text: PDF_COLORS.amberDark };
  return { bg: PDF_COLORS.roseLight, text: PDF_COLORS.roseDark };
}

// =============================================================================
// HELPER — Format Tanggal ke PDF
// =============================================================================
export function formatTanggalPdf(d: string): string {
  const date = new Date(`${d}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// INTERNAL — Kotak Statistik
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
  // Background soft (12% color + 88% white)
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
    PDF_COLORS.slate500[0],
    PDF_COLORS.slate500[1],
    PDF_COLORS.slate500[2]
  );
  doc.text(label, x + w / 2, y + h - 2.5, { align: 'center' });
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
    schoolAddress = 'Sukahideng, Kab. Tasikmalaya, Jawa Barat',
    stats,
    columns,
    rows,
    orientation = 'l',
    footerNote,
  } = options;

  const doc = new jsPDF(orientation, 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;

  // ══════════════════════════════════════════════
  // 1. KOP SURAT
  // ══════════════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(
    PDF_COLORS.slate900[0],
    PDF_COLORS.slate900[1],
    PDF_COLORS.slate900[2]
  );
  doc.text(schoolName, pageWidth / 2, 13, { align: 'center' });

  if (schoolAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(
      PDF_COLORS.slate500[0],
      PDF_COLORS.slate500[1],
      PDF_COLORS.slate500[2]
    );
    doc.text(schoolAddress, pageWidth / 2, 18, { align: 'center' });
  }

  // Garis pemisah indigo
  doc.setDrawColor(
    PDF_COLORS.indigo[0],
    PDF_COLORS.indigo[1],
    PDF_COLORS.indigo[2]
  );
  doc.setLineWidth(0.8);
  doc.line(marginX, 21, pageWidth - marginX, 21);

  // ══════════════════════════════════════════════
  // 2. JUDUL + SUBJUDUL
  // ══════════════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(
    PDF_COLORS.slate900[0],
    PDF_COLORS.slate900[1],
    PDF_COLORS.slate900[2]
  );
  doc.text(title, pageWidth / 2, 29, { align: 'center' });

  let cursorY = 34;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(
      PDF_COLORS.slate500[0],
      PDF_COLORS.slate500[1],
      PDF_COLORS.slate500[2]
    );
    doc.text(subtitle, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 5;
  }

  // ══════════════════════════════════════════════
  // 3. KPI BOXES (opsional)
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
    if (col.textColor) {
      columnStyles[i].textColor = col.textColor;
    }
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
      textColor: PDF_COLORS.slate900,
    },
    headStyles: {
      fillColor: PDF_COLORS.indigo,
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
      // value yang ditampilkan (post-format)
      const value = data.cell.raw;
      const override = col.colorize(value, row);
      if (!override) return;

      if (override.bg) {
        data.cell.styles.fillColor = override.bg;
      }
      if (override.text) {
        data.cell.styles.textColor = override.text;
      }
    },
  });

  // ══════════════════════════════════════════════
  // 5. FOOTER DI SETIAP HALAMAN
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
    doc.setTextColor(
      PDF_COLORS.slate500[0],
      PDF_COLORS.slate500[1],
      PDF_COLORS.slate500[2]
    );

    const leftText = footerNote
      ? `${footerNote} · Dicetak: ${cetakTanggal}`
      : `Dicetak: ${cetakTanggal}`;
    doc.text(leftText, marginX, pageHeight - 6);

    doc.text(
      `Halaman ${i} dari ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // ══════════════════════════════════════════════
  // 6. SAVE
  // ══════════════════════════════════════════════
  const finalName = filename.toLowerCase().endsWith('.pdf')
    ? filename
    : `${filename}.pdf`;
  doc.save(finalName);
}