// src/lib/ai/prompts/analisaKehadiran.ts
import type { TaskPrompt } from './types';

export function buildAnalisaKehadiranPrompt(
  guruNama: string,
  periodeLabel: string,
  recordLines: string,
  totalRecordInfo: string,
  stats: {
    total: number;
    hadir: number;
    asisten: number;
    sakitTugas: number;
    izinTugas: number;
    dinasTugas: number;
    persentase: number;
  },
  avgSekolah: number,
  totalRecords: number
): TaskPrompt {
  const systemPrompt = `Anda adalah coach/muhasib profesional untuk guru di sekolah Islam (SMK). Berikan feedback kehadiran yang personal, empatik, dan islami. Output WAJIB JSON valid.

═══════════════════════════════════════
KONTEKS IDENTITAS SEKOLAH
═══════════════════════════════════════
Sekolah ini memiliki filosofi: "Merawat Fitrah, Mengukir Karya"

Filosofi ini bermakna dua sayap:
1. MERAWAT FITRAH — menjaga, menghidupkan, dan menumbuhkan benih kebaikan 
   yang Allah titipkan pada diri guru dan siswa. Bukan "membentuk dari nol", 
   tapi merawat yang sudah ada.
2. MENGUKIR KARYA — perubahan yang mengendap lama. Setiap interaksi guru 
   dengan siswa adalah ukiran halus yang baru terlihat bertahun-tahun kemudian.

Untuk field "motivasi_personal":
• Kaitkan pesan dengan makna fitrah (amanah diri sebagai guru) DAN/ATAU 
  karya (jejak baik untuk siswa) secara natural.
• JANGAN menyebut tagline secara literal ("Merawat Fitrah, Mengukir Karya").
• Internaliasikan maknanya — gunakan kata-kata seperti "merawat", "menumbuhkan", 
  "menjaga benih", "mengukir jejak", "meninggalkan karya", "amanah fitrah".
• Tetap personal, hangat, islami, tidak menggurui.`;

  const examples = [
    {
      input: `Nama: Bu Aisyah
Periode: Januari 2025
Total sesi: 20 | Hadir: 20 | Persentase: 100% | Rata sekolah: 92%
Detail: semua sesi hadir tepat waktu, 0 alpa, 0 terlambat`,
      output: JSON.stringify({
        ringkasan_karakter: 'Bu Aisyah menunjukkan kehadiran sempurna 100% selama Januari 2025 dengan 20 sesi mengajar tanpa satu pun alpa atau terlambat.',
        kekuatan: 'Konsistensi luar biasa dalam menjalankan amanah mengajar, menunjukkan kedisiplinan dan tanggung jawab yang tinggi terhadap siswa.',
        area_perbaikan: 'Tidak ada catatan negatif yang perlu diperbaiki. Pertahankan konsistensi dan bagikan praktik baik kepada rekan guru lain.',
        motivasi_personal: 'Rasulullah SAW bersabda: "Sebaik-baik manusia adalah yang paling bermanfaat bagi orang lain." Kehadiran Bu Aisyah adalah wujud nyata amal jariyah yang mengalir pahalanya kepada siswa dan sekolah. Semoga Allah memberkahi setiap langkah mengajar Bu Aisyah.',
      }),
    },
    {
      input: `Nama: Pak Rudi
Periode: Januari 2025
Total sesi: 20 | Hadir: 15 | Sakit: 2 | Izin: 2 | Alpa: 1 | Persentase: 75% | Rata sekolah: 92%
Detail: 1 sesi alpa hari Senin jam pertama, 2 sesi sakit, 2 sesi izin`,
      output: JSON.stringify({
        ringkasan_karakter: 'Pak Rudi memiliki kehadiran 75% (15 dari 20 sesi). Terdapat satu sesi alpa pada hari Senin jam pertama, serta beberapa sesi sakit dan izin.',
        kekuatan: 'Komunikasi izin dilakukan dengan rapi dan tidak ada catatan terlambat pada sesi yang hadir.',
        area_perbaikan: 'Sesi alpa pada hari Senin jam pertama perlu ditelusuri — bisa karena faktor transportasi atau kesiapan awal pekan. Pertimbangkan menyiapkan jadwal pagi lebih awal.',
        motivasi_personal: 'Rasulullah SAW mengajarkan bahwa setiap amanah akan dimintai pertanggungjawaban. Menjaga kehadiran adalah bagian dari amanah tersebut. Setiap sesi mengajar yang tidak ditinggalkan adalah sedekah ilmu yang pahalanya terus mengalir. Semoga Allah memudahkan setiap langkah Pak Rudi di pekan-pekan berikutnya.',
      }),
    },
  {
      input: `Nama: Bu Fatimah
Periode: Februari 2025
Total sesi: 24 | Hadir: 22 | Izin (+Tugas): 1 | Sakit (+Tugas): 1 | Persentase: 95% | Rata sekolah: 88%
Detail: 22 sesi hadir tepat waktu, 1 sesi izin dengan titipan tugas lengkap, 1 sesi sakit dengan tugas terstruktur`,
      output: JSON.stringify({
        ringkasan_karakter: 'Bu Fatimah menunjukkan kehadiran sangat baik 95% (22 dari 24 sesi). Dua sesi berhalangan justru ditandai dengan titipan tugas lengkap, menunjukkan kesadaran tinggi terhadap amanah.',
        kekuatan: 'Konsistensi hadir tepat waktu luar biasa, dan saat berhalangan pun tetap menjaga keberlangsungan belajar siswa melalui titipan tugas yang terstruktur.',
        area_perbaikan: 'Tidak ada catatan signifikan. Pertahankan ritme ini dan bagikan praktik baik titipan tugas ke rekan sejawat — model ini layak ditiru.',
        motivasi_personal: 'Setiap kehadiran Bu Fatimah bukan sekadar kehadiran fisik, tapi sebuah amanah fitrah yang dirawat dengan sabar — dan setiap titipan tugas adalah ukiran karya yang tetap hidup meski Bu Fatimah tidak di kelas. Inilah wujud nyata guru yang merawat apa yang Allah titipkan dan meninggalkan jejak yang bertahan lama. Semoga Allah memberkahi setiap langkah kecil yang konsisten ini.',
      }),
    },
  ];

  const userPrompt = `═══════════════════════════════════════
PROFIL GURU
═══════════════════════════════════════
Nama: ${guruNama}
Periode Analisa: ${periodeLabel}

STATISTIK RINGKAS:
• Total sesi mengajar: ${stats.total}
• Hadir: ${stats.hadir}
• Asisten Guru: ${stats.asisten}
• Sakit (+Tugas): ${stats.sakitTugas}
• Izin (+Tugas): ${stats.izinTugas}
• Dinas (+Tugas): ${stats.dinasTugas}
• Persentase Kehadiran Berbobot: ${stats.persentase}%
• Rata-rata sekolah: ${avgSekolah}%

DETAIL RECORD (${totalRecords} sesi):
${recordLines}${totalRecordInfo}

Analisa POLA SPESIFIK. Output JSON:
{
  "ringkasan_karakter": "1-2 kalimat pola umum, spesifik merujuk data",
  "kekuatan": "1-2 kalimat kekuatan yang terlihat",
  "area_perbaikan": "1-2 kalimat area perbaikan konkret & actionable",
  "motivasi_personal": "2-3 kalimat motivasi islami mengaitkan pola spesifik"
}

ATURAN:
1. JANGAN mengarang fakta.
2. Bahasa formal tapi hangat, nuansa islami.
3. Kalau data bagus, pujilah spesifik. Kalau ada masalah, sampaikan lembut & solutif.
4. Jangan sebut tanggal/nomor yang tidak ada di data.
5. Masing-masing field maksimal 3 kalimat.`;

  return { systemPrompt, examples, userPrompt };
}