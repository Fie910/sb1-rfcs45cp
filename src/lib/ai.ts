// src/lib/ai.ts
// AI client untuk Gemini API — dipakai untuk auto-resume notulensi.
// ✅ Robust: auto-retry (503/429) + multi-model fallback.

import { supabase } from './supabase';

// =============================================================================
// CONFIG
// =============================================================================
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
export type ResumeNotulensiResult = {
  ringkasan_eksekutif: string;
  pembahasan: string;
  keputusan: string;
  action_items: {
    deskripsi: string;
    pic_nama: string | null;
    deadline: string | null;
    prioritas: 'Tinggi' | 'Sedang' | 'Rendah';
  }[];
};

// =============================================================================
// HELPER — CORE REQUEST dengan fallback
// =============================================================================
async function callGeminiWithFallback(payload: any): Promise<any> {
  if (!API_KEY) {
    throw new Error('Gemini API key belum diset. Hubungi administrator.');
  }

  let lastError: Error | null = null;
  const attempted: string[] = [];

  for (const model of GEMINI_MODELS) {
    attempted.push(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    for (let attempt = 1; attempt <= MAX_RETRY_PER_MODEL + 1; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          return await res.json();
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
          console.warn(`[ai] ${model} gagal (${res.status}), retry ${attempt}/${MAX_RETRY_PER_MODEL}...`);
          await sleep(RETRY_DELAY_MS);
        }
      } catch (err: any) {
        lastError = err;
        if (attempt <= MAX_RETRY_PER_MODEL) await sleep(RETRY_DELAY_MS);
      }
    }

    console.warn(`[ai] Model ${model} gagal, coba model berikutnya...`);
  }

  const errMsg = lastError?.message ?? 'Semua model AI gagal.';
  if (errMsg.includes('UNAVAILABLE') || errMsg.includes('503')) {
    throw new Error(
      'Server AI sedang sibuk (high demand). Coba lagi dalam 1-2 menit.'
    );
  }
  throw new Error(
    `AI gagal merespons setelah mencoba: ${attempted.join(', ')}. Coba lagi nanti.`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// HEALTH CHECK
// =============================================================================
export async function checkAiAvailable(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    const data = await callGeminiWithFallback({
      contents: [{ parts: [{ text: 'Ping' }] }],
      generationConfig: { maxOutputTokens: 5 },
    });
    return Boolean(data);
  } catch {
    return false;
  }
}

// =============================================================================
// MAIN — GENERATE RESUME NOTULENSI
// =============================================================================
export async function generateResumeNotulensi(
  input: {
    judul_rapat: string;
    jenis_rapat: string;
    tanggal: string;
    pembahasan_mentah: string;
    keputusan_mentah?: string;
    peserta_list?: string[];
  }
): Promise<ResumeNotulensiResult> {
  const pesertaSection = input.peserta_list?.length
    ? `\n\nDaftar peserta: ${input.peserta_list.join(', ')}`
    : '';

  const prompt = `Anda adalah notulis rapat profesional di sekolah SMK di Indonesia. Tugas Anda adalah mengubah catatan rapat mentah menjadi notulensi resmi yang rapi, terstruktur, dan formal dalam Bahasa Indonesia.

Konteks Rapat:
- Judul: ${input.judul_rapat}
- Jenis: ${input.jenis_rapat}
- Tanggal: ${input.tanggal}${pesertaSection}

Catatan Mentah:
${input.pembahasan_mentah}

${input.keputusan_mentah ? `Keputusan Awal:\n${input.keputusan_mentah}` : ''}

INSTRUKSI OUTPUT:
Kembalikan HANYA JSON valid (tanpa markdown code fence) dengan struktur berikut:

{
  "ringkasan_eksekutif": "1-2 paragraf ringkasan inti rapat (100-200 kata)",
  "pembahasan": "Poin-poin pembahasan terstruktur. Gunakan format:\\n- Poin 1\\n- Poin 2\\n- dst.",
  "keputusan": "Keputusan-keputusan yang diambil. Gunakan format:\\n1. Keputusan pertama\\n2. Keputusan kedua\\n- dst.",
  "action_items": [
    {
      "deskripsi": "Deskripsi tugas konkret (mulai dengan kata kerja)",
      "pic_nama": "Nama orang yang bertanggung jawab (kalau ada di catatan, kalau tidak: null)",
      "deadline": "Format YYYY-MM-DD (kalau disebutkan, kalau tidak: null)",
      "prioritas": "Tinggi|Sedang|Rendah"
    }
  ]
}

ATURAN PENTING:
1. JANGAN mengarang informasi yang tidak ada di catatan mentah.
2. Kalau tidak ada keputusan, isi field keputusan dengan "Belum ada keputusan formal yang diambil dalam rapat ini."
3. Kalau tidak ada action item, kembalikan array kosong [].
4. Bahasa harus formal dan profesional, sesuai standar administrasi sekolah.
5. Pertahankan istilah teknis, nama orang, nama tempat, dan nomor surat apa adanya.
6. Output HARUS valid JSON. Jangan tambahkan penjelasan apapun di luar JSON.`;

  try {
    const data = await callGeminiWithFallback({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('AI tidak mengembalikan respons. Coba lagi.');

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as ResumeNotulensiResult;

    if (!Array.isArray(parsed.action_items)) {
      parsed.action_items = [];
    }
    parsed.action_items = parsed.action_items.map((a) => ({
      deskripsi: a.deskripsi ?? '',
      pic_nama: a.pic_nama ?? null,
      deadline: a.deadline ?? null,
      prioritas: (['Tinggi', 'Sedang', 'Rendah'].includes(a.prioritas)
        ? a.prioritas
        : 'Sedang') as 'Tinggi' | 'Sedang' | 'Rendah',
    }));

    return parsed;
  } catch (err: any) {
    console.error('[ai] generateResumeNotulensi error:', err);
    throw new Error(err.message || 'Gagal generate resume dengan AI.');
  }
}

// =============================================================================
// POLISH — Rapikan teks
// =============================================================================

// =============================================================================
// AUTO-TITLE
// =============================================================================
