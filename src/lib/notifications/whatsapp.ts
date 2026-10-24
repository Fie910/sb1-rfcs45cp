// src/lib/notifications/whatsapp.ts
// Helper untuk WhatsApp: buka chat, salin pesan, buka WA grup.
//
// CATATAN: Tanpa WA Business API (berbayar), notifikasi 100% otomatis
// tidak memungkinkan. Solusi gratis: semi-otomatis dengan wa.me.

/**
 * Normalisasi nomor HP Indonesia ke format internasional tanpa "+".
 * "0812-3456-7890" → "6281234567890"
 * "+62812..." → "62812..."
 * "62812..." → "62812..."
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits.length >= 10 ? '62' + digits : null;
}

/**
 * Buka WhatsApp chat dengan nomor tertentu + pesan pre-filled.
 */
export function openWhatsAppChat(phone: string, message: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
  return true;
}

/**
 * Buka WhatsApp tanpa nomor (untuk pilih grup/kontak manual).
 * Pesan sudah pre-filled.
 */
export function openWhatsAppGroup(message: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
}

/**
 * Salin pesan ke clipboard (fallback kalau WhatsApp tidak terbuka).
 */
export async function copyWhatsAppMessage(message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bangun pesan delegasi tugas untuk guru piket.
 */
export interface DelegasiTugasData {
  guru_izin_nama: string;
  guru_piket_nama: string;
  tanggal_izin: string;
  kategori_izin: string;
  keterangan_izin: string | null;
  kelas_nama: string;
  mapel_nama: string;
  titipan_tugas: string;
  url_file?: string | null;
  waktu_penyampaian?: string | null;
}

export function buildDelegasiTugasMessage(data: DelegasiTugasData): string {
  const lines: string[] = [];

  lines.push('*📋 DELEGASI TUGAS GURU PIKET*');
  lines.push('');
  lines.push(`*Dari:* ${data.guru_izin_nama}`);
  lines.push(`*Untuk:* ${data.guru_piket_nama}`);
  lines.push(`*Tanggal:* ${data.tanggal_izin}`);
  lines.push(`*Kategori:* ${data.kategori_izin}`);
  if (data.keterangan_izin) {
    lines.push(`*Alasan:* ${data.keterangan_izin}`);
  }
  lines.push('');
  lines.push(`*Kelas:* ${data.kelas_nama}`);
  lines.push(`*Mata Pelajaran:* ${data.mapel_nama}`);
  lines.push('');
  lines.push('*Titipan Tugas:*');
  lines.push(data.titipan_tugas || '-');
  if (data.url_file) {
    lines.push('');
    lines.push(`*Link File:* ${data.url_file}`);
  }
  lines.push('');
  lines.push('_Mohon disampaikan kepada siswa dan ditindaklanjuti. Terima kasih._');

  return lines.join('\n');
}

// =============================================================================
// ASISTENSI — pesan delegasi jenis asistensi
// =============================================================================
export interface AsistensiData {
  guru_izin_nama: string;
  tanggal_izin: string;
  kategori_izin: string;
  keterangan_izin: string | null;
  kelas_nama: string;
  mapel_nama: string;
  nama_asisten: string;
  waktu?: string | null;
}

export function buildAsistensiMessage(data: AsistensiData): string {
  const lines: string[] = [];

  lines.push('*🤝 DELEGASI ASISTENSI KELAS*');
  lines.push('');
  lines.push(`*Dari:* ${data.guru_izin_nama}`);
  lines.push(`*Asisten:* ${data.nama_asisten}`);
  lines.push(`*Tanggal:* ${data.tanggal_izin}`);
  if (data.waktu) lines.push(`*Waktu:* ${data.waktu}`);
  lines.push(`*Kategori:* ${data.kategori_izin}`);
  if (data.keterangan_izin) lines.push(`*Alasan:* ${data.keterangan_izin}`);
  lines.push('');
  lines.push(`*Kelas:* ${data.kelas_nama}`);
  lines.push(`*Mata Pelajaran:* ${data.mapel_nama}`);
  lines.push('');
  lines.push('_Mohon dampingi kelas sesuai jadwal. Terima kasih._');

  return lines.join('\n');
}

/**
 * Bangun pesan ringkasan semua delegasi hari ini — untuk kirim ke grup guru piket.
 */
export interface RingkasanDelegasiGrup {
  tanggal: string;
  hari: string;
  delegasi_list: Array<{
    guru_izin_nama: string;
    kelas_nama: string;
    mapel_nama: string;
    titipan_tugas: string;
    keterangan_izin?: string | null;
    url_file?: string | null;
  }>;
}

export function buildRingkasanDelegasiGrupMessage(data: RingkasanDelegasiGrup): string {
  const lines: string[] = [];

  lines.push('*📋 RINGKASAN DELEGASI TUGAS HARI INI*');
  lines.push('');
  lines.push(`*${data.hari}, ${data.tanggal}*`);
  lines.push(`Total: *${data.delegasi_list.length}* delegasi`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━');

  data.delegasi_list.forEach((d, idx) => {
    lines.push('');
    lines.push(`*${idx + 1}. ${d.guru_izin_nama}*`);
    lines.push(`📚 ${d.kelas_nama} · ${d.mapel_nama}`);
    if (d.keterangan_izin) {
      lines.push(`_Alasan: ${d.keterangan_izin}_`);
    }
    lines.push('');
    lines.push(`Tugas: ${d.titipan_tugas}`);
    if (d.url_file) {
      lines.push(`Link: ${d.url_file}`);
    }
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('_Mohon guru piket menyampaikan tugas ke siswa masing-masing._');

  return lines.join('\n');
}