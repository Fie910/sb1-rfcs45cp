// src/lib/pdf/generateSertifikatTahfidz.ts
// Generate sertifikat tahfidz A4 landscape dengan kop + QR verifikasi.

import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import {
  fetchPengaturan,
  generateQrDataUrl,
  loadImageAsDataUrl,
  buildVerifyUrl,
  tanggalHariIni,
} from './pdfShared';

// =============================================================================
// TYPES
// =============================================================================
export type SertifikatTahfidzData = {
  siswa: {
    nama_lengkap: string;
    nisn: string;
    kelas: string;
  };
  pencapaian: string;               // "Juz 30 Lengkap" / "5 Juz" / dll
  deskripsi?: string;                // Paragraf tambahan (opsional)
  nilai_rata?: number | null;        // Nilai rata-rata tahfidz
  total_halaman?: number | null;     // Total halaman hafalan
  verification_token?: string;       // Token verify QR
  nomor_sertifikat?: string;         // Opsional nomor resmi
  tanggal_terbit?: string;           // YYYY-MM-DD
  penandatangan?: {
    nama: string;
    nip: string | null;
    jabatan: string;                 // default "Kepala Sekolah"
  };
};

// =============================================================================
// MAIN
// =============================================================================
export async function generateSertifikatTahfidz(
  data: SertifikatTahfidzData
): Promise<void> {
  // A4 LANDSCAPE
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();   // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210

  const pengaturan = await fetchPengaturan(true);

  // ===========================================================================
  // 1. BACKGROUND BORDER ARTISTIK
  // ===========================================================================
  // Outer border hijau emerald
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(2.5);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // Inner border tebal tipis
  doc.setDrawColor(6, 95, 70); // emerald-800
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Ornamen sudut (kotak kecil di 4 sudut)
  const cornerSize = 6;
  doc.setFillColor(16, 185, 129);
  // Kiri atas
  doc.rect(8, 8, cornerSize, cornerSize, 'F');
  // Kanan atas
  doc.rect(pageWidth - 8 - cornerSize, 8, cornerSize, cornerSize, 'F');
  // Kiri bawah
  doc.rect(8, pageHeight - 8 - cornerSize, cornerSize, cornerSize, 'F');
  // Kanan bawah
  doc.rect(pageWidth - 8 - cornerSize, pageHeight - 8 - cornerSize, cornerSize, cornerSize, 'F');

  // ===========================================================================
  // 2. KOP SEKOLAH (di atas)
  // ===========================================================================
  let cursorY = 26;

  // Logo di kiri (kalau ada)
  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 22, 22, 20, 20);
      } catch { /* ignore */ }
    }
  }

  // Nama sekolah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(
    pengaturan.nama_sekolah.toUpperCase(),
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );

  cursorY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (pengaturan.alamat) {
    doc.text(pengaturan.alamat, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 4;
  }

  const kontakParts: string[] = [];
  if (pengaturan.telepon) kontakParts.push(`Telp: ${pengaturan.telepon}`);
  if (pengaturan.email) kontakParts.push(`Email: ${pengaturan.email}`);
  if (kontakParts.length > 0) {
    doc.setFontSize(8);
    doc.text(kontakParts.join(' · '), pageWidth / 2, cursorY, { align: 'center' });
  }

  // Garis pemisah kop
  cursorY += 6;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.line(30, cursorY, pageWidth - 30, cursorY);

  // ===========================================================================
  // 3. JUDUL SERTIFIKAT
  // ===========================================================================
  cursorY = 60;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(16, 185, 129);
  doc.text('SERTIFIKAT', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 11;
  doc.setFontSize(16);
  doc.setTextColor(6, 95, 70);
  doc.text('TAHFIDZ AL-QURAN', pageWidth / 2, cursorY, { align: 'center' });

  // Nomor sertifikat
  if (data.nomor_sertifikat) {
    cursorY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Nomor: ${data.nomor_sertifikat}`, pageWidth / 2, cursorY, {
      align: 'center',
    });
  }

  // ===========================================================================
  // 4. PEMBUKA
  // ===========================================================================
  cursorY = 95;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'Diberikan kepada:',
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );

  // ===========================================================================
  // 5. NAMA SISWA
  // ===========================================================================
  cursorY += 13;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(15, 23, 42);
  doc.text(data.siswa.nama_lengkap, pageWidth / 2, cursorY, { align: 'center' });

  // Garis bawah nama
  cursorY += 2;
  const textWidth = doc.getTextWidth(data.siswa.nama_lengkap);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(
    pageWidth / 2 - textWidth / 2 - 5,
    cursorY,
    pageWidth / 2 + textWidth / 2 + 5,
    cursorY
  );

  // NISN & Kelas
  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `NISN: ${data.siswa.nisn} · Kelas ${data.siswa.kelas}`,
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );

  // ===========================================================================
  // 6. PENCAPAIAN
  // ===========================================================================
  cursorY += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'Atas pencapaiannya dalam menghafal Al-Quran:',
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );

  cursorY += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129);
  doc.text(data.pencapaian, pageWidth / 2, cursorY, { align: 'center' });

  // Deskripsi tambahan
  if (data.deskripsi) {
    cursorY += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const descLines = doc.splitTextToSize(data.deskripsi, pageWidth - 100);
    doc.text(descLines, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += descLines.length * 4;
  }

  // ===========================================================================
  // 7. STATISTIK (kalau ada)
  // ===========================================================================
  if (data.total_halaman || data.nilai_rata) {
    cursorY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const parts: string[] = [];
    if (data.total_halaman) parts.push(`Total ${data.total_halaman.toFixed(1)} halaman hafalan`);
    if (data.nilai_rata) parts.push(`Rata-rata nilai ${data.nilai_rata.toFixed(1)}`);
    if (parts.length > 0) {
      doc.text(parts.join(' · '), pageWidth / 2, cursorY, { align: 'center' });
    }
  }

  // ===========================================================================
  // 8. FOOTER: TANGGAL + TTD + QR
  // ===========================================================================
  const footerY = pageHeight - 45;

  // Titimangsa (kanan)
  const rightX = pageWidth - 45;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const tanggal = data.tanggal_terbit
    ? new Date(`${data.tanggal_terbit}T00:00:00+07:00`).toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : tanggalHariIni();
  doc.text(`Sukahideng, ${tanggal}`, rightX, footerY, { align: 'right' });

  // Jabatan
  doc.text(`${data.penandatangan?.jabatan ?? 'Kepala Sekolah'},`, rightX, footerY + 5, {
    align: 'right',
  });

  // Nama + NIP (bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const namaKepsek = data.penandatangan?.nama ?? pengaturan.nama_kepsek ?? '-';
  doc.text(namaKepsek, rightX, footerY + 30, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const nipKepsek = data.penandatangan?.nip ?? pengaturan.nip_kepsek;
  if (nipKepsek) {
    doc.text(`NIP. ${nipKepsek}`, rightX, footerY + 35, { align: 'right' });
  }

  // QR di kiri bawah
  if (data.verification_token) {
    const qrSize = 24;
    const qrX = 35;
    const qrY = pageHeight - 45;
    const verifyUrl = buildVerifyUrl('surat', data.verification_token, null);

    try {
      const qrDataUrl = await generateQrDataUrl(verifyUrl, qrSize * 8);
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text('Scan untuk verifikasi', qrX + qrSize / 2, qrY + qrSize + 2.5, {
        align: 'center',
      });
      doc.text('keaslian sertifikat', qrX + qrSize / 2, qrY + qrSize + 5, {
        align: 'center',
      });
      doc.setTextColor(0);
    } catch { /* skip QR */ }
  }

  // ===========================================================================
  // 9. SAVE
  // ===========================================================================
  const safeNama = data.siswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const safePencapaian = data.pencapaian.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const fileName = `Sertifikat_Tahfidz_${safeNama}_${safePencapaian}.pdf`;
  doc.save(fileName);
}