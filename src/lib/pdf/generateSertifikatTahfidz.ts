// src/lib/pdf/generateSertifikatTahfidz.ts
// Sertifikat Tahfidz A4 Landscape dengan desain mewah (Navy & Gold).

import jsPDF from 'jspdf';
import {
  fetchPengaturan,
  generateQrDataUrl,
  loadImageAsDataUrl,
  buildVerifyUrl,
  tanggalHariIni,
  PDF_THEME,
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

export async function generateSertifikatTahfidz(data: SertifikatTahfidzData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();   // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210

  const pengaturan = await fetchPengaturan(true);

  // ===========================================================================
  // 1. BACKGROUND & BORDER (Navy & Gold)
  // ===========================================================================
  // Bingkai Luar (Navy, Tebal)
  doc.setDrawColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.setLineWidth(3);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Bingkai Dalam (Gold, Tipis)
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28);

  // Ornamen Sudut (Gold)
  doc.setFillColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  const cornerSize = 4;
  // Kiri atas
  doc.rect(10, 10, cornerSize, cornerSize, 'F');
  // Kanan atas
  doc.rect(pageWidth - 10 - cornerSize, 10, cornerSize, cornerSize, 'F');
  // Kiri bawah
  doc.rect(10, pageHeight - 10 - cornerSize, cornerSize, cornerSize, 'F');
  // Kanan bawah
  doc.rect(pageWidth - 10 - cornerSize, pageHeight - 10 - cornerSize, cornerSize, cornerSize, 'F');

  // ===========================================================================
  // 2. KOP SEKOLAH (Tengah Atas)
  // ===========================================================================
  let cursorY = 25;

  // Logo di Tengah (Proporsional 30x30 mm)
  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', pageWidth / 2 - 15, cursorY, 30, 30);
      } catch { /* ignore */ }
    }
  }

  cursorY += 35;
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(pengaturan.nama_sekolah.toUpperCase(), pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  if (pengaturan.alamat) {
    doc.text(pengaturan.alamat, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 4;
  }
  const kontakParts = [];
  if (pengaturan.telepon) kontakParts.push(`Telp: ${pengaturan.telepon}`);
  if (pengaturan.email) kontakParts.push(`Email: ${pengaturan.email}`);
  if (kontakParts.length > 0) {
    doc.setFontSize(8);
    doc.text(kontakParts.join(' · '), pageWidth / 2, cursorY, { align: 'center' });
  }

  // Garis Pemisah Kop (Gold)
  cursorY += 5;
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);

  // ===========================================================================
  // 3. JUDUL SERTIFIKAT
  // ===========================================================================
  cursorY += 15;
  doc.setFont('times', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('SERTIFIKAT', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.text('TAHFIDZ AL-QURAN', pageWidth / 2, cursorY, { align: 'center' });

  if (data.nomor_sertifikat) {
    cursorY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    doc.text(`Nomor: ${data.nomor_sertifikat}`, pageWidth / 2, cursorY, { align: 'center' });
  }

  // ===========================================================================
  // 4. NAMA SISWA
  // ===========================================================================
  cursorY += 15;
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  doc.text('Diberikan kepada:', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(data.siswa.nama_lengkap, pageWidth / 2, cursorY, { align: 'center' });

  // Garis Emas di bawah nama
  cursorY += 3;
  const textWidth = doc.getTextWidth(data.siswa.nama_lengkap);
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - textWidth / 2 - 5, cursorY, pageWidth / 2 + textWidth / 2 + 5, cursorY);

  cursorY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  doc.text(`NISN: ${data.siswa.nisn} · Kelas ${data.siswa.kelas}`, pageWidth / 2, cursorY, { align: 'center' });

  // ===========================================================================
  // 5. PENCAPAIAN
  // ===========================================================================
  cursorY += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Atas pencapaiannya dalam menghafal Al-Quran:', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 10;
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.text(data.pencapaian, pageWidth / 2, cursorY, { align: 'center' });

  // Statistik
  if (data.total_halaman || data.nilai_rata) {
    cursorY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
    const parts = [];
    if (data.total_halaman) parts.push(`Total ${data.total_halaman.toFixed(1)} halaman hafalan`);
    if (data.nilai_rata) parts.push(`Rata-rata nilai ${data.nilai_rata.toFixed(1)}`);
    if (parts.length > 0) {
      doc.text(parts.join(' · '), pageWidth / 2, cursorY, { align: 'center' });
    }
  }

  // ===========================================================================
  // 6. FOOTER: TANGGAL, TTD, QR
  // ===========================================================================
  const footerY = pageHeight - 45;
  const rightX = pageWidth - 40;

  // TTD Kanan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(PDF_THEME.slate900[0], PDF_THEME.slate900[1], PDF_THEME.slate900[2]);
  
  const tanggal = data.tanggal_terbit
    ? new Date(`${data.tanggal_terbit}T00:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })
    : tanggalHariIni();
  
  doc.text(`Sukahideng, ${tanggal}`, rightX, footerY, { align: 'right' });
  doc.text(`${data.penandatangan?.jabatan ?? 'Kepala Sekolah'},`, rightX, footerY + 5, { align: 'right' });

  // Nama Kepsek (Bold, Times)
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  const namaKepsek = data.penandatangan?.nama ?? pengaturan.nama_kepsek ?? '-';
  doc.text(namaKepsek, rightX, footerY + 30, { align: 'right' });

  // NIP
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const nipKepsek = data.penandatangan?.nip ?? pengaturan.nip_kepsek;
  if (nipKepsek) {
    doc.text(`NIP. ${nipKepsek}`, rightX, footerY + 35, { align: 'right' });
  }

  // QR Kiri
  if (data.verification_token) {
    const qrSize = 24;
    const qrX = 40;
    const qrY = pageHeight - 45;
    const verifyUrl = buildVerifyUrl('surat', data.verification_token, null);

    try {
      const qrDataUrl = await generateQrDataUrl(verifyUrl, qrSize * 8);
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text('Scan untuk verifikasi', qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });
      doc.text('keaslian sertifikat', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
      doc.setTextColor(0);
    } catch { /* skip */ }
  }

  // ===========================================================================
  // 7. SAVE
  // ===========================================================================
  const safeNama = data.siswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const safePencapaian = data.pencapaian.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  doc.save(`Sertifikat_Tahfidz_${safeNama}_${safePencapaian}.pdf`);
}