// src/components/kedisiplinan/DashboardKedisiplinanTab.tsx
// Dashboard Kedisiplinan — KPI + 4 chart + ranking siswa.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Loader2, AlertTriangle, Trophy,
  FileWarning, TrendingUp, PieChart as PieIcon, Users,
  Award, Medal, Crown,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { getRekomendasiSP } from './shared';

// =============================================================================
// KONSTANTA
// =============================================================================

const LEVEL_COLORS: Record<string, string> = {
  Ringan: '#f59e0b',
  Sedang: '#f97316',
  Berat: '#ef4444',
};

const TINGKAT_COLORS = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#a855f7'];

// =============================================================================
// HELPERS
// =============================================================================

function getLast6Months(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    result.push({ key, label });
  }
  return result;
}

// =============================================================================
// KOMPONEN
// =============================================================================

export function DashboardKedisiplinanTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pelanggaran, setPelanggaran] = useState<any[]>([]);
  const [prestasi, setPrestasi] = useState<any[]>([]);
  const [spList, setSpList] = useState<any[]>([]);
  const [siswaList, setSiswaList] = useState<any[]>([]);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

      const [pelRes, presRes, spRes, siswaRes] = await Promise.all([
        supabase.from('kesiswaan_pelanggaran')
          .select(`
            id, siswa_id, tanggal, poin,
            kategori:kategori_id (id, nama, kategori)
          `)
          .gte('tanggal', sixMonthsAgoStr),
        supabase.from('kesiswaan_prestasi')
          .select('id, siswa_id, tanggal, poin, tingkat')
          .gte('tanggal', sixMonthsAgoStr),
        supabase.from('kesiswaan_surat_peringatan')
          .select('id, siswa_id, level, status, tanggal_terbit'),
        supabase.from('siswas')
          .select('id, nisn, nama_lengkap, kelas:kelas_id (id, nama_kelas)')
          .eq('status', 'AKTIF'),
      ]);

      setPelanggaran(pelRes.data ?? []);
      setPrestasi(presRes.data ?? []);
      setSpList(spRes.data ?? []);
      setSiswaList(siswaRes.data ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(false); }, [fetchAll]);

  // ==========================================================================
  // MAPS
  // ==========================================================================
  const siswaMap = useMemo(() => {
    const m = new Map<number, any>();
    siswaList.forEach((s) => m.set(s.id, s));
    return m;
  }, [siswaList]);

  // ==========================================================================
  // KPI STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const totalPelanggaran = pelanggaran.length;
    const totalPrestasi = prestasi.length;
    const totalPoinPelanggaran = pelanggaran.reduce((s, p) => s + p.poin, 0);
    const totalPoinPrestasi = prestasi.reduce((s, p) => s + p.poin, 0);
    const spAktif = spList.filter((s) => s.status === 'Aktif').length;
    const siswaTerlibat = new Set(pelanggaran.map((p) => p.siswa_id)).size;
    const siswaBerprestasi = new Set(prestasi.map((p) => p.siswa_id)).size;
    return {
      totalPelanggaran, totalPrestasi, totalPoinPelanggaran,
      totalPoinPrestasi, spAktif, siswaTerlibat, siswaBerprestasi,
    };
  }, [pelanggaran, prestasi, spList]);

  // ==========================================================================
  // PIE — DISTRIBUSI LEVEL PELANGGARAN
  // ==========================================================================
  const pieLevel = useMemo(() => {
    const map = new Map<string, number>();
    pelanggaran.forEach((p) => {
      const lvl = p.kategori?.kategori ?? 'Ringan';
      map.set(lvl, (map.get(lvl) ?? 0) + 1);
    });
    return ['Ringan', 'Sedang', 'Berat'].map((k) => ({
      name: k, value: map.get(k) ?? 0,
    })).filter((x) => x.value > 0);
  }, [pelanggaran]);

  // ==========================================================================
  // AREA — TREN 6 BULAN
  // ==========================================================================
  const areaTren = useMemo(() => {
    const months = getLast6Months();
    const map = new Map<string, { pelanggaran: number; prestasi: number }>();
    months.forEach((m) => map.set(m.key, { pelanggaran: 0, prestasi: 0 }));

    pelanggaran.forEach((p) => {
      const key = p.tanggal.slice(0, 7);
      const e = map.get(key);
      if (e) e.pelanggaran += 1;
    });
    prestasi.forEach((p) => {
      const key = p.tanggal.slice(0, 7);
      const e = map.get(key);
      if (e) e.prestasi += 1;
    });

    return months.map((m) => ({
      name: m.label,
      Pelanggaran: map.get(m.key)?.pelanggaran ?? 0,
      Prestasi: map.get(m.key)?.prestasi ?? 0,
    }));
  }, [pelanggaran, prestasi]);

  // ==========================================================================
  // TOP 10 SISWA BERMASALAH
  // ==========================================================================
  const topBermasalah = useMemo(() => {
    const map = new Map<number, number>();
    pelanggaran.forEach((p) => {
      map.set(p.siswa_id, (map.get(p.siswa_id) ?? 0) + p.poin);
    });
    return Array.from(map.entries())
      .map(([siswaId, poin]) => ({
        siswa_id: siswaId,
        nama: siswaMap.get(siswaId)?.nama_lengkap ?? 'Siswa Terhapus',
        kelas: siswaMap.get(siswaId)?.kelas?.nama_kelas ?? '-',
        nisn: siswaMap.get(siswaId)?.nisn ?? '-',
        poin,
        rekomendasi: getRekomendasiSP(poin),
      }))
      .sort((a, b) => b.poin - a.poin)
      .slice(0, 10);
  }, [pelanggaran, siswaMap]);

  // ==========================================================================
  // TOP 10 SISWA BERPRESTASI
  // ==========================================================================
  const topBerprestasi = useMemo(() => {
    const map = new Map<number, number>();
    prestasi.forEach((p) => {
      map.set(p.siswa_id, (map.get(p.siswa_id) ?? 0) + p.poin);
    });
    return Array.from(map.entries())
      .map(([siswaId, poin]) => ({
        siswa_id: siswaId,
        nama: siswaMap.get(siswaId)?.nama_lengkap ?? 'Siswa Terhapus',
        kelas: siswaMap.get(siswaId)?.kelas?.nama_kelas ?? '-',
        nisn: siswaMap.get(siswaId)?.nisn ?? '-',
        poin,
      }))
      .sort((a, b) => b.poin - a.poin)
      .slice(0, 10);
  }, [prestasi, siswaMap]);

  // ==========================================================================
  // BAR — TOP 6 PELANGGARAN JENIS
  // ==========================================================================
  const barJenisPelanggaran = useMemo(() => {
    const map = new Map<string, number>();
    pelanggaran.forEach((p) => {
      const nama = p.kategori?.nama ?? 'Lainnya';
      map.set(nama, (map.get(nama) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [pelanggaran]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-rose-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-rose-400" size={20} /> Dashboard Kedisiplinan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistik pelanggaran, prestasi, dan SP · 6 bulan terakhir
          </p>
        </div>
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard icon={AlertTriangle} label="Total Pelanggaran" value={stats.totalPelanggaran} color="rose" />
        <KpiCard icon={TrendingUp} label="Total Poin Pelanggaran" value={stats.totalPoinPelanggaran} color="orange" />
        <KpiCard icon={Trophy} label="Total Prestasi" value={stats.totalPrestasi} color="emerald" />
        <KpiCard icon={Award} label="Total Poin Prestasi" value={stats.totalPoinPrestasi} color="teal" />
        <KpiCard icon={FileWarning} label="SP Aktif" value={stats.spAktif} color="amber" pulse={stats.spAktif > 0} />
        <KpiCard icon={Users} label="Siswa Bermasalah" value={stats.siswaTerlibat} color="indigo" />
        <KpiCard icon={Crown} label="Siswa Berprestasi" value={stats.siswaBerprestasi} color="amber" />
      </div>

      {/* ROW 1: Pie Level + Bar Top Jenis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribusi Level Pelanggaran" icon={PieIcon}>
          {pieLevel.length === 0 ? (
            <EmptyChart label="Belum ada data pelanggaran" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieLevel} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  label={(e: any) => `${e.name}: ${e.value}`}
                  labelLine={false}
                  style={{ fontSize: 11, fill: '#cbd5e1' }}>
                  {pieLevel.map((entry) => (
                    <Cell key={entry.name} fill={LEVEL_COLORS[entry.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{
                  background: '#0f172a', border: '1px solid #1e293b',
                  borderRadius: 12, fontSize: 12,
                }} formatter={(v: any) => [`${v} kasus`, '']} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 6 Jenis Pelanggaran" icon={BarChart3}>
          {barJenisPelanggaran.length === 0 ? (
            <EmptyChart label="Belum ada data pelanggaran" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barJenisPelanggaran} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name"
                  tick={{ fontSize: 10, fill: '#cbd5e1' }} width={140} />
                <Tooltip contentStyle={{
                  background: '#0f172a', border: '1px solid #1e293b',
                  borderRadius: 12, fontSize: 12,
                }} formatter={(v: any) => [`${v} kasus`, '']} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {barJenisPelanggaran.map((_, i) => (
                    <Cell key={i} fill={TINGKAT_COLORS[i % TINGKAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ROW 2: Area Tren */}
      <ChartCard title="Tren Aktivitas 6 Bulan" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={areaTren} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPres" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip contentStyle={{
              background: '#0f172a', border: '1px solid #1e293b',
              borderRadius: 12, fontSize: 12,
            }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
            <Area type="monotone" dataKey="Pelanggaran"
              stroke="#ef4444" strokeWidth={2} fill="url(#gradPel)" />
            <Area type="monotone" dataKey="Prestasi"
              stroke="#10b981" strokeWidth={2} fill="url(#gradPres)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ROW 3: Top 10 Bermasalah + Top 10 Berprestasi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Bermasalah */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-rose-400" />
            <h3 className="text-sm font-bold text-slate-100">Top 10 Siswa Bermasalah</h3>
          </div>
          {topBermasalah.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada data pelanggaran
            </div>
          ) : (
            <div className="space-y-2">
              {topBermasalah.map((s, idx) => (
                <div key={s.siswa_id}
                  className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-rose-500/30 transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                      : idx === 2 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{s.nama}</p>
                    <p className="text-[10px] text-slate-500">{s.kelas} · NISN: {s.nisn}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.rekomendasi && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        {s.rekomendasi}
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-rose-400">{s.poin}</p>
                      <p className="text-[9px] text-slate-500 uppercase">poin</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 10 Berprestasi */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Top 10 Siswa Berprestasi</h3>
          </div>
          {topBerprestasi.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada data prestasi
            </div>
          ) : (
            <div className="space-y-2">
              {topBerprestasi.map((s, idx) => (
                <div key={s.siswa_id}
                  className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-emerald-500/30 transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                      : idx === 2 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {idx === 0 ? <Crown size={14} /> : idx === 1 || idx === 2 ? <Medal size={14} /> : `#${idx + 1}`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{s.nama}</p>
                    <p className="text-[10px] text-slate-500">{s.kelas} · NISN: {s.nisn}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-emerald-400">{s.poin}</p>
                    <p className="text-[9px] text-slate-500 uppercase">poin</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

type KpiColor = 'rose' | 'orange' | 'emerald' | 'teal' | 'amber' | 'indigo';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
};

function KpiCard({ icon: Icon, label, value, color, pulse = false }: {
  icon: typeof AlertTriangle; label: string; value: number; color: KpiColor; pulse?: boolean;
}) {
  const c = CM[color];
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-2.5 ${pulse ? 'ring-1 ring-current ' + c.text : ''}`}>
      <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase text-slate-500 leading-tight">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: {
  title: string; icon: typeof BarChart3; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-rose-400" />
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      </div>
      <div className="min-h-[260px]">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-slate-500">
      <BarChart3 size={32} className="mb-2 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
  );
}