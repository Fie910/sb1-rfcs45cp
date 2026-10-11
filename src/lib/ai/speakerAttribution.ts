// src/lib/ai/speakerAttribution.ts
// LLM-based speaker diarization.
// Input: transkrip + segment timestamps dari Whisper.
// Output: setiap segmen dilabeli siapa pembicara.
//
// Mode 'konseling' → paksa 2 label (Guru BK / Siswa) — akurasi tinggi.
// Mode 'rapat'     → label bebas (nama kalau disebut, atau "Peserta N").

import { generateJSON } from './aiProvider';
import type { TranscribedSegment } from './whisper';

export type SpeakerMode = 'konseling' | 'rapat';

export interface AttributedSegment {
  start: number;
  end: number;
  text: string;
  speaker: string;
}

export interface AttributionResult {
  segments: AttributedSegment[];
  speakers: string[]; // daftar unik, urut kemunculan pertama
}

interface LLMLabel {
  index: number;
  speaker: string;
}

export interface AttributeSpeakersOptions {
  context?: string;
  peserta?: string[];
}

export async function attributeSpeakers(
  segments: TranscribedSegment[],
  mode: SpeakerMode,
  opts: AttributeSpeakersOptions = {}
): Promise<AttributionResult> {
  if (segments.length === 0) {
    return { segments: [], speakers: [] };
  }

  // Format input: [0] teks, [1] teks, ...
  const numbered = segments
    .map((s, i) => `[${i}] ${s.text}`)
    .join('\n');

  const systemPrompt =
    'Anda adalah analis dialog profesional. Tugas Anda: identifikasi pembicara dari setiap segmen transkrip. Output WAJIB JSON valid tanpa penjelasan tambahan.';

  const modeInstruction =
    mode === 'konseling'
      ? `Ini adalah sesi KONSELING BK (Bimbingan Konseling) antara 1 GURU BK dan 1 SISWA.

ATURAN IDENTIFIKASI:
- Label HARUS "Guru BK" atau "Siswa" (persis 2 nilai ini, tanpa variasi).
- Guru BK biasanya: bertanya, memberi nasihat/motivasi, memakai kata sapaan "Nak", "Ananda", "Silakan", "Bagaimana", "Coba ceritakan", dan bisa memakai kata "Bapak"/"Ibu" merujuk ke diri sendiri.
- Siswa biasanya: menjawab pertanyaan, bercerita masalah, mengeluh, memakai kata "saya", "aku", "bu", "pak".
- Kalau ragu: lihat kalimat sebelumnya. Guru BK bertanya → Siswa menjawab. Siswa bercerita → Guru BK menanggapi.`
      : `Ini adalah transkrip RAPAT di sekolah.

ATURAN IDENTIFIKASI PEMBICARA:
- Kalau nama orang jelas disebutkan dalam percakapan (mis. "Pak Ahmad, tolong...", "seperti Bu Siti bilang..."), PAKAI nama itu (contoh: "Pak Ahmad").
- Kalau jelas ini pembawa rapat / moderator, label "Pemimpin Rapat".
- Kalau jelas ini notulis, label "Notulis".
- Kalau jelas ini narasumber tamu, label "Narasumber".
- Untuk yang tidak bisa diidentifikasi, gunakan label generic "Peserta 1", "Peserta 2", dst. Buat KONSISTEN: kalau orang yang sama bicara lagi, pakai nomor yang sama.
- JANGAN mengarang nama yang tidak disebutkan dalam transkrip.`;

  const contextInfo = opts.context ? `\n\nKonteks tambahan: ${opts.context}` : '';
  const pesertaInfo = opts.peserta?.length
    ? `\n\nPeserta rapat (kalau ada, cocokkan dengan yang muncul di transkrip): ${opts.peserta.join(', ')}`
    : '';

  const userPrompt = `${modeInstruction}${contextInfo}${pesertaInfo}

TRANSKRIP (setiap baris = 1 segmen, format: [index] teks):
${numbered}

TUGAS:
Untuk SETIAP segmen (index 0 sampai ${segments.length - 1}), tentukan pembicara.
Output JSON:
{
  "labels": [
    { "index": 0, "speaker": "..." },
    { "index": 1, "speaker": "..." }
  ]
}

ATURAN:
1. Harus ada SATU label untuk setiap index dari 0 sampai ${segments.length - 1}. Tidak boleh ada yang terlewat.
2. Konsisten: orang yang sama → label yang sama.
3. Output HARUS JSON valid, tanpa markdown fence.`;

  const { data } = await generateJSON<{ labels: LLMLabel[] }>({
    prompt: userPrompt,
    systemPrompt,
    temperature: 0.2,
    maxTokens: 8192,
    jsonMode: true,
  });

  // Map hasil
  const labelMap = new Map<number, string>();
  (data.labels ?? []).forEach((l) => {
    if (typeof l.index === 'number' && l.speaker) {
      labelMap.set(l.index, String(l.speaker).trim() || 'Tidak Diketahui');
    }
  });

  const attributed: AttributedSegment[] = segments.map((s, i) => ({
    start: s.start,
    end: s.end,
    text: s.text,
    speaker: labelMap.get(i) ?? 'Tidak Diketahui',
  }));

  // Daftar speaker unik
  const speakers: string[] = [];
  const seen = new Set<string>();
  for (const a of attributed) {
    if (!seen.has(a.speaker)) {
      seen.add(a.speaker);
      speakers.push(a.speaker);
    }
  }

  return { segments: attributed, speakers };
}

/**
 * Format atribusi jadi dialog yang bisa dibaca / disimpan.
 * Group segmen yang berurutan dari speaker yang sama → 1 baris.
 */
export function formatAsDialog(segments: AttributedSegment[]): string {
  if (segments.length === 0) return '';

  const lines: string[] = [];
  let currentSpeaker = segments[0].speaker;
  let buffer = segments[0].text;

  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    if (s.speaker === currentSpeaker) {
      buffer += ' ' + s.text;
    } else {
      lines.push(`**${currentSpeaker}:** ${buffer.trim()}`);
      currentSpeaker = s.speaker;
      buffer = s.text;
    }
  }
  lines.push(`**${currentSpeaker}:** ${buffer.trim()}`);

  return lines.join('\n\n');
}

/**
 * Ganti nama speaker di seluruh segmen (untuk rename setelah dihasilkan).
 */
export function renameSpeaker(
  segments: AttributedSegment[],
  oldName: string,
  newName: string
): AttributedSegment[] {
  const clean = newName.trim();
  if (!clean) return segments;
  return segments.map((s) =>
    s.speaker === oldName ? { ...s, speaker: clean } : s
  );
}