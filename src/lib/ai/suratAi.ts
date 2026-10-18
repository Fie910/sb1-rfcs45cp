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
  const { systemPrompt, examples, userPrompt } = buildSuratPrompt();

  try {
    const { data, provider, model } = await generateJSONVision<RingkasanSuratAI>({
      prompt: userPrompt,
      systemPrompt,
      examples,
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