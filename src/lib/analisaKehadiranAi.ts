// src/lib/analisaKehadiranAi.ts
// AI personal untuk analisa kehadiran per guru — pakai Gemini.
// Robust: multi-model fallback + retry + fallback ke analisa threshold.

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MAX_RETRY_PER_MODEL = 2;
const RETRY_DELAY_MS = 2500;
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

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
  if (!API_KEY) {
    throw new Error('Gemini API key belum diset.');
  }

  if (records.length === 0) {
    throw new Error('Tidak ada record untuk dianalisa.');
  }

  // Bangun ringkasan record (max 40 agar tidak over-token)
  const recordLines = records
    .slice(0, 40)
    .map((r) => {
      const cat = r.catatan ? ` | Catatan: ${r.catatan.slice(0, 80)}` : '';
      return `- ${r.tanggal} | ${r.mapel} | ${r.kelas} | ${r.status}${cat}`;
    })
    .join('\n');

  const totalRecordInfo = records.length > 40
    ? `\n\n_(Menampilkan 40 dari ${records.length} record)_`
    : '';

  const prompt = `Anda adalah coach/muhasib profesional untuk guru di sekolah Islam (SMK). Tugas Anda menganalisa pola kehadiran mengajar seorang guru berdasarkan data riil, dan memberikan feedback yang PERSONAL, EMPATIK, dan ISLAMI.

═══════════════════════════════════════
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
Analisa POLA SPESIFIK dari data di atas, bukan template generik. Contoh pola yang perlu dideteksi:
- Hari/jam tertentu yang sering alpa atau terlambat
- Mata pelajaran atau kelas yang lebih sering dihadiri/tidak
- Frekuensi sakit vs izin, dan apakah biasanya disertai titipan tugas
- Konsistensi (apakah kehadiran stabil atau fluktuatif)
- Proporsi alpa terhadap total

Output HARUS JSON valid (tanpa markdown fence):
{
  "ringkasan_karakter": "1-2 kalimat tentang pola umum kehadiran guru ini, sangat spesifik merujuk data (mis. 'Kehadiran sangat stabil kecuali 2 sesi di akhir bulan')",
  "kekuatan": "1-2 kalimat kekuatan yang terlihat dari data (mis. 'Selalu menitipkan tugas saat sakit/izin, menunjukkan komitmen tinggi terhadap siswa')",
  "area_perbaikan": "1-2 kalimat area perbaikan konkret & actionable (mis. 'Ada 3 sesi alpa di hari Senin jam pertama, mungkin bisa ditata ulang jadwalnya')",
  "motivasi_personal": "2-3 kalimat motivasi yang mengaitkan pola data spesifik guru ini dengan nilai ibadah mengajar, amal jariyah, dan keberkahan. Sertakan ayat/hadits singkat kalau relevan."
}

ATURAN PENTING:
1. JANGAN mengarang fakta yang tidak ada di data.
2. Bahasa Indonesia formal tapi hangat, nuansa islami.
3. Kalau datanya bagus, pujilah dengan spesifik. Kalau ada masalah, sampaikan dengan lembut & solutif.
4. Jangan menyebut nomor atau tanggal yang tidak ada di data.
5. Masing-masing field maksimal 3 kalimat.
6. Output HANYA JSON valid, tanpa penjelasan tambahan.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    for (let attempt = 1; attempt <= MAX_RETRY_PER_MODEL + 1; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) throw new Error('AI tidak mengembalikan respons.');

          const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          const parsed = JSON.parse(cleaned) as AnalisaKehadiranAi;

          // Normalisasi
          return {
            ringkasan_karakter: String(parsed.ringkasan_karakter ?? '').trim(),
            kekuatan: String(parsed.kekuatan ?? '').trim(),
            area_perbaikan: String(parsed.area_perbaikan ?? '').trim(),
            motivasi_personal: String(parsed.motivasi_personal ?? '').trim(),
          };
        }

        const isRetryable = RETRYABLE_STATUS.includes(res.status);
        let serverMsg = '';
        try {
          const errBody = await res.text();
          const errJson = JSON.parse(errBody);
          serverMsg = errJson?.error?.message ?? '';
        } catch { /* ignore */ }

        lastError = new Error(
          serverMsg ? `[${model}] ${serverMsg}` : `[${model}] HTTP ${res.status}`
        );

        if (!isRetryable) break;
        if (attempt <= MAX_RETRY_PER_MODEL) {
          await sleep(RETRY_DELAY_MS);
        }
      } catch (err: any) {
        lastError = err;
        if (attempt <= MAX_RETRY_PER_MODEL) await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(lastError?.message || 'Semua model AI gagal.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAiAvailable(): boolean {
  return Boolean(API_KEY);
}