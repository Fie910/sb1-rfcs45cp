// src/lib/ai/ai.ts
// AI client untuk generate resume notulensi rapat.
// Multi-provider failover: Groq → Cerebras → Gemini → OpenRouter.

import { generateJSON } from './aiProvider';
import { buildNotulensiPrompt } from './prompts/notulensi';

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
// HEALTH CHECK
// =============================================================================
export { checkAiAvailable } from './aiProvider';

// =============================================================================
// MAIN — GENERATE RESUME NOTULENSI
// =============================================================================
export async function generateResumeNotulensi(input: {
  judul_rapat: string;
  jenis_rapat: string;
  tanggal: string;
  pembahasan_mentah: string;
  keputusan_mentah?: string;
  peserta_list?: string[];
}): Promise<ResumeNotulensiResult> {
  const pesertaSection = input.peserta_list?.length
    ? `\n\nDaftar peserta: ${input.peserta_list.join(', ')}`
    : '';

    const { systemPrompt, examples, userPrompt } = buildNotulensiPrompt({
    judul_rapat: input.judul_rapat,
    jenis_rapat: input.jenis_rapat,
    tanggal: input.tanggal,
    pembahasan_mentah: input.pembahasan_mentah,
    keputusan_mentah: input.keputusan_mentah,
    peserta_list: input.peserta_list,
  });

  try {
    const { data, provider, model } = await generateJSON<ResumeNotulensiResult>({
      prompt: userPrompt,
      systemPrompt,
      examples,
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    });

    console.info(`[notulensi] dihasilkan oleh ${provider}:${model}`);

    // Normalisasi
    if (!Array.isArray(data.action_items)) data.action_items = [];
    data.action_items = data.action_items.map((a) => ({
      deskripsi: a.deskripsi ?? '',
      pic_nama: a.pic_nama ?? null,
      deadline: a.deadline ?? null,
      prioritas: (['Tinggi', 'Sedang', 'Rendah'].includes(a.prioritas)
        ? a.prioritas
        : 'Sedang') as 'Tinggi' | 'Sedang' | 'Rendah',
    }));

    return data;
  } catch (err: any) {
    console.error('[ai] generateResumeNotulensi error:', err);
    throw new Error(err.message || 'Gagal generate resume dengan AI.');
  }
}