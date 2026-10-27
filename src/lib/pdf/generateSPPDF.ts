// src/lib/pdf/generateSPPDF.ts
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import {
  A4_LAYOUT, buildVerifyUrl, drawFooter, drawKopSurat, drawQrVerifikasi,
  fetchPengaturan, formatTanggalPanjang, tanggalHariIni, PDF_THEME,
  drawWatermark,
} from './pdfShared';

export type SPLevel = 'SP1' | 'SP2' | 'SP3';

export type SPPdfData = {
  sp: {
    nomor_sp: string;
    level: SPLevel;
    tanggal_terbit: string;
    batas_waktu: string | null;
    alasan: string;
    catatan: string | null;
    total_poin_pelanggaran: number;
    total_poin_prestasi: number;
  };
  siswa: { nama_lengkap: string; nisn: string; jenis_kelamin: string; kelas: string; };
  penandatangan: { nama: string; nip?: string | null; jabatan?: string; };
  verification_token?: string | null;
  content_hash?: string | null;
};

function getLevelLabel(level: SPLevel): string {
  return { SP1: 'SURAT PERINGATAN PERTAMA', SP2: 'SURAT PERINGATAN KEDUA', SP3: 'SURAT PERINGATAN KETIGA' }[level];
}

function getLevelNumeric(level: SPLevel): string {
  return { SP1: 'Pertama', SP2: 'Kedua', SP3: 'Ketiga' }[level];
}

