// src/lib/generateNotulensiPDF.ts
// Generate PDF Notulensi Rapat dengan QR anti-forgery.

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from './supabase';
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
// HELPER
// =============================================================================
function formatTanggalPanjang(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTanggalPendek(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJam(t: string | null | undefined): string {
  if (!t) return '-';
  return t.slice(0, 5);
}

async function fetchPengaturan() {
  const { data } = await supabase
    .from('pengaturan_sekolahs')
    .select('*')
    .limit(1)
    .maybeSingle();
  return {
    nama_sekolah: data?.nama_sekolah ?? 'SMK KH. A. Wahab Muhsin Sukahideng',
    alamat: data?.alamat ?? null,
    telepon: data?.telepon ?? null,
    email: data?.email ?? null,
    website: data?.website ?? null,
    logo_url: data?.logo_url ?? null,
  };
}

async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN
// =============================================================================
export async function generateNotulensiPDF(data: NotulensiPDFData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;
  let y = 15;

  const pengaturan = await fetchPengaturan();

  // ==========================================================================
  // 1. KOP SURAT
  // ==========================================================================
  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', marginX, y, 22, 22); } catch { /* ignore */ }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pengaturan.nama_sekolah.toUpperCase(), pageWidth / 2, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.alamat) {
    const alamatLines = doc.splitTextToSize(pengaturan.alamat, contentWidth - 40);
    doc.text(alamatLines, pageWidth / 2, y + 12, { align: 'center' });
    y += alamatLines.length * 4;
  }

  const kontakParts: string[] = [];
  if (pengaturan.telepon) kontakParts.push(`Telp: ${pengaturan.telepon}`);
  if (pengaturan.email) kontakParts.push(`Email: ${pengaturan.email}`);
  if (pengaturan.website) kontakParts.push(pengaturan.website);
  if (kontakParts.length > 0) {
    doc.setFontSize(8);
    doc.text(kontakParts.join(' · '), pageWidth / 2, y + 14, { align: 'center' });
  }

  y = 38;
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 1.2, pageWidth - marginX, y + 1.2);

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
  // 4. DAFTAR PESERTA (tabel compact)
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
    // Header tabel
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
      // Page break
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}`, colX[0], y);
      doc.text(p.nama.slice(0, 40), colX[1], y);
      doc.text(p.jabatan, colX[2], y);
      doc.text(p.kehadiran, colX[3], y);
      y += 4.5;

      // Garis pemisah
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(marginX + 2, y - 2.5, pageWidth - marginX - 2, y - 2.5);
    });
  }

  // ==========================================================================
  // 5. RINGKASAN
  // ==========================================================================
  y += 4;
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }

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
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('IV. PEMBAHASAN', marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.pembahasan) {
    const lines = doc.splitTextToSize(data.pembahasan, contentWidth - 6);
    lines.forEach((line: string) => {
      if (y > pageHeight - 25) { doc.addPage(); y = 20; }
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
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('V. KEPUTUSAN', marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.keputusan) {
    const lines = doc.splitTextToSize(data.keputusan, contentWidth - 6);
    lines.forEach((line: string) => {
      if (y > pageHeight - 25) { doc.addPage(); y = 20; }
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
    if (y > pageHeight - 45) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('VI. ACTION ITEMS', marginX, y);
    y += 5;

    // Header tabel
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
      if (y > pageHeight - 25) { doc.addPage(); y = 20; }

      // Deskripsi bisa multi-line
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

  // ==========================================================================
  // 9. TANDA TANGAN + QR
  // ==========================================================================
  if (y > pageHeight - 80) { doc.addPage(); y = 30; }
  y += 10;

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Kanan: tanggal + pemimpin
  const rightX = pageWidth - marginX - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sukahideng, ${tanggalCetak}`, rightX, y);

  y += 5;
  doc.text('Notulis,', marginX, y);
  doc.text('Pemimpin Rapat,', rightX, y);

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text((data.notulis_nama ?? '-'), marginX, y);
  doc.text((data.pemimpin_nama ?? '-'), rightX, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.notulis_nip) doc.text(`NIP. ${data.notulis_nip}`, marginX, y);
  if (data.pemimpin_nip) doc.text(`NIP. ${data.pemimpin_nip}`, rightX, y);

  // QR Code di kiri bawah (kiri dari tanda tangan notulis area)
  const qrSize = 25;
  const qrX = marginX;
  const qrY = y - 30;

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://app-anda.com';
  const hashShort = data.content_hash ? data.content_hash.slice(0, 16) : '';
  const verifyUrl = `${baseUrl}/verifikasi-notulensi/${data.verification_token}${hashShort ? `?h=${hashShort}` : ''}`;

  try {
    const qrDataUrl = await generateQrDataUrl(verifyUrl);
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFontSize(6);
    doc.setTextColor(120);
    doc.text('Scan untuk verifikasi', qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });
    doc.text('keaslian notulensi', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
    doc.setTextColor(0);
  } catch { /* skip QR */ }

  // ==========================================================================
  // 10. FOOTER
  // ==========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Notulensi ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}. Halaman ${i}/${totalPages}.`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // ==========================================================================
  // 11. SAVE
  // ==========================================================================
  const fileName = `Notulensi_${data.nomor_rapat}_${data.judul_rapat.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);

  // ==========================================================================
  // 12. UPDATE pdf_generated_at
  // ==========================================================================
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('rapat_notulensi')
        .update({
          pdf_generated_at: new Date().toISOString(),
          pdf_generated_by: session.user.id,
        })
        .eq('verification_token', data.verification_token);
    }
  } catch { /* silent */ }
}