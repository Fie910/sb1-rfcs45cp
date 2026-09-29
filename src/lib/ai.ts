// src/lib/ai.ts
// AI client untuk Gemini API — dipakai untuk auto-resume notulensi.
//
// Docs: https://ai.google.dev/gemini-api/docs/models
// Free tier: 15 RPM, 1.500 RPD (Gemini Flash)

import { supabase } from './supabase';

// =============================================================================
// CONFIG
// =============================================================================
// Ganti sesuai ketersediaan model di project Google AI Studio Anda:
// - 'gemini-2.5-flash'  → stabil, retiring Okt 2026
// - 'gemini-3.5-flash'  → stabil, recommended
// - 'gemini-3.6-flash'  → terbaru, stabil
// Model list — dicoba berurutan saat model utama gagal (503/429)
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

function getApiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

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

export type PolishOptions = {
  mode: 'formal' | 'ringkas' | 'detail';
};

// =============================================================================
// HEALTH CHECK
// =============================================================================
/** Cek apakah API key tersedia & model bisa diakses */
export async function checkAiAvailable(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Ping' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// MAIN — GENERATE RESUME NOTULENSI
// =============================================================================
/**
 * Generate resume/notulensi rapat dengan AI berdasarkan input mentah dari notulis.
 * Return structured data (JSON parsed).
 */
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
  if (!API_KEY) {
    throw new Error('Gemini API key belum diset. Hubungi administrator.');
  }

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
  "pembahasan": "Poin-poin pembahasan terstruktur. Gunakan format:\\n- Poin 1\\n- Poin 2\\n- dst. Kalau ada sub-poin, gunakan indentasi 2 spasi.",
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
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('AI tidak mengembalikan respons. Coba lagi.');
    }

    // Bersihkan markdown code fence kalau ada
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as ResumeNotulensiResult;

    // Normalize action_items
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
export async function polishText(
  text: string,
  mode: PolishOptions['mode'] = 'formal'
): Promise<string> {
  if (!API_KEY) throw new Error('Gemini API key belum diset.');

  const modeInstruction = {
    formal: 'Ubah menjadi bahasa Indonesia formal & profesional, sesuai standar administrasi sekolah.',
    ringkas: 'Ringkas menjadi 2-3 kalimat padat tanpa kehilangan informasi penting.',
    detail: 'Kembangkan dengan detail, tambahkan konteks bila perlu, tapi jangan mengarang fakta.',
  }[mode];

  const prompt = `Tugas: ${modeInstruction}

Teks asli:
${text}

Output: Hanya teks hasil, tanpa penjelasan tambahan.`;

  const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error ${response.status}`);
  const data = await response.json();
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result) throw new Error('AI tidak mengembalikan respons.');
  return result.trim();
}

// =============================================================================
// AUTO-TITLE
// =============================================================================
export async function generateJudulRapat(pembahasan: string): Promise<string> {
  if (!API_KEY) throw new Error('Gemini API key belum diset.');

  const prompt = `Berdasarkan catatan rapat berikut, buat judul rapat yang singkat (maks 60 karakter), formal, dan menggambarkan inti rapat. Output: HANYA judul, tanpa tanda kutip atau penjelasan.

Catatan:
${pembahasan.slice(0, 1500)}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 100 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error ${response.status}`);
  const data = await response.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().replace(/^["']|["']$/g, '');
}