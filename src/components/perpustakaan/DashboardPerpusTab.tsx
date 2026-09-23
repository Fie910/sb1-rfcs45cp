// src/components/perpustakaan/DashboardPerpusTab.tsx
// Dashboard Perpustakaan — KPI, chart, statistik literasi.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Book, Library, BookOpen,
  TrendingUp, Users, Trophy, Crown, Medal, Award, Star,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { formatDateShort } from './shared';

// =============================================================================
// KONSTANTA WARNA
// =============================================================================
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444'];
const STATUS_COLORS: Record<string, string> = {
  Dipinjam: '#6366f1',
  Dikembalikan: '#10b981',
  Terlambat: '#f59e0b',
  Hilang: '#ef4444',
};

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
export function DashboardPerpusTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bukuList, setBukuList] = useState<any[]>([]);
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [anggotaList, setAnggotaList] = useState<any[]>([]);
  const [peminjamanList, setPeminjamanList] = useState<any[]>([]);
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
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      const [bukuRes, katRes, aggRes, pinjamRes, siswaRes] = await Promise.all([
        supabase.from('perpus_buku').select('id, judul, pengarang, cover_url, jumlah_total, jumlah_tersedia, kategori_id, is_aktif'),
        supabase.from('perpus_kategori').select('id, nama, kode_dewey'),
        supabase.from('perpus_anggota').select('id, tipe, status, siswa_id, guru_id, nama_lengkap'),
        supabase.from('perpus_peminjaman')
          .select('id, anggota_id, buku_id, tanggal_pinjam, tanggal_kembali, status, denda')
          .gte('tanggal_pinjam', sixMonthsAgoStr),
        supabase.from('siswas').select('id, nisn, nama_lengkap, kelas:kelas_id (id, nama_kelas)').eq('status', 'AKTIF'),
      ]);

      setBukuList(bukuRes.data ?? []);
      setKategoriList(katRes.data ?? []);
      setAnggotaList(aggRes.data ?? []);
      setPeminjamanList(pinjamRes.data ?? []);
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
  const bukuMap = useMemo(() => {
    const m = new Map<string, any>();
    bukuList.forEach((b) => m.set(b.id, b));
    return m;
  }, [bukuList]);

  const anggotaMap = useMemo(() => {
    const m = new Map<string, any>();
    anggotaList.forEach((a) => m.set(a.id, a));
    return m;
  }, [anggotaList]);

  const siswaMap = useMemo(() => {
    const m = new Map<number, any>();
    siswaList.forEach((s) => m.set(s.id, s));
    return m;
  }, [siswaList]);

  // ==========================================================================
  // KPI STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const totalJudul = bukuList.filter((b) => b.is_aktif).length;
    const totalEksemplar = bukuList.reduce((s, b) => s + (b.jumlah_total ?? 0), 0);
    const totalTersedia = bukuList.reduce((s, b) => s + (b.jumlah_tersedia ?? 0), 0);
    const totalDipinjam = totalEksemplar - totalTersedia;
    const totalAnggota = anggotaList.length;
    const aktifAnggota = anggotaList.filter((a) => a.status === 'Aktif').length;
    const totalPeminjaman = peminjamanList.length;
    const aktifPeminjaman = peminjamanList.filter((p) => p.status === 'Dipinjam').length;
    const totalDenda = peminjamanList.reduce((s, p) => s + Number(p.denda ?? 0), 0);
    return {
      totalJudul, totalEksemplar, totalTersedia, totalDipinjam,
      totalAnggota, aktifAnggota, totalPeminjaman, aktifPeminjaman, totalDenda,
    };
  }, [bukuList, anggotaList, peminjamanList]);

  // ==========================================================================
  // PIE — DISTRIBUSI KATEGORI BUKU
  // ==========================================================================
  const pieKategori = useMemo(() => {
    const map = new Map<string, number>();
    bukuList.forEach((b) => {
      if (!b.kategori_id) return;
      map.set(b.kategori_id, (map.get(b.kategori_id) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([kategoriId, value]) => ({
        name: kategoriList.find((k) => k.id === kategoriId)?.nama ?? 'Tanpa Kategori',
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [bukuList, kategoriList]);

  // ==========================================================================
  // AREA — TREN PEMINJAMAN 6 BULAN
  // ==========================================================================
  const areaTren = useMemo(() => {
    const months = getLast6Months();
    const map = new Map<string, { pinjam: number; kembali: number }>();
    months.forEach((m) => map.set(m.key, { pinjam: 0, kembali: 0 }));

    peminjamanList.forEach((p) => {
      const pinjamKey = p.tanggal_pinjam.slice(0, 7);
      const e = map.get(pinjamKey);
      if (e) e.pinjam += 1;

      if (p.tanggal_kembali) {
        const kembaliKey = p.tanggal_kembali.slice(0, 7);
        const e2 = map.get(kembaliKey);
        if (e2) e2.kembali += 1;
      }
    });

    return months.map((m) => ({
      name: m.label,
      Peminjaman: map.get(m.key)?.pinjam ?? 0,
      Pengembalian: map.get(m.key)?.kembali ?? 0,
    }));
  }, [peminjamanList]);

  // ==========================================================================
  // BAR — TOP 10 BUKU TERPOPULER
  // ==========================================================================
  const topBuku = useMemo(() => {
    const map = new Map<string, number>();
    peminjamanList.forEach((p) => {
      map.set(p.buku_id, (map.get(p.buku_id) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([bukuId, total]) => {
        const b = bukuMap.get(bukuId);
        return {
          buku_id: bukuId,
          judul: b?.judul ?? 'Buku Terhapus',
          pengarang: b?.pengarang ?? '-',
          cover_url: b?.cover_url ?? null,
          total_pinjam: total,
        };
      })
      .sort((a, b) => b.total_pinjam - a.total_pinjam)
      .slice(0, 10);
  }, [peminjamanList, bukuMap]);

  // ==========================================================================
  // TOP 10 SISWA PALING RAJIN MEMBACA
  // ==========================================================================
  const topPembaca = useMemo(() => {
    const map = new Map<string, number>();
    peminjamanList.forEach((p) => {
      const anggota = anggotaMap.get(p.anggota_id);
      if (!anggota || anggota.tipe !== 'Siswa' || !anggota.siswa_id) return;
      map.set(anggota.siswa_id, (map.get(anggota.siswa_id) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([siswaId, total]) => {
        const sid = Number(siswaId);
        const s = siswaMap.get(sid);
        return {
          siswa_id: siswaId,
          nama: s?.nama_lengkap ?? 'Siswa Terhapus',
          nisn: s?.nisn ?? '-',
          kelas: s?.kelas?.nama_kelas ?? '-',
          total_pinjam: total,
        };
      })
      .sort((a, b) => b.total_pinjam - a.total_pinjam)
      .slice(0, 10);
  }, [peminjamanList, anggotaMap, siswaMap]);

  // ==========================================================================
  // PIE — STATUS PEMINJAMAN
  // ==========================================================================
  const pieStatus = useMemo(() => {
    const map = new Map<string, number>();
    peminjamanList.forEach((p) => {
      map.set(p.status, (map.get(p.status) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [peminjamanList]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={36} />
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
            <BarChart3 className="text-indigo-400" size={20} /> Dashboard Perpustakaan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistik koleksi, sirkulasi, dan literasi siswa · 6 bulan terakhir
          </p>
        </div>
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Book} label="Judul Buku" value={stats.totalJudul} color="indigo" />
        <KpiCard icon={Library} label="Total Eksemplar" value={stats.totalEksemplar} color="purple" />
        <KpiCard icon={BookOpen} label="Tersedia" value={stats.totalTersedia} color="emerald" />
        <KpiCard icon={TrendingUp} label="Sedang Dipinjam" value={stats.totalDipinjam} color="amber" />
        <KpiCard icon={Users} label="Anggota Aktif" value={stats.aktifAnggota} color="sky" />
        <KpiCard icon={Trophy} label="Total Peminjaman" value={stats.totalPeminjaman} color="rose" />
      </div>

      {/* ROW 1: Pie Kategori + Pie Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribusi Kategori Buku" icon={PieIcon}>
          {pieKategori.length === 0 ? (
            <EmptyChart label="Belum ada data kategori" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieKategori} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  label={(e: any) => e.value}
                  labelLine={false}
                  style={{ fontSize: 11, fill: '#cbd5e1' }}>
                  {pieKategori.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{
                  background: '#0f172a', border: '1px solid #1e293b',
                  borderRadius: 12, fontSize: 12,
                }} formatter={(v: any) => [`${v} buku`, '']} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Status Peminjaman (6 Bln)" icon={PieIcon}>
          {pieStatus.length === 0 ? (
            <EmptyChart label="Belum ada data peminjaman" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieStatus} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  label={(e: any) => `${e.name}: ${e.value}`}
                  labelLine={false}
                  style={{ fontSize: 11, fill: '#cbd5e1' }}>
                  {pieStatus.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{
                  background: '#0f172a', border: '1px solid #1e293b',
                  borderRadius: 12, fontSize: 12,
                }} formatter={(v: any) => [`${v} transaksi`, '']} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ROW 2: Area Tren */}
      <ChartCard title="Tren Peminjaman & Pengembalian (6 Bulan)" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={areaTren} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPinjam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradKembali" x1="0" y1="0" x2="0" y2="1">
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
            <Area type="monotone" dataKey="Peminjaman"
              stroke="#6366f1" strokeWidth={2} fill="url(#gradPinjam)" />
            <Area type="monotone" dataKey="Pengembalian"
              stroke="#10b981" strokeWidth={2} fill="url(#gradKembali)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ROW 3: Top Buku + Top Pembaca */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Buku Terpopuler */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Top 10 Buku Terpopuler</h3>
          </div>
          {topBuku.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada data peminjaman
            </div>
          ) : (
            <div className="space-y-2">
              {topBuku.map((b, idx) => (
                <div key={b.buku_id}
                  className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-amber-500/30 transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                      : idx === 2 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {idx < 3 ? <Medal size={14} /> : `#${idx + 1}`}
                  </div>
                  <div className="w-8 h-10 rounded bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                    {b.cover_url ? (
                      <img src={b.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Book size={12} className="text-slate-600 m-auto" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{b.judul}</p>
                    <p className="text-[10px] text-slate-500 truncate">{b.pengarang}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-amber-400">{b.total_pinjam}</p>
                    <p className="text-[9px] text-slate-500 uppercase">kali</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 10 Siswa Paling Rajin */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Top 10 Siswa Paling Rajin</h3>
          </div>
          {topPembaca.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada aktivitas peminjaman siswa
            </div>
          ) : (
            <div className="space-y-2">
              {topPembaca.map((s, idx) => (
                <div key={s.siswa_id}
                  className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-emerald-500/30 transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                      : idx === 2 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {idx === 0 ? <Crown size={14} /> : idx < 3 ? <Medal size={14} /> : `#${idx + 1}`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{s.nama}</p>
                    <p className="text-[10px] text-slate-500">
                      {s.kelas} · NISN: {s.nisn}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-emerald-400">{s.total_pinjam}</p>
                    <p className="text-[9px] text-slate-500 uppercase">buku</p>
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
type KpiColor = 'indigo' | 'purple' | 'emerald' | 'amber' | 'sky' | 'rose';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Book; label: string; value: number; color: KpiColor;
}) {
  const c = CM[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}>
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
        <Icon size={16} className="text-indigo-400" />
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      </div>
      <div className="min-h-[280px]">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[280px] flex flex-col items-center justify-center text-slate-500">
      <BarChart3 size={32} className="mb-2 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
  );
}