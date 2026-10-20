// src/lib/ai/whisper.ts
// Speech-to-Text via Groq Whisper Large V3 Turbo.
// Support Bahasa Indonesia. Sekarang juga mengembalikan SEGMENTS (timestamp).

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

const WHISPER_MODEL = 'whisper-large-v3-turbo';

export interface TranscribedSegment {
  id: number;
  start: number;  // detik
  end: number;    // detik
  text: string;
}

export interface TranscribeOptions {
  /** Kode bahasa ISO-639-1. 'id' = Bahasa Indonesia. Default: 'id' */
  language?: string;
  /** Prompt konteks untuk bantu Whisper (nama, istilah khusus, dll). */
  prompt?: string;
  /** Minta Whisper mengembalikan segment timestamps (untuk speaker diarization). */
  includeSegments?: boolean;
}

export interface TranscribeResult {
  text: string;
  duration?: number;
  language?: string;
  segments?: TranscribedSegment[];
}

export async function transcribeAudio(
  audioBlob: Blob,
  opts: TranscribeOptions = {}
): Promise<TranscribeResult> {
  if (!GROQ_KEY || !GROQ_KEY.startsWith('gsk_')) {
    throw new Error('Groq API key tidak valid / belum diset.');
  }

  const MAX_MB = 25;
  const sizeMb = audioBlob.size / (1024 * 1024);
  if (sizeMb > MAX_MB) {
    throw new Error(
      `Rekaman terlalu besar (${sizeMb.toFixed(1)} MB). Maksimal ${MAX_MB} MB (~40 menit).`
    );
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', WHISPER_MODEL);
  formData.append('language', opts.language ?? 'id');
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');

  // ✅ Minta segment timestamps kalau perlu
  if (opts.includeSegments) {
    formData.append('timestamp_granularities[]', 'segment');
  }

  // ✅ Append prompt HANYA JIKA user mengirimkannya (dan hanya SEKALI)
  const userPrompt = opts.prompt?.trim() ?? '';
  if (userPrompt) {
    // Batasi 900 karakter (limit Whisper ~224 token)
    formData.append('prompt', userPrompt.slice(0, 900));
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      // ⚠️ Jangan set 'Content-Type' manual — browser handle boundary-nya
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[whisper] Groq error:', res.status, errText);
    if (res.status === 413) throw new Error('Rekaman terlalu besar untuk Groq (max 25 MB).');
    if (res.status === 401) throw new Error('Groq API key tidak valid atau expired.');
    if (res.status === 429) throw new Error('Kuota Groq habis. Coba lagi nanti atau pakai mode Live.');
    throw new Error(`Gagal transkripsi (HTTP ${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  // Normalisasi segments (id bisa datang sebagai angka, kadang string)
  const segments: TranscribedSegment[] | undefined = Array.isArray(data.segments)
    ? data.segments.map((s: any, i: number) => ({
        id: typeof s.id === 'number' ? s.id : i,
        start: Number(s.start ?? 0),
        end: Number(s.end ?? 0),
        text: String(s.text ?? '').trim(),
      }))
    : undefined;

  return {
    text: (data.text ?? '').trim(),
    duration: data.duration,
    language: data.language,
    segments,
  };
}

export function isWhisperAvailable(): boolean {
  return Boolean(GROQ_KEY && GROQ_KEY.startsWith('gsk_'));
}