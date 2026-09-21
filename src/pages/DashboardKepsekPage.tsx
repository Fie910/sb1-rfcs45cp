import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Eye,
  Loader2,
  Users,
  UserCheck,
  FileText,
  ClipboardCheck,
  Activity,
  RefreshCw,
  Award,
  AlertTriangle,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { getTodayDateWib } from '@/lib/date';
import {
  CHART_COLORS,
  AXIS_STYLE,
  GRID_STYLE,
  TOOLTIP_STYLE,
  CHART_MARGIN,
  CHART_HEIGHT,
  formatShortDate,
} from '@/lib/charts';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import type { AuditLog } from '@/types/database';

// =============================================================================
// TIPE DATA
// =============================================================================

type PeriodOption = 7 | 30 | 90;

type SnapshotData = {
  guruHadir: number;
  guruTotal: number;
  siswaHadir: number;
  siswaTotal: number;
  izinPending: number;
  disposisiPending: number;
};

type TrendPoint = {
  date: string;
  label: string;
  guruPersen: number;
  siswaPersen: number;
};

type GuruRajin = {
  id: string;
  nama: string;
  persen: number;
  hadir: number;
  total: number;
};

type GuruTerlambat = {
  id: string;
  nama: string;
  totalMenit: number;
  countTerlambat: number;
};

type SiswaAlpa = {
  id: number;
  nama: string;
  kelas: string;
  countAlpa: number;
};

// =============================================================================
// HELPER LOKAL
// =============================================================================

/** Kurangi N hari dari string YYYY-MM-DD, return YYYY-MM-DD. */
function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Tambah N hari. */
function addDays(dateStr: string, days: number): string {
  return subtractDays(dateStr, -days);
}

/** Array tanggal dari start s/d end (inklusif). */
function getDateArray(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  let safety = 0;
  while (current <= endDate && safety < 400) {
    dates.push(current);
    current = addDays(current, 1);
    safety++;
  }
  return dates;
}

/** Start date N hari ke belakang dari hari ini (termasuk hari ini). */
function getStartDate(periodDays: number): string {
  const today = getTodayDateWib();
  return subtractDays(today, periodDays - 1);
}

/** Bulan berjalan: start dan end. */
function getCurrentMonthRange(): { start: string; end: string } {
  const today = getTodayDateWib();
  const [y, m] = today.split('-');
  const start = `${y}-${m}-01`;
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// =============================================================================
// KOMPONEN — SNAPSHOT CARD
// =============================================================================

type SnapshotCardProps = {
  icon: typeof Users;
  label: string;
  value: string;
  sublabel: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
};

function SnapshotCard({ icon: Icon, label, value, sublabel, color }: SnapshotCardProps) {
  const colorMap = {
    indigo: {
      icon: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
      value: 'text-indigo-400',
    },
    emerald: {
      icon: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      value: 'text-emerald-400',
    },
    amber: {
      icon: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      value: 'text-amber-400',
    },
    rose: {
      icon: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      value: 'text-rose-400',
    },
  } as const;

  const c = colorMap[color];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${c.icon}`}
        >
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-2xl md:text-3xl font-black tracking-tight ${c.value}`}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sublabel}</p>
    </div>
  );
}

// =============================================================================
// KOMPONEN — TOP LIST CARD
// =============================================================================

type TopListItem = {
  rank: number;
  label: string;
  sublabel?: string;
  value: string;
  valueColor?: string;
};

type TopListCardProps = {
  title: string;
  icon: typeof Award;
  iconColor: string;
  items: TopListItem[];
  emptyMessage: string;
  emptyIcon?: typeof Users;
};

