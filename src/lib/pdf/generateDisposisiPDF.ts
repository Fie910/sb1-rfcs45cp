// src/lib/pdf/generateDisposisiPDF.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  A4_LAYOUT, drawFooter, drawKopSurat, fetchPengaturan, 
  PDF_THEME, drawWatermark, tanggalHariIni, type PdfAction 
} from './pdfShared';

// =============================================================================
// TYPES
// =============================================================================
export type SuratDisposisiData = {
  no_surat: string;
  asal_surat: string;
  tanggal_surat: string;
  perihal: string;
  sifat: 'Biasa' | 'Penting' | 'Rahasia' | 'Sangat Segera';
};

export type DisposisiData = {
  id: string;
  tanggal_disposisi: string;
  penerima_disposisi: string;
  isi_disposisi: string;
  catatan?: string | null;
  status: string;
  surat?: SuratDisposisiData;
};

type Props = {
  surat?: SuratDisposisiData;
  disposisi: DisposisiData;
  namaSekolah?: string;
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================
export async function generateDisposisiPDF(data: Props, action: PdfAction = 'save'): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX } = A4_LAYOUT;
  const pengaturan = await fetchPengaturan(true);

  const surat = data.surat || data.disposisi.surat || {
    no_surat: '-',
    asal_surat: '-',
    tanggal_surat: '-',
    perihal: data.disposisi.catatan || '-',
    sifat: 'Biasa' as const,
  };

  // 1. KOP SURAT
  let y = await drawKopSurat(doc, pengaturan);

  // 2. JUDUL
  y += 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('LEMBAR DISPOSISI SURAT MASUK', pageWidth / 2, y, { align: 'center' });

  // Garis Emas di bawah judul
  y += 2;
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 50, y, pageWidth / 2 + 50, y);
  y += 8;

  // 3. TABEL IDENTITAS SURAT
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      lineColor: [PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]], // Navy
      lineWidth: 0.2,
      textColor: PDF_THEME.slate900,
    },
    headStyles: {
      fillColor: [PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold', fillColor: [248, 250, 252] }, // Label kiri (Slate 50)
      1: { cellWidth: 60 },
      2: { cellWidth: 35, fontStyle: 'bold', fillColor: [248, 250, 252] }, // Label kanan
      3: { cellWidth: 'auto' },
    },
    body: [
      [`Surat Dari`, surat.asal_surat, `No. Surat`, surat.no_surat],
      [`Tgl. Surat`, surat.tanggal_surat, `Sifat Surat`, surat.sifat],
      [{ content: 'Perihal', colSpan: 1 }, { content: surat.perihal, colSpan: 3 }],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // 4. TABEL INSTRUKSI DISPOSISI
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 4,
      lineColor: [PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]],
      lineWidth: 0.2,
      textColor: PDF_THEME.slate900,
      valign: 'top',
    },
    headStyles: {
      fillColor: [PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 70 }, // Diteruskan Kepada
      1: { cellWidth: 'auto' }, // Instruksi
    },
    head: [['Diteruskan Kepada (Disposisi)', 'Petunjuk / Instruksi Kepala Sekolah']],
    body: [
      [
        `📌 ${data.disposisi.penerima_disposisi}\n\nTgl Disposisi: ${data.disposisi.tanggal_disposisi}`,
        data.disposisi.isi_disposisi
      ]
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // 5. TANDA TANGAN (Kanan Bawah)
  if (y > pageHeight - 70) { doc.addPage(); y = 20; }
  
  const rightX = pageWidth - marginX - 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(PDF_THEME.slate900[0], PDF_THEME.slate900[1], PDF_THEME.slate900[2]);
  
  doc.text(`Sukahideng, ${tanggalHariIni()}`, rightX, y, { align: 'right' });
  y += 5;
  doc.text('Kepala Sekolah,', rightX, y, { align: 'right' });
  
  y += 25;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(pengaturan.nama_kepsek ?? '-', rightX, y, { align: 'right' });
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.nip_kepsek) {
    doc.text(`NIP. ${pengaturan.nip_kepsek}`, rightX, y, { align: 'right' });
  }

  // 6. WATERMARK & FOOTER
  await drawWatermark(doc, pengaturan.logo_url);
  drawFooter(doc, pengaturan, A4_LAYOUT, `Lembar Disposisi Surat Masuk - ${surat.no_surat}.`);

  // 7. OUTPUT
  const fileName = `Disposisi_${surat.no_surat.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
}