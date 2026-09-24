// src/components/hris/DokumenSayaTab.tsx
// Tab "Dokumen Saya" — self-service dashboard dokumen pribadi + expiry tracker.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, FileText, ShieldCheck, AlertTriangle, CheckCircle2,
  Clock, XCircle, ClipboardCheck, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { DokumenSection } from './DokumenSection';
import {
  getDokumenExpiryBadge, getKategoriDokumenBadge, getKategoriDokumenIcon,
  formatDateShort,
  DOKUMEN_WAJIB,
} from './shared';
import type { HrisDokumen } from '@/types/database';

// =============================================================================
// KOMPONEN
// =============================================================================
export function DokumenSayaTab() {
  const { guru } = useAuth();
  const [docs, setDocs] = useState<HrisDokumen[]>([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // FETCH (untuk KPI & alert)
  // ==========================================================================
  const fetchDocs = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hris_dokumen')
        .select('*')
        .eq('guru_id', guru.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs((data as HrisDokumen[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat dokumen: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    let verified = 0, expired = 0, soon = 0, valid = 0;
    docs.forEach((d) => {
      if (d.is_verified) verified++;
      const badge = getDokumenExpiryBadge(d.tanggal_expired);
      if (!badge) { valid++; return; }
      if (badge.label === 'Expired') expired++;
      else soon++;
    });
    return {
      total: docs.length,
      verified,
      unverified: docs.length - verified,
      expired,
      soon,
      valid,
    };
  }, [docs]);

  // Dokumen wajib yang belum ada
  const missingWajib = useMemo(() => {
    const tersedia = new Set(docs.map((d) => d.kategori));
    return DOKUMEN_WAJIB.filter((k) => !tersedia.has(k));
  }, [docs]);

  const completeWajib = DOKUMEN_WAJIB.length - missingWajib.length;

  // Alert list (expired & soon) — max 5
  const alertDocs = useMemo(() => {
    return docs
      .map((d) => ({ doc: d, badge: getDokumenExpiryBadge(d.tanggal_expired) }))
      .filter((x) => x.badge !== null)
      .sort((a, b) => {
        const aExp = a.badge?.label === 'Expired' ? 0 : 1;
        const bExp = b.badge?.label === 'Expired' ? 0 : 1;
        if (aExp !== bExp) return aExp - bExp;
        return (a.doc.tanggal_expired ?? '').localeCompare(b.doc.tanggal_expired ?? '');
      })
      .slice(0, 5);
  }, [docs]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ============================ HEADER ============================ */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-100 tracking-tight">
              Dokumen Saya
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Kelola SK, sertifikat, ijazah, dan dokumen kepegawaian lainnya
            </p>
          </div>
        </div>
      </div>

      {/* ============================ KPI CARDS ============================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={FileText}
          label="Total Dokumen"
          value={stats.total}
          color="indigo"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Terverifikasi"
          value={stats.verified}
          subtitle={stats.unverified > 0 ? `${stats.unverified} belum` : 'semua OK'}
          color="emerald"
        />
        <KpiCard
          icon={XCircle}
          label="Expired"
          value={stats.expired}
          subtitle={stats.expired > 0 ? 'perlu diperbarui' : 'aman'}
          color="rose"
        />
        <KpiCard
          icon={Clock}
          label="Akan Expired"
          value={stats.soon}
          subtitle={stats.soon > 0 ? '≤ 90 hari' : 'aman'}
          color="amber"
        />
      </div>

      {/* ============================ CHECKLIST DOKUMEN WAJIB ============================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={14} className="text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Checklist Dokumen Wajib
            </h3>
          </div>
          <span
            className={`text-xs font-extrabold ${
              completeWajib === DOKUMEN_WAJIB.length
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {completeWajib}/{DOKUMEN_WAJIB.length}
          </span>
        </div>

        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${
              completeWajib === DOKUMEN_WAJIB.length
                ? 'bg-emerald-500'
                : 'bg-amber-500'
            }`}
            style={{
              width: `${(completeWajib / DOKUMEN_WAJIB.length) * 100}%`,
            }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {DOKUMEN_WAJIB.map((kat) => {
            const sudahAda = !missingWajib.includes(kat);
            return (
              <div
                key={kat}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-semibold ${
                  sudahAda
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                }`}
              >
                {sudahAda ? (
                  <CheckCircle2 size={13} className="shrink-0" />
                ) : (
                  <AlertTriangle size={13} className="shrink-0" />
                )}
                <span className="truncate">{kat}</span>
              </div>
            );
          })}
        </div>

        {missingWajib.length === 0 && (
          <p className="text-[11px] text-emerald-400 mt-3 flex items-center gap-1.5">
            <Sparkles size={12} /> Semua dokumen wajib sudah lengkap. Terima kasih! 🎉
          </p>
        )}
      </div>

      {/* ============================ ALERT EXPIRY ============================ */}
      {alertDocs.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Perhatian — {alertDocs.length} Dokumen Perlu Diperbarui
            </h3>
          </div>

          <div className="space-y-2">
            {alertDocs.map(({ doc, badge }) => {
              const Icon = getKategoriDokumenIcon(doc.kategori);
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${getKategoriDokumenBadge(
                      doc.kategori
                    )}`}
                  >
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {doc.nama_dokumen}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {doc.kategori}
                      {doc.tanggal_expired && ` · Expired: ${formatDateShort(doc.tanggal_expired)}`}
                    </p>
                  </div>
                  {badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${badge.style}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================ SECTION CRUD (list + upload) ============================ */}
      <DokumenSection guruId={guru?.id ?? ''} editable={true} />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN — KPI Card
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'amber' | 'rose';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  subtitle?: string;
  color: KpiColor;
}) {
  const c = CM[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
          <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
        </div>
      </div>
      {subtitle && (
        <p className="text-[10px] text-slate-500 mt-1.5 truncate">{subtitle}</p>
      )}
    </div>
  );
}