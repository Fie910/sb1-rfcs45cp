// src/components/sarpras/DashboardSarprasTab.tsx
// Tab Dashboard Sarpras — KPI & visualisasi data inventaris.
// Hanya bisa diakses oleh role manager (admin/kepala/wakil_kepala/sarpras).

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Wrench,
  Trash2,
  DollarSign,
  RefreshCw,
  Loader2,
  MapPin,
  PieChart as PieIcon,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { formatRupiahShort, formatRupiah } from './shared';

// =============================================================================
// TYPES
// =============================================================================

type AsetRow = {
  kondisi: string;
  status: string;
  harga_perolehan: number | null;
  jumlah: number;
  kategori_id: string | null;
  lokasi_id: string | null;
};

type PeminjamanRow = {
  tanggal_pinjam: string;
  status: string;
};

type KategoriRow = { id: string; nama: string };
type LokasiRow = { id: string; nama: string };

// =============================================================================
// KONSTANTA WARNA
// =============================================================================

const KONDISI_COLORS: Record<string, string> = {
  Baik: '#10b981',
  'Rusak Ringan': '#f59e0b',
  'Rusak Berat': '#ef4444',
};

const CHART_COLORS = [
  '#6366f1',
  '#3b82f6',
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
];

// =============================================================================
// HELPER BULAN
// =============================================================================

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
}

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

