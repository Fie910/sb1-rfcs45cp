// src/lib/generateSuratIzin.ts
// Generate PDF Surat Izin/Cuti dengan QR anti-forgery.

import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import {
  A4_LAYOUT,
  buildVerifyUrl,
  drawFooter,
  drawKopSurat,
  drawQrVerifikasi,
  fetchPengaturan,
  formatTanggalPanjang,
  tanggalHariIni,
} from './pdfShared';

// =============================================================================
// TYPES
// =============================================================================
export type SuratIzinData = {
  nomor_pengajuan: string;
  guru_nama: string;
  guru_nip: string | null;
  jenis_ptk: string | null;
  status_kepegawaian: string | null;
  jenis_nama: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  jam_mulai: string | null;
  jam_selesai: string | null;
  alasan: string;
  alamat_selama_cuti: string | null;
  no_hp_selama_cuti: string | null;
  verification_token: string;
  content_hash: string | null;
};

// =============================================================================
// MAIN
// =============================================================================
export async function generateSuratIzinPDF(data: SuratIzinData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;

  const pengaturan = await fetchPengaturan(true); // include kepsek

  // ==========================================================================
  // 1. KOP SURAT
  // ==========================================================================
  let y = await drawKopSurat(doc, pengaturan);

  // ==========================================================================
  // 2. JUDUL
  // ==========================================================================
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SURAT IZIN / CUTI PEGAWAI', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nomor: ${data.nomor_pengajuan}`, pageWidth / 2, y, { align: 'center' });

  // ==========================================================================
  // 3. PEMBUKA
  // ==========================================================================
  y += 12;
  doc.setFontSize(11);
  const pembuka =
    'Yang bertanda tangan di bawah ini, Kepala Sekolah ' +
    pengaturan.nama_sekolah +
    ', dengan ini menerangkan bahwa:';
  const pembukaLines = doc.splitTextToSize(pembuka, contentWidth);
  doc.text(pembukaLines, marginX, y);
  y += pembukaLines.length * 5 + 3;

  // ==========================================================================
  // 4. DATA PEGAWAI
  // ==========================================================================
  const dataPegawai: [string, string][] = [
    ['Nama Lengkap', data.guru_nama],
    ['NIP', data.guru_nip ?? '-'],
    ['Jenis PTK', data.jenis_ptk ?? '-'],
    ['Status Kepegawaian', data.status_kepegawaian ?? '-'],
  ];

  const labelWidth = 50;
  doc.setFontSize(10);
  dataPegawai.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, marginX + 5, y);
    doc.text(':', marginX + labelWidth, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, marginX + labelWidth + 4, y);
    y += 5.5;
  });

  // ==========================================================================
  // 5. PEMBUKA 2
  // ==========================================================================
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Telah diberikan izin/cuti dengan keterangan sebagai berikut:', marginX, y);
  y += 7;

  // ==========================================================================
  // 6. DETAIL CUTI
  // ==========================================================================
  const durasi =
    data.jam_mulai && data.jam_selesai
      ? `${data.jumlah_hari} hari (${data.jam_mulai} - ${data.jam_selesai})`
      : `${data.jumlah_hari} hari`;

  const detailCuti: [string, string][] = [
    ['Jenis', data.jenis_nama],
    [
      'Periode',
      `${formatTanggalPanjang(data.tanggal_mulai)} s/d ${formatTanggalPanjang(data.tanggal_selesai)}`,
    ],
    ['Durasi', durasi],
    ['Alasan', data.alasan],
  ];

  if (data.alamat_selama_cuti) {
    detailCuti.push(['Alamat Selama Cuti', data.alamat_selama_cuti]);
  }
  if (data.no_hp_selama_cuti) {
    detailCuti.push(['No. HP', data.no_hp_selama_cuti]);
  }

  doc.setFontSize(10);
  detailCuti.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, marginX + 5, y);
    doc.text(':', marginX + labelWidth, y);
    doc.setFont('helvetica', 'bold');

    const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth - 10);
    doc.text(valueLines, marginX + labelWidth + 4, y);
    y += Math.max(5.5, valueLines.length * 5);
  });

  // ==========================================================================
  // 7. PENUTUP
  // ==========================================================================
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const penutup =
    'Demikian surat izin/cuti ini dibuat untuk dipergunakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.';
  const penutupLines = doc.splitTextToSize(penutup, contentWidth);
  doc.text(penutupLines, marginX, y);
  y += penutupLines.length * 5 + 8;

  // ==========================================================================
  // 8. TANDA TANGAN + QR CODE
  // ==========================================================================
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 20;
  }

  const rightX = pageWidth - marginX - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sukahideng, ${tanggalHariIni()}`, rightX, y);
  y += 5;
  doc.text('Kepala Sekolah,', rightX, y);
  y += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pengaturan.nama_kepsek ?? '-', rightX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.nip_kepsek) {
    doc.text(`NIP. ${pengaturan.nip_kepsek}`, rightX, y);
  }

  // QR Code di kiri bawah
  const qrSize = 30;
  const verifyUrl = buildVerifyUrl('surat', data.verification_token, data.content_hash);
  await drawQrVerifikasi(doc, verifyUrl, marginX, y - 38, qrSize, [
    'Scan QR untuk',
    'verifikasi keaslian',
    'surat ini',
  ]);

  // ==========================================================================
  // 9. FOOTER
  // ==========================================================================
  drawFooter(
    doc,
    pengaturan,
    A4_LAYOUT,
    `Dokumen ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}. Keaslian dapat diverifikasi dengan scan QR code.`
  );

  // ==========================================================================
  // 10. SAVE
  // ==========================================================================
  const fileName = `Surat_Izin_${data.nomor_pengajuan}_${data.guru_nama.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);

  // ==========================================================================
  // 11. UPDATE surat_generated_at
  // ==========================================================================
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('hris_cuti')
        .update({ surat_generated_at: new Date().toISOString() })
        .eq('nomor_pengajuan', data.nomor_pengajuan)
        .is('surat_generated_at', null);
    }
  } catch {
    /* silent */
  }
}