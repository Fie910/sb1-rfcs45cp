// src/components/bk/DashboardBKTab.tsx
// Dashboard BK — KPI, chart, dan analitik layanan.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Loader2, MessageSquare, Heart,
  UserCheck, ClipboardList, TrendingUp, PieChart as PieIcon,
  Users, AlertCircle, Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

// =============================================================================
// KONSTANTA WARNA
// =============================================================================

const BIDANG_COLORS: Record<string, string> = {
  Pribadi: '#a855f7',
  Sosial: '#3b82f6',
  Belajar: '#10b981',
  Karier: '#f59e0b',
};

const CHART_COLORS = ['#a855f7', '#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899'];

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
// KOMPONEN UTAMA
// =============================================================================

export function DashboardBKTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [konseling, setKonseling] = useState<any[]>([]);
  const [curhat, setCurhat] = useState<any[]>([]);
  const [rujukan, setRujukan] = useState<any[]>([]);
  const [asesmen, setAsesmen] = useState<any[]>([]);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

      const [kRes, cRes, rRes, aRes] = await Promise.all([
        supabase
          .from('bk_konseling')
          .select('id, tanggal, tipe, status, kategori:kategori_id (id, nama, bidang)')
          .gte('tanggal', sixMonthsAgoStr),
        supabase
          .from('bk_curhat')
          .select('id, created_at, tingkat_urgensi, status, kategori:kategori_id (id, nama, bidang)')
          .gte('created_at', sixMonthsAgoStr),
        supabase
          .from('bk_rujukan')
          .select('id, tanggal_rujuk, status, prioritas, sumber')
          .gte('tanggal_rujuk', sixMonthsAgoStr),
        supabase
          .from('bk_asesmen')
          .select('id, tanggal, jenis')
          .gte('tanggal', sixMonthsAgoStr),
      ]);

      setKonseling(kRes.data ?? []);
      setCurhat(cRes.data ?? []);
      setRujukan(rRes.data ?? []);
      setAsesmen(aRes.data ?? []);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      showToast('error', 'Gagal memuat dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // ==========================================================================
  // KPI STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const totalKonseling = konseling.length;
    const totalCurhat = curhat.length;
    const totalRujukan = rujukan.length;
    const totalAsesmen = asesmen.length;
    const curhatBaru = curhat.filter((c) => c.status === 'Baru').length;
    const curhatDarurat = curhat.filter((c) => c.tingkat_urgensi === 'Darurat').length;
    const rujukanBaru = rujukan.filter((r) => r.status === 'Baru').length;
    const rujukanTinggi = rujukan.filter((r) => r.prioritas === 'Tinggi').length;
    return {
      totalKonseling,
      totalCurhat,
      totalRujukan,
      totalAsesmen,
      curhatBaru,
      curhatDarurat,
      rujukanBaru,
      rujukanTinggi,
    };
  }, [konseling, curhat, rujukan, asesmen]);

  // ==========================================================================
  // PIE — DISTRIBUSI BIDANG (dari kategori konseling)
  // ==========================================================================
  const pieBidang = useMemo(() => {
    const map = new Map<string, number>();
    konseling.forEach((k: any) => {
      const bidang = k.kategori?.bidang;
      if (bidang) map.set(bidang, (map.get(bidang) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [konseling]);

  // ==========================================================================
  // BAR — TOP KATEGORI MASALAH (Top 6)
  // ==========================================================================
  const barKategori = useMemo(() => {
    const map = new Map<string, number>();
    konseling.forEach((k: any) => {
      const nama = k.kategori?.nama;
      if (nama) map.set(nama, (map.get(nama) ?? 0) + 1);
    });
    curhat.forEach((c: any) => {
      const nama = c.kategori?.nama;
      if (nama) map.set(nama, (map.get(nama) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [konseling, curhat]);

  // ==========================================================================
  // AREA — TREN BULANAN 6 BULAN
  // ==========================================================================
  const areaTren = useMemo(() => {
    const months = getLast6Months();
    const map = new Map<string, { konseling: number; curhat: number; rujukan: number }>();
    months.forEach((m) => map.set(m.key, { konseling: 0, curhat: 0, rujukan: 0 }));

    konseling.forEach((k: any) => {
      const key = k.tanggal.slice(0, 7);
      const entry = map.get(key);
      if (entry) entry.konseling += 1;
    });

    curhat.forEach((c: any) => {
      const key = c.created_at.slice(0, 7);
      const entry = map.get(key);
      if (entry) entry.curhat += 1;
    });

    rujukan.forEach((r: any) => {
      const key = r.tanggal_rujuk.slice(0, 7);
      const entry = map.get(key);
      if (entry) entry.rujukan += 1;
    });

    return months.map((m) => ({
      name: m.label,
      Konseling: map.get(m.key)?.konseling ?? 0,
      Curhat: map.get(m.key)?.curhat ?? 0,
      Rujukan: map.get(m.key)?.rujukan ?? 0,
    }));
  }, [konseling, curhat, rujukan]);

  // ==========================================================================
  // PIE — TIPE KONSELING
  // ==========================================================================
  const pieTipe = useMemo(() => {
    const map = new Map<string, number>();
    konseling.forEach((k: any) => {
      map.set(k.tipe, (map.get(k.tipe) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [konseling]);

  // ==========================================================================
  // BAR — DISTRIBUSI JENIS ASESMEN
  // ==========================================================================
  const barJenisAsesmen = useMemo(() => {
    const map = new Map<string, number>();
    asesmen.forEach((a: any) => {
      map.set(a.jenis, (map.get(a.jenis) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [asesmen]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-purple-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat dashboard BK...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-purple-400" size={20} />
            Dashboard BK
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ringkasan aktivitas layanan BK — 6 bulan terakhir
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard icon={MessageSquare} label="Sesi Konseling" value={stats.totalKonseling} color="purple" />
        <KpiCard icon={Heart} label="Curhat" value={stats.totalCurhat} color="rose" />
        <KpiCard icon={UserCheck} label="Rujukan" value={stats.totalRujukan} color="indigo" />
        <KpiCard icon={ClipboardList} label="Asesmen" value={stats.totalAsesmen} color="amber" />
        <KpiCard icon={AlertCircle} label="Curhat Baru" value={stats.curhatBaru} color="purple" pulse={stats.curhatBaru > 0} />
        <KpiCard icon={AlertCircle} label="Darurat" value={stats.curhatDarurat} color="rose" pulse={stats.curhatDarurat > 0} />
        <KpiCard icon={UserCheck} label="Rujukan Baru" value={stats.rujukanBaru} color="indigo" />
        <KpiCard icon={Users} label="Prioritas Tinggi" value={stats.rujukanTinggi} color="amber" />
      </div>

      {/* ROW 1: Pie Bidang + Pie Tipe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribusi Bidang Masalah" icon={PieIcon}>
          {pieBidang.length === 0 ? (
            <EmptyChart label="Belum ada data kategori" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieBidang}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={(e: any) => `${e.name}: ${e.value}`}
                  labelLine={false}
                  style={{ fontSize: 11, fill: '#cbd5e1' }}
                >
                  {pieBidang.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={BIDANG_COLORS[entry.name] ?? '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v} sesi`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Distribusi Tipe Konseling" icon={PieIcon}>
          {pieTipe.length === 0 ? (
            <EmptyChart label="Belum ada sesi konseling" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieTipe}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={(e: any) => `${e.name}: ${e.value}`}
                  labelLine={false}
                  style={{ fontSize: 11, fill: '#cbd5e1' }}
                >
                  {pieTipe.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v} sesi`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ROW 2: Area Tren */}
      <ChartCard title="Tren Aktivitas BK (6 Bulan)" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={areaTren}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradKonseling" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCurhat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRujukan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
            <Area
              type="monotone"
              dataKey="Konseling"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#gradKonseling)"
            />
            <Area
              type="monotone"
              dataKey="Curhat"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#gradCurhat)"
            />
            <Area
              type="monotone"
              dataKey="Rujukan"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradRujukan)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ROW 3: Bar Top Kategori + Bar Asesmen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Kategori Masalah" icon={BarChart3}>
          {barKategori.length === 0 ? (
            <EmptyChart label="Belum ada data kategori" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barKategori} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v} kasus`, '']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {barKategori.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Distribusi Jenis Asesmen" icon={ClipboardList}>
          {barJenisAsesmen.length === 0 ? (
            <EmptyChart label="Belum ada asesmen" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barJenisAsesmen} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v} asesmen`, '']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barJenisAsesmen.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

type KpiColor = 'purple' | 'rose' | 'indigo' | 'amber';

const COLOR_MAP: Record<KpiColor, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
};

function KpiCard({
  icon: Icon, label, value, color, pulse = false,
}: {
  icon: typeof Heart; label: string; value: number; color: KpiColor; pulse?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-2.5 ${pulse ? 'ring-1 ring-current ' + c.text : ''}`}>
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

function ChartCard({
  title, icon: Icon, children,
}: {
  title: string; icon: typeof BarChart3; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-purple-400" />
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