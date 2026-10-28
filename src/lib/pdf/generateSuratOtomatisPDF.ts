// src/lib/pdf/generateSuratOtomatisPDF.ts
import jsPDF from 'jspdf';
import { 
  A4_LAYOUT, drawKopSurat, drawFooter, fetchPengaturan, 
  PDF_THEME, drawWatermark, formatTanggalPanjang,
  buildVerifyUrl, drawQrVerifikasi, type PdfAction
} from './pdfShared';

export type SuratOtomatisData = {
  nomor_surat: string;
  jenis_surat_text: string; 
  tujuan: string;
  perihal: string;
  isi_surat: string;
  tembusan: string | null;
  tanggal_surat: string;
  verification_token: string;
};

export async function generateSuratOtomatisPDF(
  data: SuratOtomatisData, 
  action: PdfAction | 'blob' = 'save'
): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;
  const pengaturan = await fetchPengaturan(true);

  let y = await drawKopSurat(doc, pengaturan);

  // 1. JUDUL
  y += 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(`SURAT ${data.jenis_surat_text.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });

  // Garis Emas
  y += 2;
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);

  // Nomor
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Nomor: ${data.nomor_surat}`, pageWidth / 2, y, { align: 'center' });

  // 2. PEMBUKA
  y += 12;
  doc.setFontSize(11);
  const pembuka = `Yang bertanda tangan di bawah ini, Kepala ${pengaturan.nama_sekolah}, dengan ini menyampaikan ${data.jenis_surat_text.toLowerCase()} kepada:`;
  const pembukaLines = doc.splitTextToSize(pembuka, contentWidth);
  doc.text(pembukaLines, marginX, y);
  y += pembukaLines.length * 5 + 4;

  // 3. TUJUAN
  doc.setFont('helvetica', 'bold');
  doc.text('Yth. ', marginX, y);
  doc.text(data.tujuan, marginX + 10, y);
  y += 8;

  // 4. ISI SURAT
  doc.setFont('helvetica', 'normal');
  const isiLines = doc.splitTextToSize(data.isi_surat, contentWidth);
  isiLines.forEach((line: string) => {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }
    doc.text(line, marginX, y);
    y += 5.5;
  });
  y += 6;

  // 5. PENUTUP
  const penutup = 'Demikian surat ini disampaikan. Atas perhatian dan kerja sama Bapak/Ibu/Saudara/i, kami ucapkan terima kasih.';
  const penutupLines = doc.splitTextToSize(penutup, contentWidth);
  penutupLines.forEach((line: string) => {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }
    doc.text(line, marginX, y);
    y += 5.5;
  });
  y += 15;

  // 6. TANDA TANGAN & QR
  if (y > pageHeight - 80) { doc.addPage(); y = 30; }
  const rightX = pageWidth - marginX - 60;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sukahideng, ${formatTanggalPanjang(data.tanggal_surat)}`, rightX, y);
  y += 5;
  doc.text('Kepala Sekolah,', rightX, y);
  
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pengaturan.nama_kepsek ?? '-', rightX, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.nip_kepsek) doc.text(`NIP. ${pengaturan.nip_kepsek}`, rightX, y);

  // QR Code
  const qrSize = 25;
  const verifyUrl = buildVerifyUrl('surat', data.verification_token, null);
  await drawQrVerifikasi(doc, verifyUrl, marginX, y - 30, qrSize, ['Scan verifikasi', 'keaslian surat']);

  // 7. TEMBUSAN
  if (data.tembusan && data.tembusan.trim()) {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    y += 15; // Jarak dari TTD
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Tembusan:', marginX, y);
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    const tembusanLines = data.tembusan.split('\n').filter(t => t.trim());
    tembusanLines.forEach((line, idx) => {
      doc.text(`${idx + 1}. ${line}`, marginX + 3, y);
      y += 4;
    });
  }

  // 8. FOOTER & WATERMARK
  drawFooter(doc, pengaturan, A4_LAYOUT, `Surat ${data.jenis_surat_text} - ${data.perihal}`);
  await drawWatermark(doc, pengaturan.logo_url);

  // 9. OUTPUT
  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else if (action === 'blob') {
    return doc.output('blob');
  } else {
    const safeNomor = data.nomor_surat.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Surat_${data.jenis_surat_text}_${safeNomor}.pdf`);
  }
}