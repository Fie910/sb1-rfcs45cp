// src/lib/generateNotulensiPDF.ts
// Generate PDF Notulensi Rapat dengan QR anti-forgery.

import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import {
  A4_LAYOUT,
  buildVerifyUrl,
  drawFooter,
  drawKopSurat,
  drawQrVerifikasi,
  fetchPengaturan,
  formatJam,
  formatTanggalPanjang,
  tanggalHariIni,
} from './pdfShared';
import type { ActionItemRapat } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
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

// =============================================================================
// MAIN
// =============================================================================
export async function generateNotulensiPDF(data: NotulensiPDFData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageWidth, pageHeight, marginX, contentWidth } = A4_LAYOUT;
  let y = 15;

  const pengaturan = await fetchPengaturan();

  // ==========================================================================
  // 1. KOP SURAT
  // ==========================================================================
  y = await drawKopSurat(doc, pengaturan);

  // ==========================================================================
  // 2. JUDUL
  // ==========================================================================
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NOTULENSI RAPAT', pageWidth / 2, y, { align: 'center' });

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nomor: ${data.nomor_rapat}`, pageWidth / 2, y, { align: 'center' });

  y += 4.5;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Jenis: ${data.jenis_rapat}`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);

  // ==========================================================================
  // 3. IDENTITAS RAPAT
  // ==========================================================================
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('I. IDENTITAS RAPAT', marginX, y);
  y += 5;

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

  // ==========================================================================
  // 4. DAFTAR PESERTA
  // ==========================================================================
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('II. DAFTAR PESERTA', marginX, y);
  y += 5;

  if (data.peserta.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('(Tidak ada peserta tercatat)', marginX + 3, y);
    y += 5;
  } else {
    const colX = [marginX + 3, marginX + 12, marginX + 90, marginX + 130];
    const colLabels = ['No', 'Nama', 'Jabatan', 'Kehadiran'];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX + 2, y - 3.5, contentWidth - 4, 5, 'F');
    colLabels.forEach((lbl, i) => doc.text(lbl, colX[i], y));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 5;

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

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(marginX + 2, y - 2.5, pageWidth - marginX - 2, y - 2.5);
    });
  }

  // ==========================================================================
  // 5. RINGKASAN
  // ==========================================================================
  y += 4;
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('III. RINGKASAN', marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.ringkasan) {
    const lines = doc.splitTextToSize(data.ringkasan, contentWidth - 6);
    doc.text(lines, marginX + 3, y);
    y += lines.length * 4.5 + 3;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('(Belum ada ringkasan)', marginX + 3, y);
    doc.setTextColor(0);
    y += 5;
  }

  // ==========================================================================
  // 6. PEMBAHASAN
  // ==========================================================================
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('IV. PEMBAHASAN', marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.pembahasan) {
    const lines = doc.splitTextToSize(data.pembahasan, contentWidth - 6);
    lines.forEach((line: string) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, marginX + 3, y);
      y += 4.5;
    });
    y += 3;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('(Belum ada pembahasan)', marginX + 3, y);
    doc.setTextColor(0);
    y += 5;
  }

  // ==========================================================================
  // 7. KEPUTUSAN
  // ==========================================================================
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('V. KEPUTUSAN', marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.keputusan) {
    const lines = doc.splitTextToSize(data.keputusan, contentWidth - 6);
    lines.forEach((line: string) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, marginX + 3, y);
      y += 4.5;
    });
    y += 3;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('(Belum ada keputusan)', marginX + 3, y);
    doc.setTextColor(0);
    y += 5;
  }

  // ==========================================================================
  // 8. ACTION ITEMS
  // ==========================================================================
  if (data.action_items.length > 0) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('VI. ACTION ITEMS', marginX, y);
    y += 5;

    const aX = [marginX + 3, marginX + 12, marginX + 90, marginX + 130];
    const aLabels = ['No', 'Tugas', 'PIC', 'Deadline'];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX + 2, y - 3.5, contentWidth - 4, 5, 'F');
    aLabels.forEach((lbl, i) => doc.text(lbl, aX[i], y));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 5;

    data.action_items.forEach((a, idx) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }

      const descLines = doc.splitTextToSize(a.deskripsi, 75);
      doc.text(`${idx + 1}`, aX[0], y);
      doc.text(descLines[0] ?? '', aX[1], y);
      doc.text((a.pic_nama || '-').slice(0, 18), aX[2], y);
      doc.text(a.deadline ?? '-', aX[3], y);
      y += 4.5;

      if (descLines.length > 1) {
        for (let i = 1; i < descLines.length; i++) {
          if (y > pageHeight - 25) {
            doc.addPage();
            y = 20;
          }
          doc.text(descLines[i], aX[1], y);
          y += 4.5;
        }
      }

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(marginX + 2, y - 2.5, pageWidth - marginX - 2, y - 2.5);
    });
  }

  // ==========================================================================
  // 9. TANDA TANGAN + QR
  // ==========================================================================
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 30;
  }
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

  // QR di kiri bawah
  const qrSize = 25;
  const verifyUrl = buildVerifyUrl('notulensi', data.verification_token, data.content_hash);
  await drawQrVerifikasi(doc, verifyUrl, marginX, y - 30, qrSize, [
    'Scan untuk verifikasi',
    'keaslian notulensi',
  ]);

  // ==========================================================================
  // 10. FOOTER
  // ==========================================================================
  drawFooter(
    doc,
    pengaturan,
    A4_LAYOUT,
    `Notulensi ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}.`
  );

  // ==========================================================================
  // 11. SAVE
  // ==========================================================================
  const fileName = `Notulensi_${data.nomor_rapat}_${data.judul_rapat.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);

  // ==========================================================================
  // 12. UPDATE pdf_generated_at
  // ==========================================================================
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('rapat_notulensi')
        .update({
          pdf_generated_at: new Date().toISOString(),
          pdf_generated_by: session.user.id,
        })
        .eq('verification_token', data.verification_token);
    }
  } catch {
    /* silent */
  }
}