export function DashboardSarprasTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [aset, setAset] = useState<AsetRow[]>([]);
  const [peminjaman, setPeminjaman] = useState<PeminjamanRow[]>([]);
  const [kategori, setKategori] = useState<KategoriRow[]>([]);
  const [lokasi, setLokasi] = useState<LokasiRow[]>([]);
  const [pemeliharaanAktif, setPemeliharaanAktif] = useState(0);
  const [penghapusanMenunggu, setPenghapusanMenunggu] = useState(0);
  const [peminjamanAktif, setPeminjamanAktif] = useState(0);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Hitung batas 6 bulan ke belakang
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

      const [
        asetRes,
        peminjamanRes,
        kategoriRes,
        lokasiRes,
        peliharaRes,
        hapusRes,
        pinjamAktifRes,
      ] = await Promise.all([
        supabase
          .from('inventaris_sarpras')
          .select('kondisi, status, harga_perolehan, jumlah, kategori_id, lokasi_id'),
        supabase
          .from('inventaris_peminjaman')
          .select('tanggal_pinjam, status')
          .gte('tanggal_pinjam', sixMonthsAgoStr),
        supabase.from('kategori_sarpras').select('id, nama'),
        supabase.from('inventaris_lokasi').select('id, nama'),
        supabase
          .from('inventaris_pemeliharaan')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Dijadwalkan', 'Berlangsung']),
        supabase
          .from('inventaris_penghapusan')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Menunggu'),
        supabase
          .from('inventaris_peminjaman')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Dipinjam', 'Terlambat']),
      ]);

      setAset((asetRes.data as AsetRow[]) || []);
      setPeminjaman((peminjamanRes.data as PeminjamanRow[]) || []);
      setKategori((kategoriRes.data as KategoriRow[]) || []);
      setLokasi((lokasiRes.data as LokasiRow[]) || []);
      setPemeliharaanAktif(peliharaRes.count ?? 0);
      setPenghapusanMenunggu(hapusRes.count ?? 0);
      setPeminjamanAktif(pinjamAktifRes.count ?? 0);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      showToast('error', 'Gagal memuat data dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // ==========================================================================
  // KPI STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const totalAset = aset.length;
    const totalUnit = aset.reduce((s, a) => s + (a.jumlah ?? 0), 0);
    const nilaiTotal = aset.reduce(
      (s, a) => s + (Number(a.harga_perolehan ?? 0) * (a.jumlah ?? 0)),
      0
    );
    const baik = aset.filter((a) => a.kondisi === 'Baik').length;
    const rusakRingan = aset.filter((a) => a.kondisi === 'Rusak Ringan').length;
    const rusakBerat = aset.filter((a) => a.kondisi === 'Rusak Berat').length;
    const persenBaik = totalAset > 0 ? Math.round((baik / totalAset) * 100) : 0;

    return {
      totalAset,
      totalUnit,
      nilaiTotal,
      baik,
      rusakRingan,
      rusakBerat,
      persenBaik,
    };
  }, [aset]);

  // ==========================================================================
  // PIE — KONDISI ASET
  // ==========================================================================
  const pieKondisi = useMemo(
    () => [
      { name: 'Baik', value: stats.baik },
      { name: 'Rusak Ringan', value: stats.rusakRingan },
      { name: 'Rusak Berat', value: stats.rusakBerat },
    ],
    [stats]
  );

  // ==========================================================================
  // BAR — NILAI PER KATEGORI (Top 6)
  // ==========================================================================
  const barKategori = useMemo(() => {
    const map = new Map<string, number>();
    aset.forEach((a) => {
      if (!a.kategori_id) return;
      const nilai = Number(a.harga_perolehan ?? 0) * (a.jumlah ?? 0);
      map.set(a.kategori_id, (map.get(a.kategori_id) ?? 0) + nilai);
    });
    return Array.from(map.entries())
      .map(([kategoriId, nilai]) => ({
        name: kategori.find((k) => k.id === kategoriId)?.nama ?? 'Tanpa Kategori',
        nilai,
      }))
      .sort((a, b) => b.nilai - a.nilai)
      .slice(0, 6);
  }, [aset, kategori]);

  // ==========================================================================
  // AREA — TREN PEMINJAMAN 6 BULAN
  // ==========================================================================
  const areaTren = useMemo(() => {
    const months = getLast6Months();
    const map = new Map<string, number>();
    months.forEach((m) => map.set(m.key, 0));

    peminjaman.forEach((p) => {
      const key = p.tanggal_pinjam.slice(0, 7);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    });

    return months.map((m) => ({
      name: m.label,
      Peminjaman: map.get(m.key) ?? 0,
    }));
  }, [peminjaman]);

  // ==========================================================================
  // BAR — ASET PER LOKASI (Top 5)
  // ==========================================================================
  const barLokasi = useMemo(() => {
    const map = new Map<string, number>();
    aset.forEach((a) => {
      if (!a.lokasi_id) return;
      map.set(a.lokasi_id, (map.get(a.lokasi_id) ?? 0) + (a.jumlah ?? 0));
    });
    return Array.from(map.entries())
      .map(([lokasiId, jumlah]) => ({
        name: lokasi.find((l) => l.id === lokasiId)?.nama ?? 'Tanpa Lokasi',
        jumlah,
      }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 5);
  }, [aset, lokasi]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat dashboard sarpras...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-indigo-400" size={20} />
            Dashboard Sarpras
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ringkasan kondisi, nilai, dan aktivitas inventaris sekolah
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={Package}
          label="Total Aset"
          value={String(stats.totalAset)}
          sub={`${stats.totalUnit} unit`}
          color="indigo"
        />
        <KpiCard
          icon={DollarSign}
          label="Nilai Total"
          value={formatRupiahShort(stats.nilaiTotal)}
          sub={formatRupiah(stats.nilaiTotal)}
          color="teal"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Kondisi Baik"
          value={`${stats.persenBaik}%`}
          sub={`${stats.baik} aset`}
          color="emerald"
        />
        <KpiCard
          icon={Send}
          label="Sedang Dipinjam"
          value={String(peminjamanAktif)}
          sub="aktif"
          color="amber"
        />
        <KpiCard
          icon={Wrench}
          label="Dalam Perbaikan"
          value={String(pemeliharaanAktif)}
          sub="work order"
          color="orange"
        />
        <KpiCard
          icon={Trash2}
          label="Usul Hapus"
          value={String(penghapusanMenunggu)}
          sub="menunggu"
          color="rose"
        />
      </div>

      {/* ROW 1: Pie + Bar Kategori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Kondisi */}
        <ChartCard title="Kondisi Aset" icon={PieIcon}>
          {stats.totalAset === 0 ? (
            <EmptyChart label="Belum ada data aset" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieKondisi.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={(entry: any) =>
                    `${entry.name}: ${entry.value}`
                  }
                  labelLine={false}
                  style={{ fontSize: 11, fill: '#cbd5e1' }}
                >
                  {pieKondisi.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={KONDISI_COLORS[entry.name] ?? '#64748b'}
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
                  formatter={(v: any) => [`${v} aset`, '']}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Bar Nilai per Kategori */}
        <ChartCard title="Nilai Aset per Kategori (Top 6)" icon={BarChart3}>
          {barKategori.length === 0 ? (
            <EmptyChart label="Belum ada data kategori" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barKategori} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => formatRupiahShort(Number(v ?? 0))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [formatRupiah(Number(v ?? 0)), 'Nilai']}
                />
                <Bar dataKey="nilai" radius={[0, 6, 6, 0]}>
                  {barKategori.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ROW 2: Area Tren + Bar Lokasi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Area Tren Peminjaman */}
        <ChartCard title="Tren Peminjaman 6 Bulan Terakhir" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={areaTren} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientPinjam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
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
                formatter={(v: any) => [`${v} peminjaman`, '']}
              />
              <Area
                type="monotone"
                dataKey="Peminjaman"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradientPinjam)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar Lokasi */}
        <ChartCard title="Distribusi Aset per Lokasi (Top 5)" icon={MapPin}>
          {barLokasi.length === 0 ? (
            <EmptyChart label="Belum ada data lokasi" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barLokasi} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                  formatter={(v: any) => [`${v} unit`, 'Jumlah']}
                />
                <Bar dataKey="jumlah" radius={[6, 6, 0, 0]}>
                  {barLokasi.map((_, i) => (
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

type KpiColor = 'indigo' | 'teal' | 'emerald' | 'amber' | 'orange' | 'rose';

const COLOR_MAP: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub: string;
  color: KpiColor;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-lg ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}
        >
          <Icon size={13} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
          {label}
        </span>
      </div>
      <p className={`text-xl font-extrabold ${c.text} truncate`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-indigo-400" />
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