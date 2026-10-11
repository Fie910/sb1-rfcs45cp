// src/lib/ai/whisper.ts
// Speech-to-Text via Groq Whisper Large V3 Turbo.
// Support Bahasa Indonesia. Input: audio Blob dari MediaRecorder.
// Max 25 MB per request (≈ 40 menit rekaman).

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

// Model alternatif (kalau perlu akurasi maksimal, ~2x lebih lambat):
//   'whisper-large-v3'      → akurasi tertinggi
//   'whisper-large-v3-turbo' → cepat & tetap akurat (default kita)
const WHISPER_MODEL = 'whisper-large-v3-turbo';

export interface TranscribeOptions {
  /** Kode bahasa ISO-639-1. 'id' = Bahasa Indonesia. Default: 'id' */
  language?: string;
  /** Prompt konteks untuk bantu Whisper (nama, istilah khusus, dll). */
  prompt?: string;
}

export interface TranscribeResult {
  text: string;
  duration?: number;
  language?: string;
}

/**
 * Transkripsi audio Blob → teks.
 * Audio dari MediaRecorder biasanya format WebM/Opus — didukung Groq.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  opts: TranscribeOptions = {}
): Promise<TranscribeResult> {
  if (!GROQ_KEY || !GROQ_KEY.startsWith('gsk_')) {
    throw new Error('Groq API key tidak valid / belum diset.');
  }

  // Cek ukuran (Groq limit 25 MB)
  const MAX_MB = 25;
  const sizeMb = audioBlob.size / (1024 * 1024);
  if (sizeMb > MAX_MB) {
    throw new Error(
      `Rekaman terlalu besar (${sizeMb.toFixed(1)} MB). ` +
      `Maksimal ${MAX_MB} MB (~40 menit). Coba rekam lebih pendek atau bagi menjadi beberapa sesi.`
    );
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', WHISPER_MODEL);
  formData.append('language', opts.language ?? 'id');
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');
  if (opts.prompt) {
    formData.append('prompt', opts.prompt.slice(0, 900));
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      // JANGAN set Content-Type — biar browser yang set multipart boundary
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[whisper] Groq error:', res.status, errText);
    if (res.status === 413) {
      throw new Error('Rekaman terlalu besar untuk Groq (max 25 MB).');
    }
    if (res.status === 401) {
      throw new Error('Groq API key tidak valid atau expired.');
    }
    if (res.status === 429) {
      throw new Error('Kuota Groq habis. Coba lagi nanti atau pakai mode Live.');
    }
    throw new Error(`Gagal transkripsi (HTTP ${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    text: (data.text ?? '').trim(),
    duration: data.duration,
    language: data.language,
  };
}

export function isWhisperAvailable(): boolean {
  return Boolean(GROQ_KEY && GROQ_KEY.startsWith('gsk_'));
}