// src/lib/pdf/generateSertifikatTahfidz.ts
import jsPDF from 'jspdf';
import {
  fetchPengaturan, generateQrDataUrl, loadImageAsDataUrl,
  buildVerifyUrl, tanggalHariIni, PDF_THEME, drawWatermark,
  type PdfAction, // ✅ Import dari pdfShared
} from './pdfShared';

export type SertifikatTahfidzData = {
  siswa: { nama_lengkap: string; nisn: string; kelas: string; };
  pencapaian: string;
  deskripsi?: string;
  nilai_rata?: number | null;
  total_halaman?: number | null;
  verification_token?: string;
  nomor_sertifikat?: string;
  tanggal_terbit?: string;
  penandatangan?: { nama: string; nip: string | null; jabatan: string; };
};

export async function generateSertifikatTahfidz(
  data: SertifikatTahfidzData, 
  action: PdfAction = 'save'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();   // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210

  const pengaturan = await fetchPengaturan(true);

  // ===========================================================================
  // 1. BACKGROUND & BORDER (Luxury)
  // ===========================================================================
  doc.setDrawColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.setLineWidth(4);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(1);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  doc.setFillColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  const cSize = 5;
  doc.rect(8, 8, cSize, cSize, 'F');
  doc.rect(pageWidth - 8 - cSize, 8, cSize, cSize, 'F');
  doc.rect(8, pageHeight - 8 - cSize, cSize, cSize, 'F');
  doc.rect(pageWidth - 8 - cSize, pageHeight - 8 - cSize, cSize, cSize, 'F');

  // ===========================================================================
  // 2. WATERMARK LOGO
  // ===========================================================================
  if (pengaturan.logo_url) {
    await drawWatermark(doc, pengaturan.logo_url);
  }

  // ===========================================================================
  // 3. KOP SEKOLAH
  // ===========================================================================
  let cursorY = 28;

  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', pageWidth / 2 - 15, cursorY, 30, 30);
      } catch { /* ignore */ }
    }
  }

  cursorY += 36;
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(pengaturan.nama_sekolah.toUpperCase(), pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  if (pengaturan.alamat) {
    doc.text(pengaturan.alamat, pageWidth / 2, cursorY, { align: 'center' });
  }

  // ===========================================================================
  // 4. JUDUL SERTIFIKAT
  // ===========================================================================
  cursorY += 15;
  doc.setFont('times', 'bold');
  doc.setFontSize(44);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('SERTIFIKAT', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.text('TAHFIDZ AL-QURAN', pageWidth / 2, cursorY, { align: 'center' });

  if (data.nomor_sertifikat) {
    cursorY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    doc.text(`Nomor: ${data.nomor_sertifikat}`, pageWidth / 2, cursorY, { align: 'center' });
  }

  // ===========================================================================
  // 5. NAMA SISWA
  // ===========================================================================
  cursorY += 15;
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  doc.text('Diberikan kepada:', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 14;
  doc.setFont('times', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(data.siswa.nama_lengkap, pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 4;
  const textWidth = doc.getTextWidth(data.siswa.nama_lengkap);
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - textWidth / 2 - 10, cursorY, pageWidth / 2 + textWidth / 2 + 10, cursorY);

  cursorY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  doc.text(`NISN: ${data.siswa.nisn} · Kelas ${data.siswa.kelas}`, pageWidth / 2, cursorY, { align: 'center' });

  // ===========================================================================
  // 6. PENCAPAIAN
  // ===========================================================================
  cursorY += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Atas pencapaiannya dalam menghafal Al-Quran:', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.text(data.pencapaian, pageWidth / 2, cursorY, { align: 'center' });

  if (data.total_halaman || data.nilai_rata) {
    cursorY += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    const parts = [];
    if (data.total_halaman) parts.push(`${data.total_halaman.toFixed(1)} halaman hafalan`);
    if (data.nilai_rata) parts.push(`Rata-rata nilai ${data.nilai_rata.toFixed(1)}`);
    if (parts.length > 0) {
      doc.text(parts.join('  •  '), pageWidth / 2, cursorY, { align: 'center' });
    }
  }

  // ===========================================================================
  // 7. FOOTER: TTD, QR & GOLD SEAL
  // ===========================================================================
  const footerY = pageHeight - 45;
  const rightX = pageWidth - 50;
  const leftX = 50;

  // --- GOLD SEAL (Kiri) ---
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(2);
  doc.circle(leftX, footerY + 5, 18, 'S');
  doc.setLineWidth(0.5);
  doc.circle(leftX, footerY + 5, 15, 'S');
  
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.text('SEGEL', leftX, footerY + 3, { align: 'center' });
  doc.text('RESMI', leftX, footerY + 8, { align: 'center' });
  doc.setFontSize(7);
  doc.text('TAHFIDZ', leftX, footerY + 12, { align: 'center' });
  
  // --- TTD KANAN ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(PDF_THEME.slate900[0], PDF_THEME.slate900[1], PDF_THEME.slate900[2]);
  
  const tanggal = data.tanggal_terbit ? new Date(`${data.tanggal_terbit}T00:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }) : tanggalHariIni();
  
  doc.text(`Sukahideng, ${tanggal}`, rightX, footerY, { align: 'right' });
  doc.text(`${data.penandatangan?.jabatan ?? 'Kepala Sekolah'},`, rightX, footerY + 6, { align: 'right' });

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  const namaKepsek = data.penandatangan?.nama ?? pengaturan.nama_kepsek ?? '-';
  doc.text(namaKepsek, rightX, footerY + 32, { align: 'right' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  doc.line(rightX - 60, footerY + 35, rightX, footerY + 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const nipKepsek = data.penandatangan?.nip ?? pengaturan.nip_kepsek;
  if (nipKepsek) {
    doc.text(`NIP. ${nipKepsek}`, rightX, footerY + 39, { align: 'right' });
  }

  // --- QR CODE ---
  if (data.verification_token) {
    const qrSize = 22;
    const qrX = pageWidth / 2 - qrSize / 2;
    const qrY = pageHeight - 40;
    const verifyUrl = buildVerifyUrl('surat', data.verification_token, null);

    try {
      const qrDataUrl = await generateQrDataUrl(verifyUrl, qrSize * 8);
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text('Scan Verifikasi', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });
    } catch { /* skip */ }
  }

  // ===========================================================================
  // 8. OUTPUT
  // ===========================================================================
  const safeNama = data.siswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const safePencapaian = data.pencapaian.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const fileName = `Sertifikat_Tahfidz_${safeNama}_${safePencapaian}.pdf`;

  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
}