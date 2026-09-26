// src/components/arsip/DashboardArsipTab.tsx
// Tab Dashboard Arsip — KPI, storage monitor, retensi tracker, aktivitas.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, BarChart3, FolderArchive, TrendingUp, AlertTriangle,
  HardDrive, Eye, RefreshCw, CheckCircle2, Clock, XCircle,
  FileText, Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import {
  getKategoriBadge, getStatusDokumenBadge,
  formatFileSize, formatTanggalArsip,
  getRetensiBadge,
  INPUT_CLASS,
} from './shared';
import type {
  ArsipWithRelations, ArsipKategori, ArsipAktivitas,
} from '@/types/database';

const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB Supabase free

export function DashboardArsipTab() {
  const [list, setList] = useState<ArsipWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<ArsipKategori[]>([]);
  const [aktivitas, setAktivitas] = useState<(ArsipAktivitas & { guru_nama?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dokRes, katRes, aktRes] = await Promise.all([
        supabase
          .from('v_arsip_lengkap')
          .select('*')
          .is('deleted_at', null),
        supabase
          .from('arsip_kategori')
          .select('*')
          .order('urutan_tampil'),
        supabase
          .from('arsip_aktivitas')
          .select('*, guru:gurus!guru_id(nama_lengkap)')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (dokRes.error) throw dokRes.error;

      setList((dokRes.data as ArsipWithRelations[]) ?? []);
      setKategoriList((katRes.data as ArsipKategori[]) ?? []);
      setAktivitas(
        ((aktRes.data as any[]) ?? []).map((a) => ({
          ...a,
          guru_nama: a.guru?.nama_lengkap ?? null,
        }))
      );
    } catch (err: any) {
      showToast('error', 'Gagal memuat dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const total = list.length;
    const aktif = list.filter((d) => d.status === 'Aktif').length;
    const draft = list.filter((d) => d.status === 'Draft').length;
    const obsolete = list.filter((d) => d.status === 'Obsolete').length;
    const dicabut = list.filter((d) => d.status === 'Dicabut').length;

    // Storage
    const totalBytes = list.reduce((s, d) => s + (d.file_size ?? 0), 0);
    const originalBytes = list.reduce((s, d) => s + (d.original_size ?? d.file_size ?? 0), 0);
    const hematBytes = originalBytes - totalBytes;
    const persenStorage = (totalBytes / STORAGE_LIMIT) * 100;

    // Retensi
    const siapMusnah = list.filter((d) => {
      const b = getRetensiBadge(d.tanggal_retensi);
      return b && b.label.startsWith('Lewat');
    }).length;
    const soonRetensi = list.filter((d) => {
      const b = getRetensiBadge(d.tanggal_retensi);
      return b && !b.label.startsWith('Lewat');
    }).length;

    // Compliance
    let totalPembaca = 0, totalSudahBaca = 0, totalAck = 0;
    list.forEach((d) => {
      totalPembaca += d.total_pembaca ?? 0;
      totalSudahBaca += d.total_sudah_baca ?? 0;
      totalAck += d.total_acknowledge ?? 0;
    });
    const persenCompliance = totalPembaca > 0
      ? Math.round((totalAck / totalPembaca) * 100)
      : 0;

    // Per kategori
    const byKategori = new Map<string, { nama: string; warna: string; count: number; bytes: number }>();
    list.forEach((d) => {
      const key = d.kategori_id;
      const existing = byKategori.get(key) ?? {
        nama: d.kategori_nama ?? '-',
        warna: d.kategori_warna ?? 'slate',
        count: 0,
        bytes: 0,
      };
      existing.count++;
      existing.bytes += d.file_size ?? 0;
      byKategori.set(key, existing);
    });
    const kategoriStats = Array.from(byKategori.values()).sort((a, b) => b.count - a.count);

    return {
      total, aktif, draft, obsolete, dicabut,
      totalBytes, originalBytes, hematBytes, persenStorage,
      siapMusnah, soonRetensi,
      totalPembaca, totalSudahBaca, totalAck, persenCompliance,
      kategoriStats,
    };
  }, [list]);

  // Top dokumen by views
  const topViews = useMemo(() => {
    return [...list]
      .sort((a, b) => (b.total_views ?? 0) - (a.total_views ?? 0))
      .slice(0, 5);
  }, [list]);

  // Dokumen perlu retensi (top 5)
  const perluRetensi = useMemo(() => {
    return list
      .map((d) => ({ doc: d, badge: getRetensiBadge(d.tanggal_retensi) }))
      .filter((x) => x.badge !== null)
      .sort((a, b) => {
        const aDays = parseInt(a.badge?.label.match(/\d+/)?.[0] ?? '0');
        const bDays = parseInt(b.badge?.label.match(/\d+/)?.[0] ?? '0');
        return aDays - bDays;
      })
      .slice(0, 5);
  }, [list]);

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
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-indigo-400" size={20} /> Dashboard Arsip
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistik, storage monitor, dan compliance tracking
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi icon={FolderArchive} label="Total Dokumen" value={stats.total} subtitle={`${stats.aktif} aktif`} color="indigo" />
        <BigKpi icon={HardDrive} label="Storage Terpakai" value={formatFileSize(stats.totalBytes)} subtitle={`${stats.persenStorage.toFixed(1)}% dari 1 GB`} color={stats.persenStorage > 70 ? 'rose' : 'emerald'} />
        <BigKpi icon={AlertTriangle} label="Perlu Retensi" value={stats.siapMusnah + stats.soonRetensi} subtitle={`${stats.siapMusnah} siap musnah`} color="amber" />
        <BigKpi icon={CheckCircle2} label="Compliance" value={`${stats.persenCompliance}%`} subtitle={`${stats.totalAck}/${stats.totalPembaca} acknowledge`} color="emerald" />
      </div>

      {/* STORAGE MONITOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <HardDrive size={12} /> Storage Monitor
          </h3>
          <span className={`text-sm font-extrabold ${
            stats.persenStorage > 70 ? 'text-rose-400' :
            stats.persenStorage > 50 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {formatFileSize(stats.totalBytes)} / 1 GB
          </span>
        </div>

        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${
              stats.persenStorage > 70 ? 'bg-rose-500' :
              stats.persenStorage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, stats.persenStorage)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] uppercase text-slate-500">Ukuran Asli</p>
            <p className="font-bold text-slate-200">{formatFileSize(stats.originalBytes)}</p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
            <p className="text-[10px] uppercase text-emerald-400">Hemat Kompresi</p>
            <p className="font-bold text-emerald-400">{formatFileSize(stats.hematBytes)}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] uppercase text-slate-500">Total File</p>
            <p className="font-bold text-slate-200">{stats.total} file</p>
          </div>
        </div>

        {stats.persenStorage > 70 && (
          <div className="mt-3 flex items-start gap-2 text-xs bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
            <AlertTriangle size={13} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300">Storage &gt;70%</p>
              <p className="text-slate-400 mt-0.5">
                Pertimbangkan cleanup dokumen obsolete atau pakai external link untuk file besar.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2 KOLOM: Distribusi + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DISTRIBUSI PER KATEGORI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
            <FolderArchive size={12} /> Distribusi Per Kategori
          </h3>
          {stats.kategoriStats.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">Belum ada data</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
              {stats.kategoriStats.map((k) => {
                const persen = stats.total > 0 ? (k.count / stats.total) * 100 : 0;
                return (
                  <div key={k.nama}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getKategoriBadge(k.warna)}`}>
                        {k.nama}
                      </span>
                      <span className="text-[11px] text-slate-300 font-bold">
                        {k.count} · {formatFileSize(k.bytes)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${persen}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STATUS DOKUMEN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
            <TrendingUp size={12} /> Status Dokumen
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Aktif', value: stats.aktif, color: 'emerald', icon: CheckCircle2 },
              { label: 'Draft', value: stats.draft, color: 'slate', icon: Clock },
              { label: 'Obsolete', value: stats.obsolete, color: 'amber', icon: AlertTriangle },
              { label: 'Dicabut', value: stats.dicabut, color: 'rose', icon: XCircle },
            ].map((s) => {
              const Icon = s.icon;
              const cm: Record<string, string> = {
                emerald: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
                slate: 'text-slate-400 bg-slate-800 border-slate-700',
                amber: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
                rose: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
              };
              return (
                <div key={s.label} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${cm[s.color]}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-200">{s.label}</p>
                  </div>
                  <p className={`text-lg font-extrabold ${cm[s.color].split(' ')[0]}`}>{s.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2 KOLOM: Retensi + Top Views */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PERLU RETENSI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Perlu Retensi Segera ({perluRetensi.length})
          </h3>
          {perluRetensi.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">Tidak ada dokumen mendesak</p>
          ) : (
            <div className="space-y-2">
              {perluRetensi.map(({ doc, badge }) => (
                <div key={doc.id} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <FileText size={14} className="text-slate-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{doc.judul}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {doc.nomor_dokumen ?? '-'} · Retensi: {formatTanggalArsip(doc.tanggal_retensi)}
                    </p>
                  </div>
                  {badge && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${badge.style}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOP VIEWS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
            <Eye size={12} /> Paling Sering Dilihat
          </h3>
          {topViews.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-4">Belum ada data</p>
          ) : (
            <div className="space-y-2">
              {topViews.map((doc, i) => (
                <div key={doc.id} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <span className="text-[11px] font-mono font-bold text-slate-500 w-4 shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{doc.judul}</p>
                    <p className="text-[10px] text-slate-500 truncate">{doc.kategori_nama}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0">
                    {doc.total_views ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AKTIVITAS TERBARU */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
          <Activity size={12} /> Aktivitas Terbaru
        </h3>
        {aktivitas.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-4">Belum ada aktivitas</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {aktivitas.map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                  a.aksi === 'Create' || a.aksi === 'Upload_Versi'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : a.aksi === 'View' || a.aksi === 'Download'
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : a.aksi === 'Hapus' || a.aksi === 'Cabut'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  <Activity size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {a.aksi} {a.guru_nama ? `— ${a.guru_nama}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(a.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB
// =============================================================================
type BigKpiColor = 'indigo' | 'emerald' | 'amber' | 'rose';
const CM: Record<BigKpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function BigKpi({
  icon: Icon, label, value, subtitle, color,
}: {
  icon: typeof FolderArchive;
  label: string;
  value: string | number;
  subtitle?: string;
  color: BigKpiColor;
}) {
  const c = CM[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className={`text-xl font-extrabold mt-0.5 ${c.text}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500 mt-1 truncate">{subtitle}</p>}
    </div>
  );
}