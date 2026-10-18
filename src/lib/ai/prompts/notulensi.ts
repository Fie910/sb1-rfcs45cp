// src/lib/ai/prompts/notulensi.ts
import type { TaskPrompt } from './types';

export function buildNotulensiPrompt(input: {
  judul_rapat: string;
  jenis_rapat: string;
  tanggal: string;
  pembahasan_mentah: string;
  keputusan_mentah?: string;
  peserta_list?: string[];
}): TaskPrompt {
  const pesertaSection = input.peserta_list?.length
    ? `\n\nDaftar peserta: ${input.peserta_list.join(', ')}`
    : '';

  const systemPrompt = `Anda adalah notulis rapat profesional di sekolah SMK Indonesia. Tugas Anda mengubah catatan mentah menjadi notulensi resmi JSON. Output WAJIB JSON valid tanpa markdown fence.`;

  const examples = [
    {
      input: `Konteks Rapat:
- Judul: Rapat Koordinasi PKL
- Jenis: Rapat Koordinasi
- Tanggal: 2025-01-15

Catatan Mentah:
rapat dibuka pak kepsek. bahas PKL kelas 12. pak budi minta data siswa kelas 12 segera, deadline minggu depan. bu sari siapkan SK pembimbing. pak andi usul survei ke mitra baru. rapat ditutup jam 11.

Keputusan Awal:
- data siswa kumpul minggu depan
- SK dibuat bu sari`,
      output: JSON.stringify({
        ringkasan_eksekutif: 'Rapat koordinasi membahas persiapan PKL siswa kelas 12. Ditekankan perlunya pengumpulan data siswa dan penyusunan SK pembimbing PKL sebagai langkah awal. Rapat juga mengusulkan survei ke mitra industri baru untuk memperluas jaringan.',
        pembahasan: '- Pembukaan rapat oleh Kepala Sekolah\n- Pembahasan persiapan PKL kelas 12\n- Usulan survei mitra industri baru\n- Penetapan PIC dan timeline tugas',
        keputusan: '1. Data siswa kelas 12 dikumpulkan paling lambat minggu depan\n2. SK pembimbing PKL disusun oleh Bu Sari\n3. Survei mitra industri baru akan dilakukan setelah data terkumpul',
        action_items: [
          { deskripsi: 'Mengumpulkan data siswa kelas 12', pic_nama: 'Pak Budi', deadline: null, prioritas: 'Tinggi' },
          { deskripsi: 'Menyiapkan SK pembimbing PKL', pic_nama: 'Bu Sari', deadline: null, prioritas: 'Tinggi' },
          { deskripsi: 'Menyusun rencana survei mitra industri baru', pic_nama: 'Pak Andi', deadline: null, prioritas: 'Sedang' },
        ],
      }),
    },
    {
      input: `Konteks Rapat:
- Judul: Rapat Evaluasi Semester
- Jenis: Rapat Evaluasi
- Tanggal: 2025-06-20

Catatan Mentah:
rapat evaluasi semester ganjil. bahas nilai siswa menurun di matematika. bu rina usul tambah jam remedial. pak joko cek penyebab, ternyata jadwal bentrok. keputusan: remedial sabtu, jadwal diubah.`

      output: JSON.stringify({
        ringkasan_eksekutif: 'Rapat evaluasi semester ganjil menyoroti penurunan nilai matematika. Ditemukan penyebab berupa bentrok jadwal. Disepakati solusi berupa penambahan jam remedial di hari Sabtu dan penyesuaian jadwal.',
        pembahasan: '- Evaluasi nilai semester ganjil\n- Identifikasi penyebab penurunan nilai matematika\n- Usulan solusi remedial dan perubahan jadwal',
        keputusan: '1. Remedial matematika dilaksanakan hari Sabtu\n2. Jadwal mata pelajaran matematika disesuaikan untuk menghindari bentrok',
        action_items: [
          { deskripsi: 'Menyusun jadwal remedial Sabtu', pic_nama: 'Bu Rina', deadline: null, prioritas: 'Tinggi' },
          { deskripsi: 'Merevisi jadwal pelajaran matematika', pic_nama: 'Pak Joko', deadline: null, prioritas: 'Tinggi' },
        ],
      }),
    },
  ];

  const userPrompt = `Konteks Rapat:
- Judul: ${input.judul_rapat}
- Jenis: ${input.jenis_rapat}
- Tanggal: ${input.tanggal}${pesertaSection}

Catatan Mentah:
${input.pembahasan_mentah}

${input.keputusan_mentah ? `Keputusan Awal:\n${input.keputusan_mentah}` : ''}

Kembalikan HANYA JSON valid dengan struktur:
{
  "ringkasan_eksekutif": "1-2 paragraf ringkasan (100-200 kata)",
  "pembahasan": "Poin-poin dengan format:\\n- Poin 1\\n- Poin 2",
  "keputusan": "Format:\\n1. Keputusan 1\\n2. Keputusan 2",
  "action_items": [
    { "deskripsi": "Mulai dengan kata kerja", "pic_nama": "Nama atau null", "deadline": "YYYY-MM-DD atau null", "prioritas": "Tinggi|Sedang|Rendah" }
  ]
}

ATURAN:
1. JANGAN mengarang informasi yang tidak ada di catatan.
2. Kalau tidak ada keputusan, isi dengan "Belum ada keputusan formal yang diambil dalam rapat ini."
3. Kalau tidak ada action item, kembalikan [].
4. Pertahankan nama orang, tempat, nomor surat apa adanya.`;

  return { systemPrompt, examples, userPrompt };
}