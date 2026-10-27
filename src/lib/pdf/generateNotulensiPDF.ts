// src/lib/pdf/generateNotulensiPDF.ts
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import {
  A4_LAYOUT, buildVerifyUrl, drawFooter, drawKopSurat, drawQrVerifikasi,
  fetchPengaturan, formatJam, formatTanggalPanjang, tanggalHariIni, PDF_THEME,
  drawWatermark,
} from './pdfShared';
import type { ActionItemRapat } from '@/types/database';
import { PdfAction } from './pdfColoredExport';

export type NotulensiPDFData = {
  nomor_rapat: string;
  judul_rapat: string;
  jenis_rapat: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string | null;
  lokasi: string | null;
  penyelenggara: string | null;
  pemimpin_nama: string | null;
  pemimpin_nip: string | null;
  notulis_nama: string | null;
  notulis_nip: string | null;
  total_peserta: number;
  total_hadir: number;
  ringkasan: string | null;
  pembahasan: string | null;
  keputusan: string | null;
  action_items: ActionItemRapat[];
  verification_token: string;
  peserta: {
    nama: string;
    jabatan: string;
    kehadiran: string;
  }[];
  content_hash: string | null;
};

export async function generateNotulensiPDF(data: NotulensiPDFData, action: PdfAction = 'preview'): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;
  let y = 15;

  const pengaturan = await fetchPengaturan();

  // 1. KOP SURAT
  y = await drawKopSurat(doc, pengaturan);

  // 2. JUDUL (Times New Roman, Navy)
  y += 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('NOTULENSI RAPAT', pageWidth / 2, y, { align: 'center' });

  // Garis Emas di bawah judul
  y += 2;
  doc.setDrawColor(PDF_THEME.gold[0], PDF_THEME.gold[1], PDF_THEME.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 30, y, pageWidth / 2 + 30, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Nomor: ${data.nomor_rapat}`, pageWidth / 2, y, { align: 'center' });

  y += 4.5;
  doc.setFontSize(8);
  doc.setTextColor(PDF_THEME.slate600[0], PDF_THEME.slate600[1], PDF_THEME.slate600[2]);
  doc.text(`Jenis: ${data.jenis_rapat}`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);

  // 3. IDENTITAS RAPAT
  y += 10;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('I. IDENTITAS RAPAT', marginX, y);
  doc.setTextColor(0);
  
  y += 6;
  const durasi = data.waktu_selesai
    ? `${formatJam(data.waktu_mulai)} — ${formatJam(data.waktu_selesai)} WIB`
    : `${formatJam(data.waktu_mulai)} WIB`;

  const identitas: [string, string][] = [
    ['Judul Rapat', data.judul_rapat],
    ['Hari / Tanggal', formatTanggalPanjang(data.tanggal)],
    ['Waktu', durasi],
    ['Tempat', data.lokasi ?? '-'],
    ['Penyelenggara', data.penyelenggara ?? '-'],
    ['Pemimpin Rapat', data.pemimpin_nama ?? '-'],
    ['Notulis', data.notulis_nama ?? '-'],
    ['Jumlah Peserta', `${data.total_peserta} orang (${data.total_hadir} hadir)`],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const labelW = 40;
  identitas.forEach(([label, value]) => {
    doc.text(label, marginX + 3, y);
    doc.text(':', marginX + labelW, y);
    const valLines = doc.splitTextToSize(value, contentWidth - labelW - 5);
    doc.text(valLines, marginX + labelW + 2, y);
    y += Math.max(5, valLines.length * 4.5);
  });

  // 4. DAFTAR PESERTA
  y += 4;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
  doc.text('II. DAFTAR PESERTA', marginX, y);
  doc.setTextColor(0);
  y += 6;

  if (data.peserta.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('(Tidak ada peserta tercatat)', marginX + 3, y);
    y += 5;
  } else {
    const colX = [marginX + 3, marginX + 12, marginX + 90, marginX + 130];
    const colLabels = ['No', 'Nama', 'Jabatan', 'Kehadiran'];

    // Header Tabel (Navy bg, White text)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.rect(marginX + 2, y - 3.5, contentWidth - 4, 6, 'F');
    doc.setTextColor(255, 255, 255);
    colLabels.forEach((lbl, i) => doc.text(lbl, colX[i], y + 0.5));
    doc.setTextColor(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 5.5;

    data.peserta.forEach((p, idx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}`, colX[0], y);
      doc.text(p.nama.slice(0, 40), colX[1], y);
      doc.text(p.jabatan, colX[2], y);
      doc.text(p.kehadiran, colX[3], y);
      y += 4.5;

      doc.setDrawColor(PDF_THEME.slate200[0], PDF_THEME.slate200[1], PDF_THEME.slate200[2]);
      doc.setLineWidth(0.1);
      doc.line(marginX + 2, y - 2.5, pageWidth - marginX - 2, y - 2.5);
    });
  }

  // Fungsi bantuan untuk section text panjang
  const renderSection = (roman: string, title: string, content: string | null) => {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.text(`${roman}. ${title}`, marginX, y);
    doc.setTextColor(0);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (content) {
      const lines = doc.splitTextToSize(content, contentWidth - 6);
      lines.forEach((line: string) => {
        if (y > pageHeight - 25) { doc.addPage(); y = 20; }
        doc.text(line, marginX + 3, y);
        y += 4.5;
      });
      y += 3;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`(Belum ada ${title.toLowerCase()})`, marginX + 3, y);
      doc.setTextColor(0);
      y += 5;
    }
  };

  renderSection('III', 'RINGKASAN', data.ringkasan);
  renderSection('IV', 'PEMBAHASAN', data.pembahasan);
  renderSection('V', 'KEPUTUSAN', data.keputusan);

  // 6. ACTION ITEMS
  if (data.action_items.length > 0) {
    if (y > pageHeight - 45) { doc.addPage(); y = 20; }

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.text('VI. ACTION ITEMS', marginX, y);
    doc.setTextColor(0);
    y += 6;

    const aX = [marginX + 3, marginX + 12, marginX + 90, marginX + 130];
    const aLabels = ['No', 'Tugas', 'PIC', 'Deadline'];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(PDF_THEME.navy[0], PDF_THEME.navy[1], PDF_THEME.navy[2]);
    doc.rect(marginX + 2, y - 3.5, contentWidth - 4, 6, 'F');
    doc.setTextColor(255, 255, 255);
    aLabels.forEach((lbl, i) => doc.text(lbl, aX[i], y + 0.5));
    doc.setTextColor(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 5.5;

    data.action_items.forEach((a, idx) => {
      if (y > pageHeight - 25) { doc.addPage(); y = 20; }

      const descLines = doc.splitTextToSize(a.deskripsi, 75);
      doc.text(`${idx + 1}`, aX[0], y);
      doc.text(descLines[0] ?? '', aX[1], y);
      doc.text((a.pic_nama || '-').slice(0, 18), aX[2], y);
      doc.text(a.deadline ?? '-', aX[3], y);
      y += 4.5;

      if (descLines.length > 1) {
        for (let i = 1; i < descLines.length; i++) {
          if (y > pageHeight - 25) { doc.addPage(); y = 20; }
          doc.text(descLines[i], aX[1], y);
          y += 4.5;
        }
      }
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(marginX + 2, y - 2.5, pageWidth - marginX - 2, y - 2.5);
    });
  }

  // 7. TANDA TANGAN
  if (y > pageHeight - 80) { doc.addPage(); y = 30; }
  y += 10;

  const rightX = pageWidth - marginX - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sukahideng, ${tanggalHariIni()}`, rightX, y);

  y += 5;
  doc.text('Notulis,', marginX, y);
  doc.text('Pemimpin Rapat,', rightX, y);

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(data.notulis_nama ?? '-', marginX, y);
  doc.text(data.pemimpin_nama ?? '-', rightX, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.notulis_nip) doc.text(`NIP. ${data.notulis_nip}`, marginX, y);
  if (data.pemimpin_nip) doc.text(`NIP. ${data.pemimpin_nip}`, rightX, y);

  const qrSize = 25;
  const verifyUrl = buildVerifyUrl('notulensi', data.verification_token, data.content_hash);
  await drawQrVerifikasi(doc, verifyUrl, marginX, y - 30, qrSize, ['Scan untuk verifikasi', 'keaslian notulensi']);

  drawFooter(doc, pengaturan, A4_LAYOUT, `Notulensi ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}.`);

  await drawWatermark(doc, pengaturan.logo_url);

  const fileName = `Notulensi_${data.nomor_rapat}_${data.judul_rapat.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  
  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('rapat_notulensi').update({
        pdf_generated_at: new Date().toISOString(),
        pdf_generated_by: session.user.id,
      }).eq('verification_token', data.verification_token);
    }
  } catch { /* silent */ }
}