// src/components/SpeechToText.tsx
// Speech-to-Text dual-mode + speaker diarization (LLM-based).
//
//   🎙️ Live   → Web Speech API (Chrome/Edge), real-time, gratis
//   📼 Rekam  → Groq Whisper Large V3, akurasi tinggi, Bahasa Indonesia
//   🎭 Identifikasi Pembicara → LLM (Guru BK/Siswa atau nama rapat)

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Square, Loader2, Copy, Check, Trash2, AlertCircle,
  Radio, Headphones, Sparkles, Info, Users, User, Pencil, X,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { transcribeAudio, isWhisperAvailable } from '@/lib/ai/whisper';
import {
  attributeSpeakers,
  formatAsDialog,
  renameSpeaker,
  type SpeakerMode,
  type AttributedSegment,
} from '@/lib/ai/speakerAttribution';

// ============================================================================
// TYPES
// ============================================================================
interface SpeechToTextProps {
  onTranscript: (text: string) => void;
  contextPrompt?: string;
  insertLabel?: string;
  compact?: boolean;
  /** 🆕 Izinkan identifikasi pembicara. Default: false. */
  enableSpeakerMode?: boolean;
  /** Default mode untuk speaker (kalau enableSpeakerMode = true). */
  defaultSpeakerMode?: SpeakerMode;
}

