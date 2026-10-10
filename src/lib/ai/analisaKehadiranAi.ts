// src/lib/ai/analisaKehadiranAi.ts
// AI analisa kehadiran guru — pakai multi-provider failover.

import { generateJSON, hasAnyProvider } from './aiProvider';

// =============================================================================
// TYPES
// =============================================================================
export type RecordForAi = {
  tanggal: string;
  mapel: string;
  kelas: string;
  status: string;
  catatan?: string | null;
};

export type AnalisaKehadiranAi = {
  ringkasan_karakter: string;
  kekuatan: string;
  area_perbaikan: string;
  motivasi_personal: string;
};

export type StatsForAi = {
  total: number;
  hadir: number;
  asisten: number;
  sakitTugas: number;
  izinTugas: number;
  dinasTugas: number;
  persentase: number;
};

// =============================================================================
// MAIN
// =============================================================================
export async function generateAnalisaKehadiran(
  guruNama: string,
  periodeLabel: string,
  records: RecordForAi[],
  stats: StatsForAi,
  avgSekolah: number
): Promise<AnalisaKehadiranAi> {
  if (!hasAnyProvider()) {
    throw new Error('Tidak ada API key AI yang diset. Hubungi administrator.');
  }

  if (records.length === 0) {
    throw new Error('Tidak ada record untuk dianalisa.');
  }

  const recordLines = records
    .slice(0, 40)
    .map((r) => {
      const cat = r.catatan ? ` | Catatan: ${r.catatan.slice(0, 80)}` : '';
      return `- ${r.tanggal} | ${r.mapel} | ${r.kelas} | ${r.status}${cat}`;
    })
    .join('\n');

  const totalRecordInfo =
    records.length > 40 ? `\n\n_(Menampilkan 40 dari ${records.length} record)_` : '';

  const systemPrompt = `Anda adalah coach/muhasib profesional untuk guru di sekolah Islam (SMK). Tugas Anda menganalisa pola kehadiran mengajar guru berdasarkan data riil, dan memberikan feedback yang PERSONAL, EMPATIK, dan ISLAMI. Output WAJIB JSON valid tanpa penjelasan tambahan.`;

  const userPrompt = `═══════════════════════════════════════
PROFIL GURU
═══════════════════════════════════════
Nama: ${guruNama}
Periode Analisa: ${periodeLabel}

STATISTIK RINGKAS:
• Total sesi mengajar: ${stats.total}
• Hadir: ${stats.hadir} sesi
• Asisten Guru: ${stats.asisten} sesi
• Sakit (+Tugas): ${stats.sakitTugas} sesi
• Izin (+Tugas): ${stats.izinTugas} sesi
• Dinas (+Tugas): ${stats.dinasTugas} sesi
• Persentase Kehadiran Berbobot: ${stats.persentase}%
• Rata-rata sekolah: ${avgSekolah}%

DETAIL RECORD (${records.length} sesi):
${recordLines}${totalRecordInfo}

═══════════════════════════════════════
TUGAS ANDA
═══════════════════════════════════════
Analisa POLA SPESIFIK dari data di atas, bukan template generik. Contoh pola:
- Hari/jam tertentu yang sering alpa atau terlambat
- Mata pelajaran atau kelas yang lebih sering dihadiri/tidak
- Frekuensi sakit vs izin, dan apakah biasanya disertai titipan tugas
- Konsistensi (stabil atau fluktuatif)
- Proporsi alpa terhadap total

Output HARUS JSON valid:
{
  "ringkasan_karakter": "1-2 kalimat tentang pola umum kehadiran guru ini, sangat spesifik merujuk data",
  "kekuatan": "1-2 kalimat kekuatan yang terlihat dari data",
  "area_perbaikan": "1-2 kalimat area perbaikan konkret & actionable",
  "motivasi_personal": "2-3 kalimat motivasi yang mengaitkan pola data spesifik dengan nilai ibadah mengajar"
}

ATURAN PENTING:
1. JANGAN mengarang fakta yang tidak ada di data.
2. Bahasa Indonesia formal tapi hangat, nuansa islami.
3. Kalau datanya bagus, pujilah dengan spesifik. Kalau ada masalah, sampaikan dengan lembut & solutif.
4. Jangan menyebut nomor atau tanggal yang tidak ada di data.
5. Masing-masing field maksimal 3 kalimat.
6. Output HANYA JSON valid.`;

  try {
    const { data, provider, model } = await generateJSON<AnalisaKehadiranAi>({
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.5,
      maxTokens: 2048,
      jsonMode: true,
    });

    console.info(`[analisa-kehadiran] dihasilkan oleh ${provider}:${model}`);

    return {
      ringkasan_karakter: String(data.ringkasan_karakter ?? '').trim(),
      kekuatan: String(data.kekuatan ?? '').trim(),
      area_perbaikan: String(data.area_perbaikan ?? '').trim(),
      motivasi_personal: String(data.motivasi_personal ?? '').trim(),
    };
  } catch (err: any) {
    console.error('[ai] generateAnalisaKehadiran error:', err);
    throw new Error(err.message || 'Gagal generate analisa kehadiran.');
  }
}

export function isAiAvailable(): boolean {
  return hasAnyProvider();
}