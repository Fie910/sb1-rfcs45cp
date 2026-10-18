// src/lib/ai/pengumumanAi.ts
import { generateJSON, hasAnyProvider } from './aiProvider';
import { buildPengumumanPrompt } from './prompts/pengumuman';

export type RingkasanPengumumanAI = {
  ringkasan: string;
  poin_aksi: string[];
};

export async function generateRingkasanPengumuman(input: {
  judul: string;
  isi: string;
  prioritas?: string | null;
}): Promise<RingkasanPengumumanAI> {
  if (!hasAnyProvider()) {
    throw new Error('Tidak ada provider AI yang dikonfigurasi');
  }

  // Skip kalau pengumuman terlalu pendek
  if (input.isi.trim().length < 80) {
    throw new Error('Pengumuman terlalu pendek untuk diringkas (min 80 karakter)');
  }

  const { systemPrompt, examples, userPrompt } = buildPengumumanPrompt(input);

  const { data, provider, model } = await generateJSON<RingkasanPengumumanAI>({
    prompt: userPrompt,
    systemPrompt,
    examples,
    temperature: 0.3,
    maxTokens: 1024,
    jsonMode: true,
  });

  console.info(`[pengumuman-ai] diringkas oleh ${provider}:${model}`);

  if (!Array.isArray(data.poin_aksi)) data.poin_aksi = [];
  data.ringkasan = String(data.ringkasan ?? '').trim();
  data.poin_aksi = data.poin_aksi
    .filter((p) => typeof p === 'string' && p.trim())
    .slice(0, 5);

  return data;
}