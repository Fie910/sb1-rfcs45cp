// src/components/SpeechToText.tsx
// Komponen Speech-to-Text dual-mode:
//   🎙️ Live   → Web Speech API (Chrome/Edge), real-time, gratis
//   📼 Rekam  → Groq Whisper Large V3, akurasi tinggi, Bahasa Indonesia
//
// Cara pakai (di parent):
//   <SpeechToText onTranscript={(text) => setCatatan(prev => prev + ' ' + text)} />

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Square, Loader2, Copy, Check, Trash2, AlertCircle,
  Radio, Headphones, Sparkles, Info,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { transcribeAudio, isWhisperAvailable } from '@/lib/ai/whisper';

// ============================================================================
// TYPES
// ============================================================================
interface SpeechToTextProps {
  /** Callback saat transkrip selesai (dipanggil 1x setelah stop). */
  onTranscript: (text: string) => void;
  /** Konteks untuk bantu Whisper (nama orang, istilah khusus, dll). Opsional. */
  contextPrompt?: string;
  /** Label tombol "sisipkan" (default: "Sisipkan ke Catatan"). */
  insertLabel?: string;
  /** Compact mode — untuk dipakai di modal sempit. */
  compact?: boolean;
}

type Mode = 'live' | 'record';
type LiveStatus = 'idle' | 'listening' | 'error';

