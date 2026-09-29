// src/lib/suratAi.ts
// AI helper untuk surat masuk — ekstraksi & ringkasan otomatis via Gemini.
//
// Support input:
//   - Image (JPG/PNG/WebP)
//   - PDF (dikirim sebagai inlineData ke Gemini Vision)

import type { RingkasanSuratAI } from '@/types/database';

// =============================================================================
// CONFIG
// =============================================================================
const GEMINI_MODEL = 'gemini-2.5-flash';
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MAX_INLINE_SIZE = 15 * 1024 * 1024; // 15 MB — limit aman Gemini inline

// =============================================================================
// HEALTH CHECK
// =============================================================================
export function isAiAvailable(): boolean {
  return Boolean(API_KEY);
}

// =============================================================================
// MAIN — RINGKAS SURAT
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
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(
      `Tipe file "${mimeType}" tidak didukung. ` +
      `Gunakan JPG, PNG, WebP, atau PDF.`
    );
  }

  // 3. Convert ke base64
  const base64 = await blobToBase64(blob);

  // 4. Prompt
  const prompt = `Anda adalah asisten administrasi sekolah di Indonesia.
Tugas Anda membaca surat berikut (bisa berupa gambar scan atau PDF) dan memberikan ringkasan terstruktur.

INSTRUKSI OUTPUT:
Kembalikan HANYA JSON valid (tanpa markdown code fence) dengan struktur:

{
  "inti": "Ringkasan 2-3 paragraf tentang isi utama surat (100-200 kata)",
  "poin_penting": [
    "Poin penting 1 (mis. tanggal, tempat, syarat)",
    "Poin penting 2",
    "Poin penting 3",
    "dst..."
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

  // 5. Panggil Gemini
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('AI tidak mengembalikan respons. Coba lagi.');
  }

  // 6. Parse JSON (bersihkan markdown fence kalau ada)
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: RingkasanSuratAI;
  try {
    parsed = JSON.parse(cleaned) as RingkasanSuratAI;
  } catch (err) {
    console.error('[suratAi] Parse error. Raw:', cleaned.slice(0, 500));
    throw new Error('Format respons AI tidak valid. Coba generate ulang.');
  }

  // 7. Normalisasi
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

// =============================================================================
// HELPER
// =============================================================================
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Gagal baca file'));
    reader.readAsDataURL(blob);
  });
}