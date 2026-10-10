// src/lib/ai/ai.ts
// AI client untuk generate resume notulensi rapat.
// Multi-provider failover: Groq → Cerebras → Gemini → OpenRouter.

import { generateJSON } from './aiProvider';

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

  const systemPrompt = `Anda adalah notulis rapat profesional di sekolah SMK di Indonesia. Tugas Anda adalah mengubah catatan rapat mentah menjadi notulensi resmi yang rapi, terstruktur, dan formal dalam Bahasa Indonesia. Output WAJIB berupa JSON valid tanpa penjelasan tambahan.`;

  const userPrompt = `Konteks Rapat:
- Judul: ${input.judul_rapat}
- Jenis: ${input.jenis_rapat}
- Tanggal: ${input.tanggal}${pesertaSection}

Catatan Mentah:
${input.pembahasan_mentah}

${input.keputusan_mentah ? `Keputusan Awal:\n${input.keputusan_mentah}` : ''}

INSTRUKSI OUTPUT:
Kembalikan HANYA JSON valid dengan struktur:

{
  "ringkasan_eksekutif": "1-2 paragraf ringkasan inti rapat (100-200 kata)",
  "pembahasan": "Poin-poin pembahasan terstruktur dengan format:\\n- Poin 1\\n- Poin 2",
  "keputusan": "Keputusan-keputusan yang diambil dengan format:\\n1. Keputusan pertama\\n2. Keputusan kedua",
  "action_items": [
    {
      "deskripsi": "Deskripsi tugas konkret (mulai dengan kata kerja)",
      "pic_nama": "Nama PIC atau null",
      "deadline": "YYYY-MM-DD atau null",
      "prioritas": "Tinggi|Sedang|Rendah"
    }
  ]
}

ATURAN PENTING:
1. JANGAN mengarang informasi yang tidak ada di catatan mentah.
2. Kalau tidak ada keputusan, isi dengan "Belum ada keputusan formal yang diambil dalam rapat ini."
3. Kalau tidak ada action item, kembalikan array kosong [].
4. Bahasa harus formal dan profesional, sesuai standar administrasi sekolah.
5. Pertahankan istilah teknis, nama orang, nama tempat, dan nomor surat apa adanya.
6. Output HARUS valid JSON.`;

  try {
    const { data, provider, model } = await generateJSON<ResumeNotulensiResult>({
      prompt: userPrompt,
      systemPrompt,
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