// TypeScript: tambah tipe untuk webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================
export function SpeechToText({
  onTranscript,
  contextPrompt,
  insertLabel = 'Sisipkan ke Catatan',
  compact = false,
}: SpeechToTextProps) {
  const [mode, setMode] = useState<Mode>('live');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Live mode state
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const recognitionRef = useRef<any>(null);

  // Record mode state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Deteksi dukungan Web Speech API
  const SpeechRecognitionAPI =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const liveSupported = Boolean(SpeechRecognitionAPI);

  // Default mode: Live kalau didukung, kalau tidak → Record
  useEffect(() => {
    if (!liveSupported && isWhisperAvailable()) {
      setMode('record');
    }
  }, [liveSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      try {
        mediaRecorderRef.current?.stop?.();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // ==========================================================================
  // LIVE MODE — Web Speech API
  // ==========================================================================
  const startLive = useCallback(() => {
    if (!liveSupported) {
      setError('Browser Anda tidak mendukung mode Live. Gunakan mode Rekam.');
      return;
    }
    setError(null);
    setInterim('');

    try {
      const rec = new SpeechRecognitionAPI();
      rec.lang = 'id-ID';           // Bahasa Indonesia
      rec.continuous = true;         // Jangan auto-stop saat ada jeda
      rec.interimResults = true;     // Tampilkan hasil sementara
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript + ' ';
          } else {
            interimText += res[0].transcript;
          }
        }
        if (finalText) {
          setTranscript((prev) => (prev + ' ' + finalText).trim());
        }
        setInterim(interimText);
      };

      rec.onerror = (event: any) => {
        console.error('[live-stt] error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('Akses mikrofon ditolak. Izinkan di pengaturan browser.');
        } else if (event.error === 'no-speech') {
          // Diam sebentar — biarkan saja
        } else if (event.error === 'network') {
          setError('Koneksi internet bermasalah. Web Speech API butuh internet.');
        } else {
          setError(`Error: ${event.error}`);
        }
        setLiveStatus('error');
      };

      rec.onend = () => {
        // Chrome kadang auto-stop — auto-restart kalau masih listening
        setLiveStatus((prev) => {
          if (prev === 'listening') {
            try {
              rec.start();
            } catch {}
            return 'listening';
          }
          return 'idle';
        });
      };

      rec.start();
      recognitionRef.current = rec;
      setLiveStatus('listening');
    } catch (e: any) {
      setError('Gagal memulai microphone: ' + (e?.message ?? e));
      setLiveStatus('error');
    }
  }, [liveSupported, SpeechRecognitionAPI]);

  const stopLive = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    recognitionRef.current = null;
    setLiveStatus('idle');
    setInterim('');
  }, []);

  // ==========================================================================
  // RECORD MODE — Groq Whisper
  // ==========================================================================
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung perekaman audio.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Pilih MIME type yang didukung
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop semua track microphone
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setError('Rekaman terlalu pendek. Coba bicara lebih lama.');
          setIsTranscribing(false);
          return;
        }

        // Transkripsi
        setIsTranscribing(true);
        try {
          const result = await transcribeAudio(blob, {
            language: 'id',
            prompt: contextPrompt,
          });
          if (!result.text) {
            setError('Tidak ada suara yang terdeteksi. Coba rekam ulang.');
          } else {
            setTranscript((prev) => (prev + ' ' + result.text).trim());
            showToast('success', `Transkripsi selesai (${Math.round(result.duration ?? 0)}s)`);
          }
        } catch (e: any) {
          setError(e?.message ?? 'Gagal transkripsi.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(1000); // chunk setiap 1 detik
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Akses mikrofon ditolak. Izinkan di pengaturan browser.');
      } else {
        setError('Gagal mulai merekam: ' + msg);
      }
    }
  }, [contextPrompt]);

  const stopRecording = useCallback(() => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================
  const handleInsert = () => {
    const text = transcript.trim();
    if (!text) {
      showToast('info', 'Belum ada teks untuk disisipkan.');
      return;
    }
    onTranscript(text);
    setTranscript('');
    setInterim('');
    showToast('success', 'Teks disisipkan ke catatan');
  };

  const handleCopy = async () => {
    const text = transcript.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', 'Teks disalin ke clipboard');
    } catch {
      showToast('error', 'Gagal menyalin');
    }
  };

  const handleClear = () => {
    setTranscript('');
    setInterim('');
    setError(null);
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  const isLiveActive = liveStatus === 'listening';
  const isBusy = isLiveActive || isRecording || isTranscribing;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <Headphones size={15} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">Speech to Text</p>
            <p className="text-[10px] text-slate-500">
              Rekam suara → jadikan teks (Bahasa Indonesia)
            </p>
          </div>
        </div>

        {/* Mode switcher */}
        {!compact && (
          <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setMode('live')}
              disabled={isBusy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                mode === 'live'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={!liveSupported ? 'Browser tidak mendukung' : 'Real-time via browser'}
            >
              <Radio size={12} /> Live
              {!liveSupported && (
                <span className="text-[9px] text-amber-400 font-normal">(N/A)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('record')}
              disabled={isBusy || !isWhisperAvailable()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                mode === 'record'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={
                !isWhisperAvailable()
                  ? 'Butuh Groq API key'
                  : 'Rekam dulu → upload ke Groq Whisper'
              }
            >
              <Mic size={12} /> Rekam
            </button>
          </div>
        )}
      </div>

      {/* Mode Info */}
      <div className="flex items-start gap-2 text-[10px] text-slate-400 bg-slate-950/60 border border-slate-800/60 rounded-lg px-2.5 py-1.5">
        <Info size={10} className="shrink-0 mt-0.5 text-indigo-400" />
        <span>
          {mode === 'live'
            ? 'Real-time via browser (Chrome/Edge). Bicara → teks muncul langsung. Butuh internet.'
            : 'Rekam suara → kirim ke Groq Whisper (akurat). Cocok untuk rapat panjang.'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {mode === 'live' ? (
          isLiveActive ? (
            <button
              type="button"
              onClick={stopLive}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/20"
            >
              <MicOff size={14} /> Hentikan Live
            </button>
          ) : (
            <button
              type="button"
              onClick={startLive}
              disabled={!liveSupported || isTranscribing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <Mic size={14} /> Mulai Dengar
            </button>
          )
        ) : isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/20"
          >
            <Square size={14} /> Stop Rekam ({fmtTime(recordingTime)})
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={isTranscribing || !isWhisperAvailable()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Mic size={14} /> Mulai Rekam
          </button>
        )}

        {/* Live indicator */}
        {isLiveActive && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-rose-300">Mendengarkan...</span>
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-rose-300">Merekam...</span>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
            <Loader2 size={12} className="animate-spin text-indigo-400" />
            <span className="text-xs font-bold text-indigo-300">Transkripsi...</span>
          </div>
        )}
      </div>

      {/* Transcript display */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 min-h-[100px] max-h-[240px] overflow-y-auto">
        {transcript || interim ? (
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {transcript}
            {interim && (
              <span className="text-slate-500 italic"> {interim}</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Hasil transkripsi akan muncul di sini...
          </p>
        )}
      </div>

      {/* Actions */}
      {(transcript || interim) && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleInsert}
            disabled={!transcript.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Sparkles size={12} />
            {insertLabel}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
          >
            <Copy size={12} /> Salin
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-bold text-xs transition-all cursor-pointer"
          >
            <Trash2 size={12} /> Hapus
          </button>
        </div>
      )}
    </div>
  );
}