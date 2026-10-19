// src/lib/ai/dashboardInsight.ts
// AI Insight Dashboard Kepsek — generate ringkasan kondisi sekolah via Gemini.

const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
];

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// =============================================================================
// TYPES
// =============================================================================
export type DashboardInsightInput = {
  stats: {
    guruHadir: number;
    guruTotal: number;
    siswaHadir: number;
    siswaTotal: number;
    izinPending: number;
    disposisiPending: number;
    tahfidzSetoran: number;
    tahfidzSiswaAktif: number;
    tahfidzMilestone: number;
    pelanggaranBulanIni: number;
    spAktif: number;
    prestasiBulanIni: number;
    cutiPending: number;
    dokumenExpired: number;
    rapatBulanIni: number;
    actionItemPending: number;
  };
  alerts: { level: string; judul: string; pesan: string }[];
};

export type DashboardInsightResult = {
  ringkasan: string;
  perhatian_khusus: {
    kategori: string;
    isi: string;
    level: 'Tinggi' | 'Sedang' | 'Rendah';
  }[];
  rekomendasi: string[];
  generatedAt: string;
};

// =============================================================================
// GEMINI CALL
// =============================================================================
async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      'Gemini API key belum diset. Hubungi administrator untuk setup VITE_GEMINI_API_KEY.'
    );
  }

  let lastErr: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No content returned');

      return text;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[dashboard-insight] Model ${model} failed:`, err.message);
    }
  }

  throw lastErr ?? new Error('Semua model AI gagal');
}

// =============================================================================
// MAIN
// =============================================================================
export async function generateDashboardInsight(
  input: DashboardInsightInput
): Promise<DashboardInsightResult> {
  const prompt = `Anda adalah asisten analis sekolah untuk Kepala Sekolah SMK di Indonesia.
Berikan insight singkat, actionable, dan data-driven berdasarkan data berikut.

DATA SEKOLAH (per hari ini):
- Kehadiran Guru: ${input.stats.guruHadir}/${input.stats.guruTotal}
- Kehadiran Siswa: ${input.stats.siswaHadir}/${input.stats.siswaTotal}
- Izin menunggu: ${input.stats.izinPending}
- Disposisi pending: ${input.stats.disposisiPending}

TAHFIDZ (semester ini):
- Total setoran: ${input.stats.tahfidzSetoran}
- Siswa aktif tahfidz: ${input.stats.tahfidzSiswaAktif}
- Milestone tercapai: ${input.stats.tahfidzMilestone}

KEDISIPLINAN (bulan ini):
- Pelanggaran: ${input.stats.pelanggaranBulanIni}
- SP Aktif: ${input.stats.spAktif}
- Prestasi: ${input.stats.prestasiBulanIni}

HRIS:
- Cuti pending: ${input.stats.cutiPending}
- Dokumen expired <30 hari: ${input.stats.dokumenExpired}

RAPAT (bulan ini):
- Total rapat: ${input.stats.rapatBulanIni}
- Action item pending: ${input.stats.actionItemPending}

ALERTS AKTIF:
${input.alerts.length === 0 ? '- Tidak ada alert aktif' : input.alerts.map((a) => `- [${a.level}] ${a.judul}: ${a.pesan}`).join('\n')}

INSTRUKSI OUTPUT:
Kembalikan HANYA JSON valid (tanpa markdown code fence) dengan struktur:

{
  "ringkasan": "1 paragraf singkat (80-150 kata) tentang kondisi sekolah saat ini",
  "perhatian_khusus": [
    {
      "kategori": "Kehadiran|Tahfidz|Kedisiplinan|HRIS|Rapat",
      "isi": "Penjelasan singkat masalah/anomali yang perlu perhatian",
      "level": "Tinggi|Sedang|Rendah"
    }
  ],
  "rekomendasi": [
    "Saran aksi konkret 1",
    "Saran aksi konkret 2"
  ]
}

ATURAN PENTING:
1. Bahasa Indonesia formal, ringkas, dan profesional.
2. Fokus pada DATA & TREND, bukan generalisasi kosong.
3. Jika suatu metrik terlihat normal (tidak ada masalah), JANGAN masukkan ke perhatian_khusus.
4. Maksimal 3 perhatian khusus, 3 rekomendasi.
5. Jangan mengarang data yang tidak ada di input.
6. Output HARUS valid JSON.`;

  const raw = await callGemini(prompt);

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    ringkasan: parsed.ringkasan ?? '',
    perhatian_khusus: Array.isArray(parsed.perhatian_khusus) ? parsed.perhatian_khusus : [],
    rekomendasi: Array.isArray(parsed.rekomendasi) ? parsed.rekomendasi : [],
    generatedAt: new Date().toISOString(),
  };
}