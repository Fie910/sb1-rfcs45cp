// src/components/tahfidz/DashboardTahfidzTab.tsx
// Dashboard Tahfidz — KPI, chart tren, leaderboard.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Loader2, BookMarked, Users, TrendingUp,
  Trophy, Crown, Medal, Award, Star,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip, Legend, CartesianGrid,
  AreaChart, Area, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { formatTanggalShort } from './shared';
import { LeaderboardMilestoneSection } from './LeaderboardMilestoneSection';
import { LeaderboardMilestoneSection } from './LeaderboardMilestoneSection';
import {
  getHalamanSetoran,
  formatHalaman,
} from '@/lib/tahfidz/hitungHalaman';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzSetoranWithRelations,
} from '@/types/database';
import { AyatBermasalahSection } from './AyatBermasalahSection';

type Props = {
  surahList: TahfidzSurah[];
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  isManager: boolean;
};

const COLORS = {
  emerald: '#10b981',
  indigo: '#6366f1',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#a855f7',
  teal: '#14b8a6',
};

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

export function DashboardTahfidzTab({ surahMap, halamanMap }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [setoranList, setSetoranList] = useState<TahfidzSetoranWithRelations[]>([]);
  const [siswaCount, setSiswaCount] = useState(0);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      const [setoranRes, siswaRes] = await Promise.all([
        supabase
          .from('tahfidz_setoran')
          .select(`
            *,
            siswa:siswa_id (id, nisn, nama_lengkap, kelas_id,
              kelas:kelas_id (id, nama_kelas)
            ),
            guru:guru_tahfidz_id (id, nama_lengkap)
          `)
          .gte('tanggal', sixMonthsAgoStr)
          .order('tanggal', { ascending: false }),
        supabase
          .from('siswas')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'AKTIF'),
      ]);

      setSetoranList((setoranRes.data as any) ?? []);
      setSiswaCount(siswaRes.count ?? 0);
    } catch (err: any) {
      showToast('error', 'Gagal memuat dashboard: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const setoranHariIni = setoranList.filter((s) => s.tanggal === today).length;
    const totalTahfidz = setoranList.filter((s) => s.jenis === 'Tahfidz').length;
    const totalMurojaah = setoranList.filter((s) => s.jenis === 'Murojaah').length;

    const totalHalaman = setoranList.reduce(
      (sum, s) => sum + getHalamanSetoran(s, surahMap, halamanMap),
      0
    );

    const nilaiList = setoranList
      .map((s) => s.nilai)
      .filter((n): n is number => n !== null && n !== undefined);
    const rataNilai =
      nilaiList.length > 0
        ? nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length
        : null;

    return { setoranHariIni, totalTahfidz, totalMurojaah, totalHalaman, rataNilai };
  }, [setoranList, surahMap, halamanMap]);

  const trenBulanan = useMemo(() => {
    const months = getLast6Months();
    const map = new Map<string, { tahfidz: number; murojaah: number; halaman: number }>();
    months.forEach((m) => map.set(m.key, { tahfidz: 0, murojaah: 0, halaman: 0 }));

    setoranList.forEach((s) => {
      const key = s.tanggal.slice(0, 7);
      const e = map.get(key);
      if (!e) return;
      if (s.jenis === 'Tahfidz') e.tahfidz += 1;
      else e.murojaah += 1;
      e.halaman += getHalamanSetoran(s, surahMap, halamanMap);
    });

    return months.map((m) => {
      const e = map.get(m.key)!;
      return {
        name: m.label,
        Tahfidz: e.tahfidz,
        Murojaah: e.murojaah,
        Halaman: Number(e.halaman.toFixed(1)),
      };
    });
  }, [setoranList, surahMap, halamanMap]);

  const leaderboard = useMemo(() => {
    type Agg = {
      siswa_id: number;
      nama_lengkap: string;
      nisn: string;
      kelas: string;
      total_tahfidz: number;
      total_halaman: number;
      nilai_arr: number[];
    };

    const map = new Map<number, Agg>();

    setoranList.forEach((s) => {
      if (!s.siswa) return;
      const existing = map.get(s.siswa.id) ?? {
        siswa_id: s.siswa.id,
        nama_lengkap: s.siswa.nama_lengkap,
        nisn: s.siswa.nisn,
        kelas: s.siswa.kelas?.nama_kelas ?? '-',
        total_tahfidz: 0,
        total_halaman: 0,
        nilai_arr: [],
      };

      if (s.jenis === 'Tahfidz') existing.total_tahfidz += 1;
      existing.total_halaman += getHalamanSetoran(s, surahMap, halamanMap);
      if (s.nilai !== null && s.nilai !== undefined) existing.nilai_arr.push(s.nilai);

      map.set(s.siswa.id, existing);
    });

    return Array.from(map.values())
      .map((a) => ({
        ...a,
        rata_nilai:
          a.nilai_arr.length > 0
            ? a.nilai_arr.reduce((x, y) => x + y, 0) / a.nilai_arr.length
            : 0,
      }))
      .filter((a) => a.total_halaman > 0)
      .sort((a, b) => {
        if (b.total_halaman !== a.total_halaman) return b.total_halaman - a.total_halaman;
        return b.rata_nilai - a.rata_nilai;
      })
      .slice(0, 10);
  }, [setoranList, surahMap, halamanMap]);

  const terbaru = useMemo(() => {
    return [...setoranList]
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      .slice(0, 8);
  }, [setoranList]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-emerald-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <BarChart3 className="text-emerald-400" size={20} /> Dashboard Tahfidz
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistik hafalan siswa · 6 bulan terakhir
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={BookMarked} label="Setoran Hari Ini" value={stats.setoranHariIni} color="emerald" />
        <KpiCard icon={TrendingUp} label="Total Tahfidz" value={stats.totalTahfidz} color="indigo" />
        <KpiCard icon={Award} label="Total Murojaah" value={stats.totalMurojaah} color="purple" />
        <KpiCard icon={BookMarked} label="Halaman Hafalan" value={formatHalaman(stats.totalHalaman)} color="amber" />
        <KpiCard icon={Users} label="Siswa Aktif" value={siswaCount} color="teal" />
        <KpiCard icon={Star} label="Rata Nilai" value={stats.rataNilai ? stats.rataNilai.toFixed(1) : '—'} color="rose" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Tren Setoran 6 Bulan</h3>
        </div>
        {setoranList.length === 0 ? (
          <EmptyChart label="Belum ada data setoran" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trenBulanan} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTahfidz" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMurojaah" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.indigo} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLORS.indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconSize={8} />
              <Area type="monotone" dataKey="Tahfidz" stroke={COLORS.emerald} strokeWidth={2} fill="url(#gradTahfidz)" />
              <Area type="monotone" dataKey="Murojaah" stroke={COLORS.indigo} strokeWidth={2} fill="url(#gradMurojaah)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Top 10 Siswa Paling Rajin</h3>
          </div>
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Belum ada aktivitas hafalan</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((s, idx) => (
                <div key={s.siswa_id} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-emerald-500/30 transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                      : idx === 2 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {idx === 0 ? <Crown size={14} /> : idx < 3 ? <Medal size={14} /> : `#${idx + 1}`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{s.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-500">
                      {s.kelas} · {s.total_tahfidz}× setoran · rata nilai {s.rata_nilai.toFixed(0)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-emerald-400">{formatHalaman(s.total_halaman)}</p>
                    <p className="text-[9px] text-slate-500 uppercase">halaman</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <BookMarked size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">Setoran Terbaru</h3>
          </div>
          {terbaru.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Belum ada setoran</div>
          ) : (
            <div className="space-y-2">
              {terbaru.map((s) => (
                <div key={s.id} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <div className="w-1.5 h-10 rounded-full bg-emerald-500/60 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{s.siswa?.nama_lengkap ?? '—'}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {s.siswa?.kelas?.nama_kelas ?? '-'} · {formatTanggalShort(s.tanggal)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-emerald-400">{s.jenis}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatHalaman(getHalamanSetoran(s, surahMap, halamanMap))} hal
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* ✅ Section Ayat Bermasalah */}
      <AyatBermasalahSection surahMap={surahMap} />

      {/* ✅ Section Leaderboard Milestone */}
      <LeaderboardMilestoneSection />
    </div>
  );
}

type KpiColor = 'emerald' | 'indigo' | 'amber' | 'rose' | 'teal' | 'purple';

const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof BookMarked; label: string; value: number | string; color: KpiColor;
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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[280px] flex flex-col items-center justify-center text-slate-500">
      <BarChart3 size={32} className="mb-2 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
  );
}