// src/lib/ai/suratAi.ts
// AI helper untuk surat masuk — ekstraksi & ringkasan otomatis.
// Support input: Image (JPG/PNG/WebP) & PDF.
// Multi-provider vision failover: OpenRouter → Gemini.

import type { RingkasanSuratAI } from '@/types/database';
import { generateJSONVision, hasAnyProvider } from './aiProvider';

const MAX_INLINE_SIZE = 15 * 1024 * 1024; // 15 MB

export function isAiAvailable(): boolean {
  return hasAnyProvider();
}

// =============================================================================
// MAIN
// =============================================================================
export async function ringkasSurat(fileUrl: string): Promise<RingkasanSuratAI> {
  if (!hasAnyProvider()) {
    throw new Error('Tidak ada API key AI yang diset. Hubungi administrator.');
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
  const systemPrompt = `Anda adalah asisten administrasi sekolah di Indonesia. Tugas Anda membaca surat (gambar/PDF) dan memberikan ringkasan terstruktur. Output WAJIB JSON valid tanpa penjelasan tambahan.`;

  const userPrompt = `Baca surat pada gambar/PDF terlampir dan berikan ringkasan terstruktur.

INSTRUKSI OUTPUT:
Kembalikan HANYA JSON valid dengan struktur:

{
  "inti": "Ringkasan 2-3 paragraf tentang isi utama surat (100-200 kata)",
  "poin_penting": [
    "Poin penting 1 (tanggal, tempat, syarat)",
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
5. Output HARUS valid JSON — jangan tambahkan penjelasan di luar JSON.
6. Prioritas: "Tinggi" jika deadline <7 hari atau mendesak; "Sedang" jika 7-30 hari; "Rendah" jika hanya pemberitahuan.`;

  try {
    const { data, provider, model } = await generateJSONVision<RingkasanSuratAI>({
      prompt: userPrompt,
      systemPrompt,
      imageBase64: base64,
      imageMimeType: mimeType,
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });

    console.info(`[surat-ai] diringkas oleh ${provider}:${model}`);
    return normalizeResult(data);
  } catch (err: any) {
    console.error('[ai] ringkasSurat error:', err);
    throw new Error(err.message || 'Gagal meringkas surat dengan AI.');
  }
}

// =============================================================================
// HELPERS
// =============================================================================
function normalizeResult(parsed: RingkasanSuratAI): RingkasanSuratAI {
  if (!Array.isArray(parsed.poin_penting)) parsed.poin_penting = [];
  parsed.poin_penting = parsed.poin_penting.filter(
    (p) => typeof p === 'string' && p.trim()
  );

  const validKlasifikasi: RingkasanSuratAI['klasifikasi'][] = [
    'Undangan',
    'Pemberitahuan',
    'Permohonan',
    'Tugas',
    'Lainnya',
  ];
  if (!validKlasifikasi.includes(parsed.klasifikasi)) {
    parsed.klasifikasi = 'Lainnya';
  }

  const validPrioritas: RingkasanSuratAI['prioritas'][] = [
    'Tinggi',
    'Sedang',
    'Rendah',
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