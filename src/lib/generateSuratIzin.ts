// src/lib/generateSuratIzin.ts
// Utility generate PDF Surat Izin/Cuti dengan QR code anti-forgery.

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from './supabase';

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
};

type PengaturanSekolah = {
  nama_sekolah: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  nama_kepsek: string | null;
  nip_kepsek: string | null;
};

// =============================================================================
// HELPER — Format tanggal panjang Bahasa Indonesia
// =============================================================================
function formatTanggalPanjang(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
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
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// HELPER — Ambil data pengaturan sekolah & kepsek
// =============================================================================
async function fetchPengaturan(): Promise<PengaturanSekolah> {
  const { data } = await supabase
    .from('pengaturan_sekolahs')
    .select('*')
    .limit(1)
    .maybeSingle();

  // Ambil kepsek dari gurus (kalau nama_kepsek di pengaturan kosong)
  let namaKepsek = data?.nama_kepsek ?? null;
  let nipKepsek = data?.nip_kepsek ?? null;

  if (!namaKepsek) {
    const { data: kepsek } = await supabase
      .from('gurus')
      .select('nama_lengkap, nip')
      .eq('role', 'kepala')
      .maybeSingle();
    namaKepsek = kepsek?.nama_lengkap ?? '.......................';
    nipKepsek = kepsek?.nip ?? null;
  }

  return {
    nama_sekolah: data?.nama_sekolah ?? 'SMK KH. A. Wahab Muhsin Sukahideng',
    alamat: data?.alamat ?? null,
    telepon: data?.telepon ?? null,
    email: data?.email ?? null,
    website: data?.website ?? null,
    logo_url: data?.logo_url ?? null,
    nama_kepsek: namaKepsek,
    nip_kepsek: nipKepsek,
  };
}

// =============================================================================
// HELPER — Load gambar (logo) → data URL
// =============================================================================
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
// HELPER — Generate QR code → data URL
// =============================================================================
async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H', // High — tahan kerusakan
  });
}

// =============================================================================
// MAIN — Generate PDF
// =============================================================================
export async function generateSuratIzinPDF(data: SuratIzinData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  const pengaturan = await fetchPengaturan();

  // ==========================================================================
  // 1. KOP SURAT
  // ==========================================================================
  let y = 15;

  // Logo (kalau ada) — siap untuk future
  if (pengaturan.logo_url) {
    const logoData = await loadImageAsDataUrl(pengaturan.logo_url);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', marginX, y, 22, 22);
      } catch {
        // ignore if logo invalid
      }
    }
  }

  // Teks kop di tengah
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

  // Kontak
  const kontakParts: string[] = [];
  if (pengaturan.telepon) kontakParts.push(`Telp: ${pengaturan.telepon}`);
  if (pengaturan.email) kontakParts.push(`Email: ${pengaturan.email}`);
  if (pengaturan.website) kontakParts.push(pengaturan.website);

  if (kontakParts.length > 0) {
    doc.setFontSize(8);
    doc.text(kontakParts.join(' · '), pageWidth / 2, y + 14, { align: 'center' });
  }

  // Garis horizontal tebal
  y = 38;
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 1.2, pageWidth - marginX, y + 1.2);

  // ==========================================================================
  // 2. JUDUL SURAT
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
    doc.text(`${label}`, marginX + 5, y);
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
    doc.text(`${label}`, marginX + 5, y);
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
  const tanggalSurat = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Kalau y terlalu dekat dengan bawah, pindah ke halaman baru
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 20;
  }

  // Kolom kanan — Kepsek
  const rightX = pageWidth - marginX - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sukahideng, ${tanggalSurat}`, rightX, y);
  y += 5;
  doc.text('Kepala Sekolah,', rightX, y);
  y += 20; // Ruang untuk tanda tangan basah

  // Nama Kepsek
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pengaturan.nama_kepsek ?? '-', rightX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (pengaturan.nip_kepsek) {
    doc.text(`NIP. ${pengaturan.nip_kepsek}`, rightX, y);
  }

  // QR Code di kiri bawah (untuk anti-forgery)
  const qrSize = 30;
  const qrX = marginX;
  const qrY = y - 38; // Sejajar dengan area tanda tangan

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://app-anda.com';
  const verifyUrl = `${baseUrl}/verifikasi-surat/${data.verification_token}`;

  try {
    const qrDataUrl = await generateQrDataUrl(verifyUrl);
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {
    // fallback: gambar kotak placeholder
    doc.setDrawColor(200);
    doc.rect(qrX, qrY, qrSize, qrSize);
  }

  // Keterangan QR
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('Scan QR untuk', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });
  doc.text('verifikasi keaslian', qrX + qrSize / 2, qrY + qrSize + 6, { align: 'center' });
  doc.text('surat ini', qrX + qrSize / 2, qrY + qrSize + 9, { align: 'center' });
  doc.setTextColor(0);

  // ==========================================================================
  // 9. FOOTER
  // ==========================================================================
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `Dokumen ini dicetak otomatis oleh Sistem Informasi ${pengaturan.nama_sekolah}. Keaslian dapat diverifikasi dengan scan QR code.`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center', maxWidth: contentWidth }
  );

  // ==========================================================================
  // 10. SAVE
  // ==========================================================================
  const fileName = `Surat_Izin_${data.nomor_pengajuan}_${data.guru_nama.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);

  // ==========================================================================
  // 11. UPDATE surat_generated_at di DB (first time only)
  // ==========================================================================
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('hris_cuti')
        .update({ surat_generated_at: new Date().toISOString() })
        .eq('nomor_pengajuan', data.nomor_pengajuan)
        .is('surat_generated_at', null);
    }
  } catch {
    // silent fail
  }
}

// =============================================================================
// HELPER — Format tanggal (re-export untuk dipakai UI)
// =============================================================================
export { formatTanggalPanjang, formatTanggalPendek };