function TopListCard({
  title,
  icon: Icon,
  iconColor,
  items,
  emptyMessage,
  emptyIcon: EmptyIcon = Users,
}: TopListCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800/80">
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconColor}`}
        >
          <Icon size={18} />
        </div>
        <h3 className="font-bold text-slate-100 text-sm md:text-base">{title}</h3>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <EmptyIcon size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.rank}
              className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/40 border border-slate-800/60"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.rank === 1
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : item.rank === 2
                    ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    : item.rank === 3
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {item.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{item.label}</p>
                {item.sublabel && (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {item.sublabel}
                  </p>
                )}
              </div>
              <span
                className={`text-xs font-extrabold shrink-0 ${
                  item.valueColor || 'text-slate-300'
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function DashboardKepsekPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>(7);

  // Snapshot state
  const [snapshot, setSnapshot] = useState<SnapshotData>({
    guruHadir: 0,
    guruTotal: 0,
    siswaHadir: 0,
    siswaTotal: 0,
    izinPending: 0,
    disposisiPending: 0,
  });

  // Trend state
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  // Top/Bottom state
  const [topGuruRajin, setTopGuruRajin] = useState<GuruRajin[]>([]);
  const [topGuruTerlambat, setTopGuruTerlambat] = useState<GuruTerlambat[]>([]);
  const [topSiswaAlpa, setTopSiswaAlpa] = useState<SiswaAlpa[]>([]);

  // Activity feed
  const [activity, setActivity] = useState<AuditLog[]>([]);

  // =========================================================================
  // FETCH SNAPSHOT — hari ini
  // =========================================================================
  const fetchSnapshot = useCallback(async () => {
    const today = getTodayDateWib();

    // 1. Kehadiran guru hari ini (dari agenda_gurus)
    const { data: agendaToday } = await supabase
      .from('agenda_gurus')
      .select('guru_id, status_kehadiran, jadwal_kbm_id')
      .eq('tanggal', today);

    const agendaRows = agendaToday ?? [];
    const guruHadirToday = agendaRows.filter(
      (a) =>
        a.status_kehadiran === 'Hadir Mengajar' || a.status_kehadiran === 'Terlambat'
    ).length;
    const guruTotalToday = agendaRows.length;

    // 2. Siswa aktif total + kehadiran hari ini
    const [siswaTotalRes, presensiTodayRes] = await Promise.all([
      supabase
        .from('siswas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'AKTIF'),
      supabase
        .from('presensi_siswa_kesiswaans')
        .select('*', { count: 'exact', head: true })
        .eq('tanggal', today)
        .eq('status_kehadiran', 'Hadir'),
    ]);

    // 3. Izin pending
    const { count: izinCount } = await supabase
      .from('izin_guru_pikets')
      .select('*', { count: 'exact', head: true })
      .eq('status_penanganan', 'Menunggu');

    // 4. Disposisi pending
    const { count: disposisiCount } = await supabase
      .from('disposisi_surat')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'SELESAI');

    setSnapshot({
      guruHadir: guruHadirToday,
      guruTotal: guruTotalToday,
      siswaHadir: presensiTodayRes.count ?? 0,
      siswaTotal: siswaTotalRes.count ?? 0,
      izinPending: izinCount ?? 0,
      disposisiPending: disposisiCount ?? 0,
    });
  }, []);

  // =========================================================================
  // FETCH TREND — sesuai period (7/30/90 hari)
  // =========================================================================
  const fetchTrend = useCallback(async (periodDays: number) => {
    const endDate = getTodayDateWib();
    const startDate = getStartDate(periodDays);
    const dates = getDateArray(startDate, endDate);

    // 1. Ambil semua agenda_gurus dalam periode
    const { data: agendaData } = await supabase
      .from('agenda_gurus')
      .select('tanggal, status_kehadiran')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate);

    // 2. Ambil presensi siswa dalam periode
    const { data: presensiData } = await supabase
      .from('presensi_siswa_kesiswaans')
      .select('tanggal, status_kehadiran')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate);

    // 3. Map per tanggal
    const guruByDate = new Map<string, { hadir: number; total: number }>();
    const siswaByDate = new Map<string, { hadir: number; total: number }>();

    agendaData?.forEach((row) => {
      const key = row.tanggal;
      const cur = guruByDate.get(key) ?? { hadir: 0, total: 0 };
      cur.total += 1;
      if (row.status_kehadiran === 'Hadir Mengajar' || row.status_kehadiran === 'Terlambat') {
        cur.hadir += 1;
      }
      guruByDate.set(key, cur);
    });

    presensiData?.forEach((row) => {
      const key = row.tanggal;
      const cur = siswaByDate.get(key) ?? { hadir: 0, total: 0 };
      cur.total += 1;
      if (row.status_kehadiran === 'Hadir') {
        cur.hadir += 1;
      }
      siswaByDate.set(key, cur);
    });

    // 4. Susun TrendPoint
    const points: TrendPoint[] = dates.map((date) => {
      const guru = guruByDate.get(date);
      const siswa = siswaByDate.get(date);

      const guruPersen = guru && guru.total > 0 ? Math.round((guru.hadir / guru.total) * 100) : 0;
      const siswaPersen =
        siswa && siswa.total > 0 ? Math.round((siswa.hadir / siswa.total) * 100) : 0;

      return {
        date,
        label: formatShortDate(date),
        guruPersen,
        siswaPersen,
      };
    });

    setTrendData(points);
  }, []);

  // =========================================================================
  // FETCH TOP/BOTTOM — bulan berjalan
  // =========================================================================
  const fetchTopBottom = useCallback(async () => {
    const { start, end } = getCurrentMonthRange();

    // 1. Guru rajin (persen kehadiran tertinggi)
    const { data: agendaBulan } = await supabase
      .from('agenda_gurus')
      .select('guru_id, status_kehadiran, gurus(id, nama_lengkap)')
      .gte('tanggal', start)
      .lte('tanggal', end);

    const guruMap = new Map<string, { nama: string; hadir: number; total: number }>();
    agendaBulan?.forEach((row: any) => {
      const id = row.guru_id;
      const nama = row.gurus?.nama_lengkap ?? 'Guru';
      const cur = guruMap.get(id) ?? { nama, hadir: 0, total: 0 };
      cur.total += 1;
      if (row.status_kehadiran === 'Hadir Mengajar' || row.status_kehadiran === 'Terlambat') {
        cur.hadir += 1;
      }
      guruMap.set(id, cur);
    });

    const guruRajinArr: GuruRajin[] = Array.from(guruMap.entries())
      .map(([id, v]) => ({
        id,
        nama: v.nama,
        persen: v.total > 0 ? Math.round((v.hadir / v.total) * 100) : 0,
        hadir: v.hadir,
        total: v.total,
      }))
      .filter((g) => g.total >= 3) // filter minimal 3 JP biar tidak bias
      .sort((a, b) => b.persen - a.persen)
      .slice(0, 5);

    setTopGuruRajin(guruRajinArr);

    // 2. Guru terlambat (total menit terlambat terbanyak)
    const { data: agendaTerlambat } = await supabase
      .from('agenda_gurus')
      .select('guru_id, menit_terlambat, gurus(id, nama_lengkap)')
      .gt('menit_terlambat', 0)
      .gte('tanggal', start)
      .lte('tanggal', end);

    const lateMap = new Map<string, { nama: string; totalMenit: number; count: number }>();
    agendaTerlambat?.forEach((row: any) => {
      const id = row.guru_id;
      const nama = row.gurus?.nama_lengkap ?? 'Guru';
      const cur = lateMap.get(id) ?? { nama, totalMenit: 0, count: 0 };
      cur.totalMenit += row.menit_terlambat || 0;
      cur.count += 1;
      lateMap.set(id, cur);
    });

    const guruLateArr: GuruTerlambat[] = Array.from(lateMap.entries())
      .map(([id, v]) => ({
        id,
        nama: v.nama,
        totalMenit: v.totalMenit,
        countTerlambat: v.count,
      }))
      .sort((a, b) => b.totalMenit - a.totalMenit)
      .slice(0, 5);

    setTopGuruTerlambat(guruLateArr);

    // 3. Siswa alpa terbanyak
    const { data: alpaData } = await supabase
      .from('presensi_siswa_kesiswaans')
      .select('siswa_id, siswas(id, nama_lengkap, kelas:kelas_id(nama_kelas))')
      .eq('status_kehadiran', 'Alpa')
      .gte('tanggal', start)
      .lte('tanggal', end);

    const alpaMap = new Map<
      number,
      { nama: string; kelas: string; count: number }
    >();
    alpaData?.forEach((row: any) => {
      const id = row.siswa_id;
      const nama = row.siswas?.nama_lengkap ?? 'Siswa';
      const kelas = row.siswas?.kelas?.nama_kelas ?? '-';
      const cur = alpaMap.get(id) ?? { nama, kelas, count: 0 };
      cur.count += 1;
      alpaMap.set(id, cur);
    });

    const alpaArr: SiswaAlpa[] = Array.from(alpaMap.entries())
      .map(([id, v]) => ({
        id,
        nama: v.nama,
        kelas: v.kelas,
        countAlpa: v.count,
      }))
      .sort((a, b) => b.countAlpa - a.countAlpa)
      .slice(0, 5);

    setTopSiswaAlpa(alpaArr);
  }, []);

  // =========================================================================
  // FETCH ACTIVITY FEED
  // =========================================================================
  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    setActivity((data as AuditLog[]) ?? []);
  }, []);

  // =========================================================================
  // MASTER FETCH
  // =========================================================================
  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        await Promise.all([
          fetchSnapshot(),
          fetchTrend(period),
          fetchTopBottom(),
          fetchActivity(),
        ]);
      } catch (err) {
        console.error('Gagal fetch dashboard kepsek:', err);
        showToast('error', 'Gagal memuat data dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, fetchSnapshot, fetchTrend, fetchTopBottom, fetchActivity]
  );

  // Initial load
  useEffect(() => {
    fetchAll(false);
    // Log VIEW sekali
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka Dashboard Kepala Sekolah',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch trend saat period berubah
  useEffect(() => {
    if (!loading) {
      fetchTrend(period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // =========================================================================
  // HELPERS UNTUK LIST ITEMS
  // =========================================================================

  const guruRajinItems: TopListItem[] = useMemo(
    () =>
      topGuruRajin.map((g, idx) => ({
        rank: idx + 1,
        label: g.nama,
        sublabel: `${g.hadir} hadir dari ${g.total} JP`,
        value: `${g.persen}%`,
        valueColor: 'text-emerald-400',
      })),
    [topGuruRajin]
  );

  const guruLateItems: TopListItem[] = useMemo(
    () =>
      topGuruTerlambat.map((g, idx) => ({
        rank: idx + 1,
        label: g.nama,
        sublabel: `Terlambat ${g.countTerlambat}× JP`,
        value: `${g.totalMenit} mnt`,
        valueColor: 'text-amber-400',
      })),
    [topGuruTerlambat]
  );

  const siswaAlpaItems: TopListItem[] = useMemo(
    () =>
      topSiswaAlpa.map((s, idx) => ({
        rank: idx + 1,
        label: s.nama,
        sublabel: `Kelas ${s.kelas}`,
        value: `${s.countAlpa}×`,
        valueColor: 'text-rose-400',
      })),
    [topSiswaAlpa]
  );

  // =========================================================================
  // RENDER — LOADING STATE
  // =========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={40} />
        <p className="text-slate-400 text-xs font-medium">Memuat dashboard...</p>
      </div>
    );
  }

  // =========================================================================
  // RENDER — MAIN
  // =========================================================================
  const guruPersen =
    snapshot.guruTotal > 0 ? Math.round((snapshot.guruHadir / snapshot.guruTotal) * 100) : 0;
  const siswaPersen =
    snapshot.siswaTotal > 0 ? Math.round((snapshot.siswaHadir / snapshot.siswaTotal) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Eye size={26} />
            </div>
            Dashboard Kepala Sekolah
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Ringkasan kondisi sekolah & tren mingguan — data real-time
          </p>
        </div>

        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {/* BAGIAN A — SNAPSHOT 4 KARTU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SnapshotCard
          icon={UserCheck}
          label="Kehadiran Guru"
          value={`${snapshot.guruHadir}/${snapshot.guruTotal}`}
          sublabel={`${guruPersen}% guru sudah absen hari ini`}
          color="emerald"
        />
        <SnapshotCard
          icon={Users}
          label="Kehadiran Siswa"
          value={`${snapshot.siswaHadir}/${snapshot.siswaTotal}`}
          sublabel={`${siswaPersen}% siswa hadir hari ini`}
          color="indigo"
        />
        <SnapshotCard
          icon={FileText}
          label="Izin Menunggu"
          value={String(snapshot.izinPending)}
          sublabel={
            snapshot.izinPending > 0
              ? 'Perlu tindak lanjut guru piket'
              : 'Semua izin sudah tertangani'
          }
          color="amber"
        />
        <SnapshotCard
          icon={ClipboardCheck}
          label="Disposisi Pending"
          value={String(snapshot.disposisiPending)}
          sublabel={
            snapshot.disposisiPending > 0
              ? 'Belum diselesaikan penerima'
              : 'Semua disposisi selesai'
          }
          color="rose"
        />
      </div>

      {/* BAGIAN B — TREND CHART */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm md:text-base">
                Tren Kehadiran
              </h2>
              <p className="text-[11px] text-slate-500">
                Persentase kehadiran guru & siswa
              </p>
            </div>
          </div>

          {/* Filter Period */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            {([7, 30, 90] as PeriodOption[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p} Hari
              </button>
            ))}
          </div>
        </div>

        {trendData.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Tidak ada data tren</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis
                  dataKey="label"
                  {...AXIS_STYLE}
                  interval={period === 7 ? 0 : 'preserveStartEnd'}
                />
                <YAxis
                  {...AXIS_STYLE}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE.contentStyle}
                  labelStyle={TOOLTIP_STYLE.labelStyle}
                  itemStyle={TOOLTIP_STYLE.itemStyle}
                  formatter={(v, name) => [`${v ?? 0}%`, String(name ?? '')]}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    paddingTop: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="guruPersen"
                  name="Guru Hadir"
                  stroke={CHART_COLORS.emerald}
                  strokeWidth={2.5}
                  dot={{ r: period === 7 ? 3 : 0, strokeWidth: 2 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="siswaPersen"
                  name="Siswa Hadir"
                  stroke={CHART_COLORS.indigo}
                  strokeWidth={2.5}
                  dot={{ r: period === 7 ? 3 : 0, strokeWidth: 2 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* BAGIAN C — TOP 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopListCard
          title="Top 5 Guru Rajin"
          icon={Award}
          iconColor="bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          items={guruRajinItems}
          emptyMessage="Belum ada data bulan ini"
          emptyIcon={Award}
        />
        <TopListCard
          title="Top 5 Guru Terlambat"
          icon={AlertTriangle}
          iconColor="bg-amber-500/15 border-amber-500/30 text-amber-400"
          items={guruLateItems}
          emptyMessage="Tidak ada keterlambatan bulan ini"
          emptyIcon={AlertTriangle}
        />
        <TopListCard
          title="Top 5 Siswa Alpa"
          icon={AlertTriangle}
          iconColor="bg-rose-500/15 border-rose-500/30 text-rose-400"
          items={siswaAlpaItems}
          emptyMessage="Tidak ada alpa bulan ini"
          emptyIcon={Users}
        />
      </div>

      {/* BAGIAN D — ACTIVITY FEED */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm md:text-base">
              Aktivitas Terbaru
            </h2>
            <p className="text-[11px] text-slate-500">10 log audit terakhir</p>
          </div>
        </div>

        {activity.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Activity size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Belum ada aktivitas tercatat</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/80 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-200">
                      {log.user_nama || '-'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {log.user_role || '-'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {log.deskripsi}
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