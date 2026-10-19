// src/components/dashboard-kepsek/AiInsightSection.tsx
// AI Insight — analisa kondisi sekolah via Gemini, dengan cache harian.

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Loader2, RefreshCw, AlertCircle, Lightbulb,
  Clock, Info, CheckCircle2,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import {
  generateDashboardInsight,
  type DashboardInsightInput,
  type DashboardInsightResult,
} from '@/lib/ai/dashboardInsight';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  input: DashboardInsightInput | null;
  ready: boolean;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

function getCacheKey(): string {
  return `kepsek_insight_v1_${new Date().toISOString().slice(0, 10)}`;
}

function loadCached(): DashboardInsightResult | null {
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardInsightResult;
    const age = Date.now() - new Date(parsed.generatedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(result: DashboardInsightResult): void {
  try {
    localStorage.setItem(getCacheKey(), JSON.stringify(result));
  } catch {
    /* ignore quota error */
  }
}

// =============================================================================
// COMPONENT
// =============================================================================
export function AiInsightSection({ input, ready }: Props) {
  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cache on mount
  useEffect(() => {
    setResult(loadCached());
  }, []);

  // ===========================================================================
  // HANDLE GENERATE
  // ===========================================================================
  const handleGenerate = useCallback(async () => {
    if (!input || !ready) {
      showToast('error', 'Data belum siap. Coba refresh dulu.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const insight = await generateDashboardInsight(input);
      setResult(insight);
      saveCache(insight);
      showToast('success', 'AI Insight berhasil di-generate');
    } catch (err: any) {
      setError(err.message || 'Gagal generate AI insight');
      showToast('error', err.message || 'Gagal generate');
    } finally {
      setLoading(false);
    }
  }, [input, ready]);

  // ===========================================================================
  // HELPERS
  // ===========================================================================
  const isFresh = (generatedAt: string): boolean => {
    const age = Date.now() - new Date(generatedAt).getTime();
    return age < CACHE_TTL_MS;
  };

  const levelStyle: Record<string, string> = {
    Tinggi: 'border-rose-500/40 bg-rose-500/10',
    Sedang: 'border-amber-500/40 bg-amber-500/10',
    Rendah: 'border-slate-700 bg-slate-950/40',
  };

  const levelBadge: Record<string, string> = {
    Tinggi: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    Sedang: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Rendah: 'bg-slate-700/50 text-slate-300 border-slate-600',
  };

  // ===========================================================================
  // RENDER — EMPTY STATE
  // ===========================================================================
  if (!result && !loading && !error) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-100">
              AI Insight Sekolah
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Analisa kondisi sekolah hari ini via AI — ringkasan eksekutif,
              perhatian khusus, dan rekomendasi actionable.
            </p>
            <button
              onClick={handleGenerate}
              disabled={!ready}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!ready ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Menunggu data...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate Insight AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER — LOADING
  // ===========================================================================
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-purple-400" />
          <h3 className="text-sm font-bold text-slate-100">
            AI Insight Sekolah
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={32} className="animate-spin text-purple-400" />
          <p className="text-xs text-slate-400">
            AI sedang menganalisa kondisi sekolah...
          </p>
          <p className="text-[10px] text-slate-500">
            Proses ini memerlukan 5-10 detik
          </p>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER — ERROR
  // ===========================================================================
  if (error) {
    return (
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={14} className="text-rose-400" />
          <h3 className="text-sm font-bold text-slate-100">AI Insight Gagal</h3>
        </div>
        <p className="text-xs text-rose-300 mb-3">{error}</p>
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
        >
          <RefreshCw size={12} /> Coba Lagi
        </button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER — RESULT
  // ===========================================================================
  if (!result) return null;

  return (
    <div className="bg-gradient-to-br from-purple-900/20 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              AI Insight Sekolah
            </h3>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock size={9} />
              {new Date(result.generatedAt).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {isFresh(result.generatedAt) ? (
                <span className="ml-1 text-emerald-400">· Fresh</span>
              ) : (
                <span className="ml-1 text-amber-400">· Usang</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Ringkasan */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1">
          <Info size={10} /> Ringkasan Eksekutif
        </p>
        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
          {result.ringkasan}
        </p>
      </div>

      {/* Perhatian Khusus */}
      {result.perhatian_khusus.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1">
            <AlertCircle size={10} /> Perhatian Khusus
          </p>
          <div className="space-y-2">
            {result.perhatian_khusus.map((p, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border ${levelStyle[p.level] ?? levelStyle.Rendah}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${levelBadge[p.level] ?? levelBadge.Rendah}`}
                  >
                    {p.level}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    {p.kategori}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {p.isi}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rekomendasi */}
      {result.rekomendasi.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1">
            <Lightbulb size={10} /> Rekomendasi
          </p>
          <ul className="space-y-1.5">
            {result.rekomendasi.map((r, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-800/60"
              >
                <CheckCircle2
                  size={12}
                  className="text-emerald-400 shrink-0 mt-0.5"
                />
                <span className="text-xs text-slate-200 leading-relaxed">
                  {r}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}