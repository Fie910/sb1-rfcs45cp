// src/components/surat/RingkasanAiSurat.tsx
// Card AI ringkasan surat — tombol generate + tampil hasil.

import { useState } from 'react';
import {
  Sparkles, Loader2, RefreshCw, Trash2, AlertTriangle, Info,
  CheckCircle2, Clock, Target, ListChecks, Wand2, X, Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ringkasSurat, isAiAvailable } from '@/lib/ai/ai/suratAi';
import type { RingkasanSuratAI } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  suratId: string;
  fileUrl: string | null;
  sifat?: string | null;
  existingRingkasan: RingkasanSuratAI | null;
  onSaved?: () => void;
};

// =============================================================================
// STYLE HELPERS
// =============================================================================
function getPrioritasStyle(prioritas: string | null | undefined) {
  switch (prioritas) {
    case 'Tinggi':
      return {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-300',
        icon: AlertTriangle,
        label: 'Prioritas Tinggi',
      };
    case 'Rendah':
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        text: 'text-slate-300',
        icon: CheckCircle2,
        label: 'Prioritas Rendah',
      };
    default:
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-300',
        icon: Clock,
        label: 'Prioritas Sedang',
      };
  }
}

function getKlasifikasiStyle(klasifikasi: string | null | undefined) {
  switch (klasifikasi) {
    case 'Undangan':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'Pemberitahuan':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Permohonan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Tugas':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function RingkasanAiSurat({
  suratId,
  fileUrl,
  sifat,
  existingRingkasan,
  onSaved,
}: Props) {
  const [ringkasan, setRingkasan] = useState<RingkasanSuratAI | null>(
    existingRingkasan
  );
  const [loading, setLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const aiAvailable = isAiAvailable();
  const isConfidential = sifat === 'Rahasia' || sifat === 'Penting';

  // ==========================================================================
  // GUARD — Tampilkan notice kalau AI tidak siap / surat rahasia
  // ==========================================================================
  if (!aiAvailable) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-slate-300">Ringkasan AI Tidak Tersedia</p>
            <p className="text-slate-500 mt-0.5">
              API key Gemini belum dikonfigurasi. Hubungi administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isConfidential) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-300">
              AI Dinonaktifkan untuk Surat Rahasia
            </p>
            <p className="text-slate-500 mt-0.5">
              Surat dengan sifat "{sifat}" tidak dapat diringkas oleh AI untuk menjaga kerahasiaan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!fileUrl) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-slate-300">File Surat Belum Diupload</p>
            <p className="text-slate-500 mt-0.5">
              Upload file surat terlebih dahulu untuk menggunakan ringkasan AI.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await ringkasSurat(fileUrl);

      const { error } = await supabase
        .from('surat')
        .update({
          ai_ringkasan: result,
          ai_processed_at: new Date().toISOString(),
        })
        .eq('id', suratId);

      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SURAT,
        targetId: suratId,
        deskripsi: `Generate ringkasan AI surat`,
      });

      setRingkasan(result);
      showToast('success', 'Ringkasan AI berhasil dibuat');
      onSaved?.();
    } catch (err: any) {
      console.error('[RingkasanAiSurat]', err);
      showToast('error', err.message || 'Gagal generate ringkasan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('surat')
        .update({
          ai_ringkasan: null,
          ai_processed_at: null,
        })
        .eq('id', suratId);

      if (error) throw error;

      setRingkasan(null);
      setShowDelete(false);
      showToast('success', 'Ringkasan dihapus');
      onSaved?.();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // RENDER — EMPTY STATE
  // ==========================================================================
  if (!ringkasan) {
    return (
      <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-purple-300">
              Ringkasan AI
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Minta AI membaca surat ini dan membuat ringkasan otomatis
              (inti, poin penting, klasifikasi, dan rekomendasi tindak lanjut).
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Menganalisis surat...</>
              ) : (
                <><Wand2 size={14} /> Generate Ringkasan</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER — HASIL
  // ==========================================================================
  const prioritasStyle = getPrioritasStyle(ringkasan.prioritas);
  const PrioritasIcon = prioritasStyle.icon;

  return (
    <>
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl overflow-hidden">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-purple-950/60 to-slate-900 px-4 py-3 border-b border-purple-500/20">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Ringkasan AI
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition disabled:opacity-50 cursor-pointer"
                title="Generate ulang"
              >
                {loading ? (
                  <><Loader2 size={10} className="animate-spin" /> Generate...</>
                ) : (
                  <><RefreshCw size={10} /> Regenerate</>
                )}
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30 transition cursor-pointer"
                title="Hapus ringkasan"
              >
                <Trash2 size={10} /> Hapus
              </button>
            </div>
          </div>
        </div>

        {/* BADGES */}
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border ${getKlasifikasiStyle(ringkasan.klasifikasi)}`}>
            <Target size={10} /> {ringkasan.klasifikasi}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border ${prioritasStyle.border} ${prioritasStyle.bg} ${prioritasStyle.text}`}>
            <PrioritasIcon size={10} /> {prioritasStyle.label}
          </span>
        </div>

        {/* INTI */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Info size={10} /> Inti Surat
          </p>
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {ringkasan.inti || '-'}
          </p>
        </div>

        {/* POIN PENTING */}
        {ringkasan.poin_penting.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <ListChecks size={10} /> Poin Penting
            </p>
            <ul className="space-y-1">
              {ringkasan.poin_penting.map((poin, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5" />
                  <span>{poin}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TINDAK LANJUT */}
        {ringkasan.tindak_lanjut && (
          <div className="px-4 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 size={10} /> Rekomendasi Tindak Lanjut
            </p>
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
              <p className="text-xs text-purple-200 leading-relaxed whitespace-pre-wrap">
                {ringkasan.tindak_lanjut}
              </p>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60">
          <p className="text-[10px] text-slate-500 italic">
            ⚠️ Ringkasan AI bersifat bantu. Harap verifikasi dengan surat asli sebelum bertindak.
          </p>
        </div>
      </div>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Hapus Ringkasan"
        message="Yakin hapus ringkasan AI? Anda bisa generate ulang kapan saja."
      />
    </>
  );
}