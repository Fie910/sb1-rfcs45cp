// src/lib/ai/prompts/pengumuman.ts
import type { TaskPrompt } from './types';

export function buildPengumumanPrompt(input: {
  judul: string;
  isi: string;
  prioritas?: string | null;
}): TaskPrompt {
  const systemPrompt = `Anda adalah editor pengumuman sekolah SMK Indonesia. Ringkas pengumuman panjang menjadi versi padat, jelas, dan actionable. Output WAJIB JSON valid tanpa markdown fence.`;

  const examples = [
    {
      input: `Judul: Pelaksanaan Asesmen Bakat Minat Kelas 12
Prioritas: Penting
Isi: Diberitahukan kepada seluruh siswa kelas 12 bahwa akan dilaksanakan Asesmen Bakat Minat pada hari Senin sampai Rabu, 20-22 Januari 2026. Asesmen bertujuan untuk mengukur minat dan bakat siswa dalam menentukan jurusan kuliah. Setiap siswa wajib hadir pukul 07.30 WIB di lab komputer masing-masing sesuai jadwal yang akan diumumkan. Siswa wajib membawa kartu peserta yang bisa diambil di ruang BK mulai Kamis, 16 Januari 2026. Bagi yang berhalangan hadir wajib menyampaikan surat izin ke wali kelas maksimal 1 hari sebelum pelaksanaan. Pelanggaran akan dikenakan sanksi sesuai tata tertib sekolah. Demikian pengumuman ini disampaikan untuk diperhatikan.`,
      output: JSON.stringify({
        ringkasan: 'Asesmen Bakat Minat untuk siswa kelas 12 dilaksanakan pada 20-22 Januari 2026 di lab komputer, dimulai 07.30 WIB. Kartu peserta diambil di BK mulai 16 Januari. Siswa wajib hadir atau mengirim surat izin maksimal H-1.',
        poin_aksi: [
          'Ambil kartu peserta di ruang BK mulai Kamis, 16 Januari 2026',
          'Hadir 07.30 WIB di lab komputer sesuai jadwal',
          'Kalau berhalangan, kirim surat izin ke wali kelas maksimal H-1',
        ],
      }),
    },
    {
      input: `Judul: Penyesuaian Jam Operasional Perpustakaan Selama Ramadan
Prioritas: Normal
Isi: Dalam rangka menyambut bulan suci Ramadan, perpustakaan sekolah akan menyesuaikan jam operasional. Mulai tanggal 1 Ramadan hingga akhir Ramadan, perpustakaan buka pukul 08.00 sampai 13.00 WIB. Layanan peminjaman dan pengembalian buku tetap berjalan seperti biasa. Anggota yang memiliki buku dengan jatuh tempo selama periode ini otomatis diperpanjang sampai 3 hari setelah Idul Fitri. Kerusakan atau kehilangan buku tetap dikenakan denda sesuai ketentuan. Untuk informasi lebih lanjut, hubungi petugas perpustakaan di ruang perpustakaan atau WA 0812-xxxx-xxxx.`,
      output: JSON.stringify({
        ringkasan: 'Selama Ramadan, perpustakaan buka 08.00-13.00 WIB. Peminjaman dan pengembalian tetap jalan. Jatuh tempo selama periode ini otomatis diperpanjang sampai 3 hari setelah Idul Fitri.',
        poin_aksi: [
          'Sesuaikan waktu kunjungan ke jam 08.00-13.00 WIB',
          'Jatuh tempo buku selama Ramadan otomatis diperpanjang',
          'Hubungi petugas perpustakaan untuk info lebih lanjut',
        ],
      }),
    },
  ];

  const userPrompt = `Judul: ${input.judul}
Prioritas: ${input.prioritas ?? 'Normal'}
Isi:
${input.isi}

Kembalikan HANYA JSON valid:
{
  "ringkasan": "2-3 kalimat padat isi pengumuman",
  "poin_aksi": ["Poin aksi 1", "Poin aksi 2", "Poin aksi 3"]
}

ATURAN:
1. Fokus ke INFO KRITIS: tanggal, waktu, lokasi, kewajiban, deadline.
2. JANGAN mengarang informasi yang tidak ada di isi.
3. Poin aksi harus dimulai dengan kata kerja (Ambil/Hadir/Kirim/dll).
4. Kalau tidak ada poin aksi (hanya informasi), kembalikan [].
5. Maksimal 5 poin aksi.`;

  return { systemPrompt, examples, userPrompt };
}