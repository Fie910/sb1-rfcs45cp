// src/lib/suratAi.ts
// AI helper untuk surat masuk — ekstraksi & ringkasan otomatis via Gemini.
// Support input: Image (JPG/PNG/WebP) & PDF.
//
// ✅ Robust: auto-retry (503/429) + multi-model fallback

import type { RingkasanSuratAI } from '@/types/database';

// =============================================================================
// CONFIG
// =============================================================================
// Model list — dicoba berurutan saat model utama gagal
const GEMINI_MODELS = [
  'gemini-3.8-flash',       // utama — flagship
  'gemini-3.5-flash',       // fallback 1 — stable
  'gemini-3.5-flash-lite',  // fallback 2 — cepat & murah
];

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MAX_INLINE_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_RETRY_PER_MODEL = 2;             // retry per model
const RETRY_DELAY_MS = 2500;               // 2.5 detik

// Error yang layak di-retry (server overload / rate limit)
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

// =============================================================================
// HEALTH CHECK
// =============================================================================
export function isAiAvailable(): boolean {
  return Boolean(API_KEY);
}

// =============================================================================
// MAIN — RINGKAS SURAT (Robust)
// =============================================================================
export async function ringkasSurat(fileUrl: string): Promise<RingkasanSuratAI> {
  if (!API_KEY) {
    throw new Error('Gemini API key belum diset. Hubungi administrator.');
  }

  // 1. Download file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Gagal download file surat: ${response.status}`);
  }
  const blob = await response.blob();

  if (blob.size > MAX_INLINE_SIZE) {
    throw new Error(
      `Ukuran file terlalu besar (${(blob.size / 1024 / 1024).toFixed(1)} MB). ` +
      `Maksimal 15 MB untuk analisis AI.`
    );
  }

  // 2. Validasi tipe
  const mimeType = blob.type;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(
      `Tipe file "${mimeType}" tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.`
    );
  }

  // 3. Convert ke base64
  const base64 = await blobToBase64(blob);

  // 4. Prompt
  const prompt = buildPrompt();

  // 5. Build payload
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  // 6. Coba model satu per satu
  let lastError: Error | null = null;
  const attemptedModels: string[] = [];

  for (const model of GEMINI_MODELS) {
    attemptedModels.push(model);

    for (let attempt = 1; attempt <= MAX_RETRY_PER_MODEL + 1; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) throw new Error('AI tidak mengembalikan respons.');

          const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          let parsed: RingkasanSuratAI;
          try {
            parsed = JSON.parse(cleaned) as RingkasanSuratAI;
          } catch {
            console.error('[suratAi] Parse error. Raw:', cleaned.slice(0, 500));
            throw new Error('Format respons AI tidak valid. Coba generate ulang.');
          }

          return normalizeResult(parsed);
        }

        // Cek apakah retryable
        const status = res.status;
        const isRetryable = RETRYABLE_STATUS.includes(status);

        let serverMsg = '';
        try {
          const errBody = await res.text();
          const errJson = JSON.parse(errBody);
          serverMsg = errJson?.error?.message ?? '';
        } catch { /* ignore */ }

        lastError = new Error(
          serverMsg
            ? `[${model}] ${serverMsg}`
            : `[${model}] HTTP ${status}`
        );

        // Kalau tidak retryable (mis. 400, 401, 404), langsung coba model berikutnya
        if (!isRetryable) {
          break; // keluar dari loop attempt, lanjut ke model berikutnya
        }

        // Retryable: tunggu lalu coba lagi (kalau masih ada attempt)
        if (attempt <= MAX_RETRY_PER_MODEL) {
          console.warn(
            `[suratAi] ${model} gagal (${status}), retry ${attempt}/${MAX_RETRY_PER_MODEL}...`
          );
          await sleep(RETRY_DELAY_MS);
        }
      } catch (err: any) {
        lastError = err;
        // Network error — coba lagi kalau masih ada attempt
        if (attempt <= MAX_RETRY_PER_MODEL) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    console.warn(
      `[suratAi] Model ${model} gagal semua attempt, coba model berikutnya...`
    );
  }

  // Semua model gagal
  const errMsg = lastError?.message ?? 'Semua model AI gagal.';

  // Pesan ramah untuk 503
  if (errMsg.includes('UNAVAILABLE') || errMsg.includes('503')) {
    throw new Error(
      'Server AI sedang sibuk (high demand). Coba lagi dalam 1-2 menit. ' +
      'Kami sudah coba beberapa model sekaligus.'
    );
  }

  throw new Error(
    `AI gagal merespons setelah mencoba: ${attemptedModels.join(', ')}. ` +
    `Coba lagi nanti.`
  );
}

// =============================================================================
// HELPERS
// =============================================================================
function buildPrompt(): string {
  return `Anda adalah asisten administrasi sekolah di Indonesia.
Tugas Anda membaca surat berikut (bisa berupa gambar scan atau PDF) dan memberikan ringkasan terstruktur.

INSTRUKSI OUTPUT:
Kembalikan HANYA JSON valid (tanpa markdown code fence) dengan struktur:

{
  "inti": "Ringkasan 2-3 paragraf tentang isi utama surat (100-200 kata)",
  "poin_penting": [
    "Poin penting 1 (mis. tanggal, tempat, syarat)",
    "Poin penting 2",
    "Poin penting 3"
  ],
  "tindak_lanjut": "Rekomendasi langkah yang perlu dilakukan pihak sekolah",
  "klasifikasi": "Undangan|Pemberitahuan|Permohonan|Tugas|Lainnya",
  "prioritas": "Tinggi|Sedang|Rendah"
}

ATURAN PENTING:
1. JANGAN mengarang informasi yang tidak ada di surat.
2. Kalau informasi tidak disebutkan, tulis "Tidak disebutkan".
3. Bahasa Indonesia formal dan profesional.
4. Pertahankan istilah teknis, nomor surat, nama instansi, dan nama orang apa adanya.
5. Output HARUS valid JSON — jangan tambahkan penjelasan apapun di luar JSON.
6. Prioritas ditentukan berdasarkan: "Tinggi" jika ada deadline <7 hari atau urgensi mendesak; "Sedang" jika deadline 7-30 hari; "Rendah" jika hanya pemberitahuan tanpa tindakan mendesak.`;
}

function normalizeResult(parsed: RingkasanSuratAI): RingkasanSuratAI {
  if (!Array.isArray(parsed.poin_penting)) {
    parsed.poin_penting = [];
  }
  parsed.poin_penting = parsed.poin_penting.filter(
    (p) => typeof p === 'string' && p.trim()
  );

  const validKlasifikasi: RingkasanSuratAI['klasifikasi'][] = [
    'Undangan', 'Pemberitahuan', 'Permohonan', 'Tugas', 'Lainnya',
  ];
  if (!validKlasifikasi.includes(parsed.klasifikasi)) {
    parsed.klasifikasi = 'Lainnya';
  }

  const validPrioritas: RingkasanSuratAI['prioritas'][] = [
    'Tinggi', 'Sedang', 'Rendah',
  ];
  if (!validPrioritas.includes(parsed.prioritas)) {
    parsed.prioritas = 'Sedang';
  }

  parsed.inti = String(parsed.inti ?? '').trim();
  parsed.tindak_lanjut = String(parsed.tindak_lanjut ?? '').trim();

  return parsed;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? result);
    };
    reader.onerror = () => reject(new Error('Gagal baca file'));
    reader.readAsDataURL(blob);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}