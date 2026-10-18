// src/lib/ai/prompts/surat.ts
import type { TaskPrompt } from './types';

export function buildSuratPrompt(): TaskPrompt {
  const systemPrompt = `Anda asisten administrasi sekolah Indonesia. Baca surat (gambar/PDF) dan berikan ringkasan terstruktur. Output WAJIB JSON valid tanpa markdown fence.`;

  // Note: Untuk vision, "input" example di bawah hanya TEXT —
  // AI tetap akan belajar pola OUTPUT yang diharapkan.
  const examples = [
    {
      input: `Contoh: Surat undangan rapat dari Dinas Pendidikan Kabupaten, tanggal surat 10 Januari 2025, mengundang Kepala Sekolah untuk rapat koordinasi program sekolah, hari Senin 20 Januari 2025 jam 09.00 WIB di Aula Dinas Pendidikan, membawa data sarana prasarana.`,
      output: JSON.stringify({
        inti: 'Dinas Pendidikan Kabupaten mengundang Kepala Sekolah untuk menghadiri rapat koordinasi program sekolah. Rapat akan membahas koordinasi program dan diharapkan membawa data sarana prasarana sebagai bahan diskusi.',
        poin_penting: [
          'Hari/Tanggal: Senin, 20 Januari 2025',
          'Waktu: 09.00 WIB',
          'Lokasi: Aula Dinas Pendidikan Kabupaten',
          'Agenda: Rapat koordinasi program sekolah',
          'Wajib membawa: Data sarana prasarana',
        ],
        tindak_lanjut: 'Kepala Sekolah perlu menyiapkan data sarana prasarana dan mengonfirmasi kehadiran ke Dinas Pendidikan sebelum tanggal rapat.',
        klasifikasi: 'Undangan',
        prioritas: 'Tinggi',
      }),
    },
    {
      input: `Contoh: Surat pemberitahuan dari PT Maju Jaya tentang perubahan jadwal kunjungan industri siswa SMK dari tanggal 15 Februari ke 22 Februari 2025, karena ada agenda internal perusahaan. Kontak PIC: Budi, 0812-3456-7890.`,
      output: JSON.stringify({
        inti: 'PT Maju Jaya memberitahukan penundaan kunjungan industri dari tanggal 15 Februari 2025 menjadi 22 Februari 2025. Penundaan disebabkan agenda internal perusahaan.',
        poin_penting: [
          'Jadwal baru: 22 Februari 2025',
          'Alasan perubahan: agenda internal perusahaan',
          'PIC: Budi (0812-3456-7890)',
        ],
        tindak_lanjut: 'Koordinator kunjungan industri perlu menyebarkan informasi jadwal baru ke siswa dan guru pendamping, serta menyesuaikan surat izin yang sudah dibuat.',
        klasifikasi: 'Pemberitahuan',
        prioritas: 'Sedang',
      }),
    },
  ];

  const userPrompt = `Baca surat pada gambar/PDF terlampir dan berikan ringkasan.

Kembalikan HANYA JSON valid:
{
  "inti": "Ringkasan 2-3 paragraf (100-200 kata)",
  "poin_penting": ["Poin 1", "Poin 2", "Poin 3"],
  "tindak_lanjut": "Rekomendasi langkah konkret",
  "klasifikasi": "Undangan|Pemberitahuan|Permohonan|Tugas|Lainnya",
  "prioritas": "Tinggi|Sedang|Rendah"
}

ATURAN:
1. JANGAN mengarang informasi yang tidak ada.
2. Kalau tidak disebutkan, tulis "Tidak disebutkan".
3. Pertahankan nomor surat, nama instansi, nama orang apa adanya.
4. Prioritas: Tinggi jika deadline <7 hari/mendesak; Sedang jika 7-30 hari; Rendah jika pemberitahuan saja.`;

  return { systemPrompt, examples, userPrompt };
}