type Mode = 'live' | 'record';
type LiveStatus = 'idle' | 'listening' | 'error';
type SpeakerModeState = 'off' | SpeakerMode;

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
  enableSpeakerMode = false,
  defaultSpeakerMode = 'konseling',
}: SpeechToTextProps) {
  const [mode, setMode] = useState<Mode>('live');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 🆕 Speaker mode state
  const [speakerMode, setSpeakerMode] = useState<SpeakerModeState>(
    enableSpeakerMode ? defaultSpeakerMode : 'off'
  );
  const [attributed, setAttributed] = useState<AttributedSegment[] | null>(null);
  const [isAttributing, setIsAttributing] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Live mode
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const recognitionRef = useRef<any>(null);

  // Record mode
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const SpeechRecognitionAPI =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const liveSupported = Boolean(SpeechRecognitionAPI);

  useEffect(() => {
    if (!liveSupported && isWhisperAvailable()) {
      setMode('record');
    }
  }, [liveSupported]);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
      try { mediaRecorderRef.current?.stop?.(); } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // ==========================================================================
  // LIVE MODE
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
      rec.lang = 'id-ID';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + ' ';
          else interimText += res[0].transcript;
        }
        if (finalText) setTranscript((prev) => (prev + ' ' + finalText).trim());
        setInterim(interimText);
      };

      rec.onerror = (event: any) => {
        console.error('[live-stt] error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('Akses mikrofon ditolak. Izinkan di pengaturan browser.');
        } else if (event.error === 'no-speech') {
          // ignore
        } else if (event.error === 'network') {
          setError('Koneksi internet bermasalah.');
        } else {
          setError(`Error: ${event.error}`);
        }
        setLiveStatus('error');
      };

      rec.onend = () => {
        setLiveStatus((prev) => {
          if (prev === 'listening') {
            try { rec.start(); } catch {}
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
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
    setLiveStatus('idle');
    setInterim('');
  }, []);

  // ==========================================================================
  // RECORD MODE (Groq Whisper)
  // ==========================================================================
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung perekaman audio.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

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
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setError('Rekaman terlalu pendek.');
          setIsTranscribing(false);
          return;
        }

        setIsTranscribing(true);
        try {
          // 🆕 Minta segments kalau speaker mode aktif
          const wantSegments = speakerMode !== 'off';
          const result = await transcribeAudio(blob, {
            language: 'id',
            prompt: contextPrompt,
            includeSegments: wantSegments,
          });

          if (!result.text) {
            setError('Tidak ada suara yang terdeteksi.');
          } else {
            setTranscript((prev) => (prev + ' ' + result.text).trim());
            showToast('success', `Transkripsi selesai (${Math.round(result.duration ?? 0)}s)`);

            // 🆕 Kalau speaker mode aktif → jalankan attribution
            if (wantSegments && result.segments && result.segments.length > 0) {
              await runAttribution(result.segments, speakerMode as SpeakerMode);
            }
          }
        } catch (e: any) {
          setError(e?.message ?? 'Gagal transkripsi.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Akses mikrofon ditolak.');
      } else {
        setError('Gagal mulai merekam: ' + msg);
      }
    }
  }, [contextPrompt, speakerMode]);

  const stopRecording = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  // ==========================================================================
  // 🆕 SPEAKER ATTRIBUTION
  // ==========================================================================
  const runAttribution = useCallback(
    async (segments: any[], mode: SpeakerMode) => {
      setIsAttributing(true);
      try {
        const result = await attributeSpeakers(segments, mode, {
          context: contextPrompt,
        });
        setAttributed(result.segments);
        showToast(
          'success',
          `Pembicara diidentifikasi: ${result.speakers.length} orang`
        );
      } catch (e: any) {
        console.error('[speaker] error:', e);
        setError('Gagal identifikasi pembicara: ' + (e?.message ?? 'Error'));
      } finally {
        setIsAttributing(false);
      }
    },
    [contextPrompt]
  );

  // ==========================================================================
  // ACTIONS
  // ==========================================================================
  const handleInsert = () => {
    const text = attributed
      ? formatAsDialog(attributed)
      : transcript.trim();
    if (!text) {
      showToast('info', 'Belum ada teks untuk disisipkan.');
      return;
    }
    onTranscript(text);
    setTranscript('');
    setInterim('');
    setAttributed(null);
    showToast('success', 'Teks disisipkan ke catatan');
  };

  const handleCopy = async () => {
    const text = attributed ? formatAsDialog(attributed) : transcript.trim();
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
    setAttributed(null);
    setError(null);
  };

  // 🆕 Rename speaker
  const startRename = (speaker: string) => {
    setRenaming(speaker);
    setRenameValue(speaker);
  };

  const commitRename = () => {
    if (!renaming || !attributed) return;
    const cleaned = renameValue.trim();
    if (!cleaned || cleaned === renaming) {
      setRenaming(null);
      return;
    }
    setAttributed((prev) =>
      prev ? renameSpeaker(prev, renaming, cleaned) : prev
    );
    setRenaming(null);
    showToast('success', `"${renaming}" → "${cleaned}"`);
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
  const isBusy = isLiveActive || isRecording || isTranscribing || isAttributing;

  // Daftar speaker unik untuk tombol rename
  const uniqueSpeakers = attributed
    ? Array.from(new Set(attributed.map((a) => a.speaker)))
    : [];

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
            >
              <Radio size={12} /> Live
              {!liveSupported && <span className="text-[9px] text-amber-400 font-normal">(N/A)</span>}
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
            >
              <Mic size={12} /> Rekam
            </button>
          </div>
        )}
      </div>

      {/* 🆕 Speaker Mode Selector */}
      {enableSpeakerMode && (
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
            <Users size={12} className="text-indigo-400" />
            Identifikasi Pembicara
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSpeakerMode('off')}
              disabled={isBusy}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                speakerMode === 'off'
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Nonaktif
            </button>
            <button
              type="button"
              onClick={() => setSpeakerMode('konseling')}
              disabled={isBusy || mode === 'live'}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                speakerMode === 'konseling'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title={mode === 'live' ? 'Hanya untuk mode Rekam' : 'Guru BK + Siswa'}
            >
              <User size={11} /> Konseling BK
            </button>
            <button
              type="button"
              onClick={() => setSpeakerMode('rapat')}
              disabled={isBusy || mode === 'live'}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                speakerMode === 'rapat'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title={mode === 'live' ? 'Hanya untuk mode Rekam' : 'Banyak pembicara'}
            >
              <Users size={11} /> Rapat
            </button>
          </div>
          {speakerMode !== 'off' && mode === 'live' && (
            <p className="text-[10px] text-amber-400">
              ⚠ Identifikasi pembicara hanya bisa di mode <strong>Rekam</strong>. Ganti mode ke Rekam.
            </p>
          )}
          {speakerMode !== 'off' && mode === 'record' && (
            <p className="text-[10px] text-slate-500">
              {speakerMode === 'konseling'
                ? 'Setiap segmen akan diberi label: Guru BK / Siswa.'
                : 'Nama atau label pembicara dideteksi dari konteks (nama disebutkan, dsb).'}
            </p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-[10px] text-slate-400 bg-slate-950/60 border border-slate-800/60 rounded-lg px-2.5 py-1.5">
        <Info size={10} className="shrink-0 mt-0.5 text-indigo-400" />
        <span>
          {mode === 'live'
            ? 'Real-time via browser (Chrome/Edge). Bicara → teks muncul langsung.'
            : 'Rekam suara → kirim ke Groq Whisper (akurat & gratis).'}
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
            disabled={isTranscribing || isAttributing || !isWhisperAvailable()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Mic size={14} /> Mulai Rekam
          </button>
        )}

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
        {isAttributing && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <Loader2 size={12} className="animate-spin text-purple-400" />
            <span className="text-xs font-bold text-purple-300">Identifikasi Pembicara...</span>
          </div>
        )}
      </div>

      {/* 🆕 Rename Speakers (kalau ada attributed) */}
      {attributed && uniqueSpeakers.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Pembicara Terdeteksi ({uniqueSpeakers.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueSpeakers.map((sp) =>
              renaming === sp ? (
                <div
                  key={sp}
                  className="flex items-center gap-1 bg-slate-900 border border-indigo-500/40 rounded-lg px-2 py-1"
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="bg-transparent text-xs text-slate-100 outline-none w-24"
                  />
                  <button
                    onClick={commitRename}
                    className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setRenaming(null)}
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  key={sp}
                  onClick={() => startRename(sp)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs font-bold transition-all cursor-pointer"
                  title="Klik untuk ubah nama"
                >
                  {sp}
                  <Pencil size={10} className="opacity-60" />
                </button>
              )
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            💡 Klik nama untuk mengganti (misal: "Peserta 1" → "Pak Ahmad").
          </p>
        </div>
      )}

      {/* Transcript display */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 min-h-[100px] max-h-[320px] overflow-y-auto">
        {attributed ? (
          // 🆕 Tampilan dialog
          <div className="space-y-3">
            {attributed.map((seg, i) => {
              const prevSpeaker = i > 0 ? attributed[i - 1].speaker : null;
              const showSpeaker = seg.speaker !== prevSpeaker;
              return (
                <div key={i} className="flex gap-2">
                  <div className="w-20 shrink-0">
                    {showSpeaker && (
                      <span className="text-[11px] font-bold text-indigo-400">
                        {seg.speaker}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed flex-1">
                    {seg.text}
                  </p>
                </div>
              );
            })}
          </div>
        ) : transcript || interim ? (
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {transcript}
            {interim && <span className="text-slate-500 italic"> {interim}</span>}
          </p>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Hasil transkripsi akan muncul di sini...
          </p>
        )}
      </div>

      {/* Actions */}
      {(transcript || interim || attributed) && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleInsert}
            disabled={!transcript.trim() && !attributed}
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