export async function generateSPPDF(data: SPPdfData, action: PdfAction = 'save'): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;
  const pengaturan = await fetchPengaturan(true);

  // 1. KOP SURAT
  let y = await drawKopSurat(doc, pengaturan);

  // 2. JUDUL
  y += 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text(getLevelLabel(data.sp.level), pageWidth / 2, y, { align: 'center' });

  // Garis Emas di bawah judul
  y += 2;
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 50, y, pageWidth / 2 + 50, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Nomor: ${data.sp.nomor_sp}`, pageWidth / 2, y, { align: 'center' });

  // 3. PEMBUKA
  y += 12;
  doc.setFontSize(11);
  const salam = data.siswa.jenis_kelamin === 'L' ? 'Siswa' : 'Siswi';
  const pembuka = `Berdasarkan hasil pemantauan, evaluasi, dan pembinaan terhadap ${salam} yang bersangkutan, dengan ini Kepala ${pengaturan.nama_sekolah} menyampaikan Surat Peringatan ${getLevelNumeric(data.sp.level)} kepada:`;
  const pembukaLines = doc.splitTextToSize(pembuka, contentWidth);
  doc.text(pembukaLines, marginX, y);
  y += pembukaLines.length * 5 + 4;

  // 4. DATA SISWA
  const labelW = 25;
  const dataSiswa: [string, string][] = [
    ['Nama', data.siswa.nama_lengkap],
    ['NISN', data.siswa.nisn],
    ['Kelas', data.siswa.kelas],
  ];
  dataSiswa.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, marginX + 5, y);
    doc.text(':', marginX + labelW, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, marginX + labelW + 3, y);
    y += 5;
  });

  // 5. ALASAN
  y += 3;
  doc.setFont('helvetica', 'normal');
  const alasanIntro = 'Surat peringatan ini diberikan karena yang bersangkutan telah melakukan pelanggaran terhadap tata tertib sekolah dengan alasan sebagai berikut:';
  const introLines = doc.splitTextToSize(alasanIntro, contentWidth);
  doc.text(introLines, marginX, y);
  y += introLines.length * 5 + 4;

  // Box alasan (Border Navy, Bg Slate Light)
  doc.setDrawColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.setFillColor(PDF_THEME.slate100[0], PDF_THEME.slate100[1], PDF_THEME.slate100[2]);
  doc.setLineWidth(0.5);
  const alasanLines = doc.splitTextToSize(`"${data.sp.alasan}"`, contentWidth - 15);
  const boxH = alasanLines.length * 5 + 8;
  doc.roundedRect(marginX + 5, y, contentWidth - 10, boxH, 1.5, 1.5, 'FD');
  doc.setFont('times', 'italic');
  doc.text(alasanLines, marginX + 10, y + 5);
  doc.setFont('helvetica', 'normal');
  y += boxH + 5;

  // 6. REKAP POIN
  doc.text('Adapun rekapitulasi poin yang bersangkutan:', marginX, y);
  y += 5;

  const poinBersih = data.sp.total_poin_pelanggaran - data.sp.total_poin_prestasi;
  const poinRows: [string, string, boolean][] = [
    ['Total Poin Pelanggaran', `${data.sp.total_poin_pelanggaran} poin`, false],
    ['Total Poin Prestasi', `${data.sp.total_poin_prestasi} poin`, false],
    ['Poin Bersih', `${poinBersih} poin`, true],
  ];
  poinRows.forEach(([label, value, isBold]) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(label, marginX + 5, y);
    doc.text(':', marginX + 55, y);
    doc.text(value, marginX + 58, y);
    y += 5;
  });
  doc.setFont('helvetica', 'normal');
  y += 3;

  // 7. KONSEKUENSI
  doc.text('Sehubungan dengan hal tersebut, kami mengharapkan:', marginX, y);
  y += 5;

  const konsekuensi = [
    `${salam} yang bersangkutan dapat memperbaiki perilaku dan tidak mengulangi pelanggaran yang sama maupun pelanggaran lainnya.`,
    `Orang tua/wali ${salam} dapat hadir di sekolah untuk berkoordinasi dengan pihak Bimbingan Konseling atau Kesiswaan${data.sp.batas_waktu ? ` sebelum tanggal ${formatTanggalPanjang(data.sp.batas_waktu)}` : ''}.`,
    'Apabila pelanggaran serupa terulang kembali, akan diterbitkan Surat Peringatan yang lebih tinggi tingkatannya.',
  ];
  konsekuensi.forEach((item, idx) => {
    const lines = doc.splitTextToSize(`${idx + 1}. ${item}`, contentWidth - 8);
    doc.text(lines, marginX + 3, y);
    y += lines.length * 5 + 1.5;
  });
  y += 3;

  // 8. CATATAN
  if (data.sp.catatan && data.sp.catatan.trim()) {
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.text('Catatan Tambahan:', marginX, y);
    y += 4;
    doc.setFont('times', 'italic');
    const catLines = doc.splitTextToSize(data.sp.catatan, contentWidth - 8);
    doc.text(catLines, marginX + 3, y);
    y += catLines.length * 5 + 4;
    doc.setFont('helvetica', 'normal');
  }

  // 9. PENUTUP
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }
  const penutup = 'Demikian surat peringatan ini disampaikan. Atas perhatian dan kerja sama Bapak/Ibu orang tua/wali, kami sampaikan terima kasih.';
  const penutupLines = doc.splitTextToSize(penutup, contentWidth);
  doc.text(penutupLines, marginX, y);
  y += penutupLines.length * 5 + 12;

  // 10. TANDA TANGAN
  if (y > pageHeight - 100) { doc.addPage(); y = 20; }
  const leftX = marginX + 5;
  const rightX = pageWidth - marginX - 65;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text('Mengetahui,', leftX, y);
  doc.text('Orang Tua / Wali Siswa', leftX, y + 5);
  const ttdLineY = y + 32;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(leftX, ttdLineY, leftX + 50, ttdLineY);
  doc.text('(..................................)', leftX, ttdLineY + 5);

  doc.text(`Sukahideng, ${tanggalHariIni()}`, rightX, y);
  doc.text(`${data.penandatangan.jabatan || 'Kepala Sekolah'},`, rightX, y + 5);
  doc.line(rightX, ttdLineY, rightX + 50, ttdLineY);
  doc.setFont('helvetica', 'bold');
  doc.text(data.penandatangan.nama, rightX, ttdLineY + 5);
  doc.setFont('helvetica', 'normal');
  if (data.penandatangan.nip) {
    doc.setFontSize(9);
    doc.text(`NIP. ${data.penandatangan.nip}`, rightX, ttdLineY + 9);
  }
  y = ttdLineY + 15;

  // 11. QR
  if (data.verification_token) {
    if (y > pageHeight - 45) { doc.addPage(); y = 20; }
    const qrSize = 22;
    const verifyUrl = buildVerifyUrl('surat', data.verification_token, data.content_hash);
    try {
      await drawQrVerifikasi(doc, verifyUrl, marginX, y, qrSize, ['Scan untuk verifikasi', 'keaslian surat']);
      y += qrSize + 8;
    } catch (err) { console.warn(err); }
  }

  // 12. TEMBUSAN
  if (y > pageHeight - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Tembusan:', marginX, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text('1. Arsip Sekolah', marginX + 3, y); y += 4;
  doc.text('2. Wali Kelas yang bersangkutan', marginX + 3, y); y += 4;
  doc.text('3. Guru BK / Kesiswaan', marginX + 3, y);

  // 13. FOOTER
  drawFooter(doc, pengaturan, A4_LAYOUT, `Surat Peringatan ${data.sp.level} - ${data.siswa.nama_lengkap}.`);
  
  await drawWatermark(doc, pengaturan.logo_url);
  
  // 14. UPDATE DB
  if (data.verification_token) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('kesiswaan_surat_peringatan').update({
        pdf_generated_at: new Date().toISOString(),
        pdf_generated_by: session?.user?.id ?? null,
      }).eq('verification_token', data.verification_token);
    } catch (err) { console.warn(err); }
  }

  // 15. OUTPUT (Preview atau Save)
  const safeNomor = data.sp.nomor_sp.replace(/[^a-zA-Z0-9]/g, '_');
  const safeNama = data.siswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const fileName = `SP_${data.sp.level}_${safeNomor}_${safeNama}.pdf`;

  if (action === 'preview') {
    // Buka di tab baru (Browser akan menampilkan PDF Viewer)
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    // Langsung Download
    doc.save(fileName);
  }
}