import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Loader2,
  RefreshCw,
  Users,
  BookOpen,
  Wrench,
  Wallet,
  ScrollText,
  Briefcase,
  ListTodo,
  Repeat,
  CheckCircle2,
  XCircle,
  Trophy,
  Filter,
  Eye,
  X,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { getTodayDateWib } from '@/utils/date';
import { Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';

// =============================================================================
// TIPE DATA
// =============================================================================

type PeriodOption = 'bulan_ini' | '30_hari' | '90_hari';

type DivisiStat = {
  id: string;
  nama: string;
  kepalaDivisi: string;
  jumlahAnggota: number;
  todoTotal: number;
  todoSelesai: number;
  todoPersen: number;
  sopTotal: number;
  sopSelesai: number;
  sopTerlewat: number;
  sopPersen: number;
  totalKinerja: number;
};

type AnggotaStat = {
  id: string;
  nama: string;
  role: string;
  todoTotal: number;
  todoSelesai: number;
  sopSelesai: number;
  sopTerlewat: number;
  totalAktivitas: number;
  persen: number;
};

// =============================================================================
// KONSTANTA VISUAL
// =============================================================================

const SUPERVISOR_ROLES = [
  'admin',
  'kepala',
  'wakil_kepala',
  'kesiswaan',
  'akademik',
  'sarpras',
  'keuangan',
  'takola',
];

type ColorTheme = {
  bg: string;
  border: string;
  text: string;
  bar: string;
  gradient: string;
};

const COLOR_THEMES: Record<string, ColorTheme> = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    bar: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-blue-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    bar: 'bg-amber-500',
    gradient: 'from-amber-500 to-orange-500',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    bar: 'bg-purple-500',
    gradient: 'from-purple-500 to-pink-500',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    bar: 'bg-teal-500',
    gradient: 'from-teal-500 to-cyan-500',
  },
  slate: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    bar: 'bg-slate-500',
    gradient: 'from-slate-500 to-slate-400',
  },
};

/** Tentukan tema warna + icon berdasarkan nama divisi. */
function getDivisiVisual(namaDivisi: string): {
  themeKey: keyof typeof COLOR_THEMES;
  Icon: typeof Users;
} {
  const lower = namaDivisi.toLowerCase();
  if (lower.includes('kesiswaan')) return { themeKey: 'emerald', Icon: Users };
  if (lower.includes('akademik') || lower.includes('kurikulum'))
    return { themeKey: 'indigo', Icon: BookOpen };
  if (lower.includes('sarana') || lower.includes('prasarana') || lower.includes('sarpras'))
    return { themeKey: 'amber', Icon: Wrench };
  if (lower.includes('keuangan')) return { themeKey: 'purple', Icon: Wallet };
  if (lower.includes('tata kelola') || lower.includes('takola') || lower.includes('humas'))
    return { themeKey: 'teal', Icon: ScrollText };
  return { themeKey: 'slate', Icon: Briefcase };
}

// =============================================================================
// HELPER TANGGAL
// =============================================================================

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getCurrentMonthRange(): { start: string; end: string } {
  const today = getTodayDateWib();
  const [y, m] = today.split('-');
  const start = `${y}-${m}-01`;
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function getRangeForPeriod(period: PeriodOption): { start: string; end: string } {
  const today = getTodayDateWib();
  if (period === 'bulan_ini') return getCurrentMonthRange();
  if (period === '30_hari') return { start: subtractDays(today, 29), end: today };
  return { start: subtractDays(today, 89), end: today };
}

/** Hitung persen dengan aman (handle divide by zero). */
function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Warna bar berdasarkan persen kinerja. */
function getPerfColor(persen: number): string {
  if (persen >= 85) return 'text-emerald-400';
  if (persen >= 70) return 'text-amber-400';
  if (persen >= 50) return 'text-orange-400';
  return 'text-rose-400';
}

function getPerfBarColor(persen: number): string {
  if (persen >= 85) return 'bg-emerald-500';
  if (persen >= 70) return 'bg-amber-500';
  if (persen >= 50) return 'bg-orange-500';
  return 'bg-rose-500';
}

// =============================================================================
// KOMPONEN — DIVISI CARD
// =============================================================================

type DivisiCardProps = {
  divisi: DivisiStat;
  onClick: () => void;
};

function DivisiCard({ divisi, onClick }: DivisiCardProps) {
  const { themeKey, Icon } = getDivisiVisual(divisi.nama);
  const theme = COLOR_THEMES[themeKey];
  const perfColor = getPerfColor(divisi.totalKinerja);
  const barColor = getPerfBarColor(divisi.totalKinerja);

  return (
    <button
      onClick={onClick}
      className="text-left bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 hover:shadow-xl transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${theme.bg} ${theme.border} ${theme.text}`}
          >
            <Icon size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-100 text-sm md:text-base truncate">
              {divisi.nama}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {divisi.kepalaDivisi || 'Belum ditunjuk'}
            </p>
          </div>
        </div>
        <Eye
          size={16}
          className="text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0"
        />
      </div>

      {/* Anggota */}
      <div className="flex items-center gap-2 mb-4 text-xs text-slate-400">
        <Users size={13} className="text-slate-500" />
        <span>{divisi.jumlahAnggota} anggota</span>
      </div>

      {/* Persentase Kinerja */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Kinerja
          </span>
          <span className={`text-sm font-extrabold ${perfColor}`}>
            {divisi.totalKinerja}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${divisi.totalKinerja}%` }}
          />
        </div>
      </div>

      {/* Metrik Grid */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-emerald-400 font-extrabold text-sm">
            <ListTodo size={12} />
            {divisi.todoSelesai}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">
            Todo ({divisi.todoTotal})
          </p>
        </div>
        <div className="text-center border-x border-slate-800">
          <div className="flex items-center justify-center gap-1 text-teal-400 font-extrabold text-sm">
            <Repeat size={12} />
            {divisi.sopSelesai}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">
            SOP ({divisi.sopTotal})
          </p>
        </div>
        <div className="text-center">
          <div
            className={`flex items-center justify-center gap-1 font-extrabold text-sm ${
              divisi.sopTerlewat > 0 ? 'text-rose-400' : 'text-slate-500'
            }`}
          >
            <XCircle size={12} />
            {divisi.sopTerlewat}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">
            Terlewat
          </p>
        </div>
      </div>
    </button>
  );
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function MonevDivisiPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>('bulan_ini');
  const [divisiStats, setDivisiStats] = useState<DivisiStat[]>([]);

  // Modal detail
  const [detailDivisi, setDetailDivisi] = useState<DivisiStat | null>(null);
  const [detailAnggota, setDetailAnggota] = useState<AnggotaStat[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // =========================================================================
  // FETCH DATA
  // =========================================================================
  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const { start, end } = getRangeForPeriod(period);

        // 1. Fetch semua data yang dibutuhkan
        const [divisisRes, gurusRes, todosRes, sopLogsRes] = await Promise.all([
          supabase.from('divisis').select('*').order('nama_divisi'),
          supabase
            .from('gurus')
            .select('id, nama_lengkap, role, divisi_id')
            .order('nama_lengkap'),
          supabase
            .from('todos')
            .select('id, divisi_id, dibuat_oleh_id, ditugaskan_ke_id, status, created_at')
            .is('template_id', null) // hanya one-time task
            .gte('created_at', `${start}T00:00:00+07:00`)
            .lte('created_at', `${end}T23:59:59+07:00`),
          supabase
            .from('sop_logs')
            .select('id, divisi_id, dikerjakan_oleh_id, status, tanggal')
            .gte('tanggal', start)
            .lte('tanggal', end),
        ]);

        const divisis = divisisRes.data ?? [];
        const gurus = gurusRes.data ?? [];
        const todos = todosRes.data ?? [];
        const sopLogs = sopLogsRes.data ?? [];

        // 2. Map guru by divisi_id
        const gurusByDivisi = new Map<string, typeof gurus>();
        gurus.forEach((g) => {
          if (!g.divisi_id) return;
          const list = gurusByDivisi.get(g.divisi_id) ?? [];
          list.push(g);
          gurusByDivisi.set(g.divisi_id, list);
        });

        // 3. Map todos by divisi_id
        const todosByDivisi = new Map<
          string,
          { total: number; selesai: number }
        >();
        todos.forEach((t) => {
          const list = todosByDivisi.get(t.divisi_id) ?? { total: 0, selesai: 0 };
          list.total += 1;
          if (t.status === 'Selesai') list.selesai += 1;
          todosByDivisi.set(t.divisi_id, list);
        });

        // 4. Map sop_logs by divisi_id
        const sopByDivisi = new Map<
          string,
          { selesai: number; terlewat: number }
        >();
        sopLogs.forEach((log) => {
          if (!log.divisi_id) return;
          const list = sopByDivisi.get(log.divisi_id) ?? { selesai: 0, terlewat: 0 };
          if (log.status === 'Selesai') list.selesai += 1;
          else if (log.status === 'Terlewat') list.terlewat += 1;
          sopByDivisi.set(log.divisi_id, list);
        });

        // 5. Susun DivisiStat untuk setiap divisi
        const stats: DivisiStat[] = divisis.map((d) => {
          const anggotaList = gurusByDivisi.get(d.id) ?? [];
          const kepala = anggotaList.find((g) =>
            SUPERVISOR_ROLES.includes((g.role || '').toLowerCase())
          );

          const todo = todosByDivisi.get(d.id) ?? { total: 0, selesai: 0 };
          const sop = sopByDivisi.get(d.id) ?? { selesai: 0, terlewat: 0 };

          const totalTodo = todo.total;
          const totalSop = sop.selesai + sop.terlewat;

          const todoPersen = safePercent(todo.selesai, totalTodo);
          const sopPersen = safePercent(sop.selesai, totalSop);

          // Kinerja overall: gabungan todo + sop
          const totalAktivitas = totalTodo + totalSop;
          const totalSelesai = todo.selesai + sop.selesai;
          const totalKinerja = safePercent(totalSelesai, totalAktivitas);

          return {
            id: d.id,
            nama: d.nama_divisi,
            kepalaDivisi: kepala?.nama_lengkap ?? '',
            jumlahAnggota: anggotaList.length,
            todoTotal: totalTodo,
            todoSelesai: todo.selesai,
            todoPersen,
            sopTotal: totalSop,
            sopSelesai: sop.selesai,
            sopTerlewat: sop.terlewat,
            sopPersen,
            totalKinerja,
          };
        });

        // Urutkan berdasarkan kinerja tertinggi
        stats.sort((a, b) => b.totalKinerja - a.totalKinerja);

        setDivisiStats(stats);
      } catch (err) {
        console.error('Gagal fetch monev divisi:', err);
        showToast('error', 'Gagal memuat data monev divisi');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period]
  );

  // Initial load
  useEffect(() => {
    fetchData(false);
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka halaman Monev Divisi',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch saat period berubah
  useEffect(() => {
    if (!loading) fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // =========================================================================
  // FETCH DETAIL ANGGOTA (untuk modal)
  // =========================================================================
  const handleOpenDetail = async (divisi: DivisiStat) => {
    setDetailDivisi(divisi);
    setDetailAnggota([]);
    setLoadingDetail(true);

    try {
      const { start, end } = getRangeForPeriod(period);

      // 1. Fetch anggota divisi ini
      const { data: gurusData } = await supabase
        .from('gurus')
        .select('id, nama_lengkap, role')
        .eq('divisi_id', divisi.id)
        .order('nama_lengkap');

      const gurus = gurusData ?? [];

      // 2. Fetch todos & sop_logs untuk divisi ini dalam periode
      const [todosRes, sopLogsRes] = await Promise.all([
        supabase
          .from('todos')
          .select('id, dibuat_oleh_id, ditugaskan_ke_id, status')
          .eq('divisi_id', divisi.id)
          .is('template_id', null)
          .gte('created_at', `${start}T00:00:00+07:00`)
          .lte('created_at', `${end}T23:59:59+07:00`),
        supabase
          .from('sop_logs')
          .select('id, dikerjakan_oleh_id, status')
          .eq('divisi_id', divisi.id)
          .gte('tanggal', start)
          .lte('tanggal', end),
      ]);

      const todos = todosRes.data ?? [];
      const sopLogs = sopLogsRes.data ?? [];

      // 3. Hitung per anggota
      const anggotaStats: AnggotaStat[] = gurus.map((g) => {
        // Todo: hitung yang dibuat ATAU ditugaskan ke dia
        const todosGuru = todos.filter(
          (t) => t.dibuat_oleh_id === g.id || t.ditugaskan_ke_id === g.id
        );
        const todoTotal = todosGuru.length;
        const todoSelesai = todosGuru.filter((t) => t.status === 'Selesai').length;

        // SOP: hitung yang dikerjakan oleh dia
        const sopGuru = sopLogs.filter((log) => log.dikerjakan_oleh_id === g.id);
        const sopSelesai = sopGuru.filter((l) => l.status === 'Selesai').length;
        const sopTerlewat = sopGuru.filter((l) => l.status === 'Terlewat').length;

        const totalAktivitas = todoTotal + sopSelesai + sopTerlewat;
        const totalSelesai = todoSelesai + sopSelesai;
        const persen = safePercent(totalSelesai, totalAktivitas);

        return {
          id: g.id,
          nama: g.nama_lengkap,
          role: g.role || 'guru',
          todoTotal,
          todoSelesai,
          sopSelesai,
          sopTerlewat,
          totalAktivitas,
          persen,
        };
      });

      // Urutkan berdasarkan kinerja
      anggotaStats.sort((a, b) => b.persen - a.persen);

      setDetailAnggota(anggotaStats);
    } catch (err) {
      console.error('Gagal fetch detail divisi:', err);
      showToast('error', 'Gagal memuat detail anggota divisi');
    } finally {
      setLoadingDetail(false);
    }
  };

  // =========================================================================
  // AGGREGATE STATS UNTUK SUMMARY
  // =========================================================================
  const summary = useMemo(() => {
    const totalDivisi = divisiStats.length;
    const totalAnggota = divisiStats.reduce((sum, d) => sum + d.jumlahAnggota, 0);
    const totalTodo = divisiStats.reduce((sum, d) => sum + d.todoTotal, 0);
    const totalSopSelesai = divisiStats.reduce((sum, d) => sum + d.sopSelesai, 0);
    const totalSopTerlewat = divisiStats.reduce((sum, d) => sum + d.sopTerlewat, 0);

    // Rata-rata kinerja
    const avgKinerja =
      totalDivisi > 0
        ? Math.round(
            divisiStats.reduce((sum, d) => sum + d.totalKinerja, 0) / totalDivisi
          )
        : 0;

    return {
      totalDivisi,
      totalAnggota,
      totalTodo,
      totalSopSelesai,
      totalSopTerlewat,
      avgKinerja,
    };
  }, [divisiStats]);

  // =========================================================================
  // RENDER
  // =========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={40} />
        <p className="text-slate-400 text-xs font-medium">Memuat data monev...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <BarChart3 size={26} />
            </div>
            Monitoring & Evaluasi Divisi
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Kinerja seluruh divisi sekolah — tugas sekali jalan & SOP rutin
          </p>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users size={14} className="text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Divisi</span>
          </div>
          <p className="text-2xl font-black text-indigo-400">{summary.totalDivisi}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {summary.totalAnggota} guru tergabung
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Rata-rata
            </span>
          </div>
          <p className={`text-2xl font-black ${getPerfColor(summary.avgKinerja)}`}>
            {summary.avgKinerja}%
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Kinerja seluruh divisi</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ListTodo size={14} className="text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Todo</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">{summary.totalTodo}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Total tugas sekali jalan</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Repeat size={14} className="text-teal-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">SOP</span>
          </div>
          <p className="text-2xl font-black text-teal-400">{summary.totalSopSelesai}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">SOP selesai dijalankan</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <XCircle size={14} className="text-rose-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Terlewat
            </span>
          </div>
          <p
            className={`text-2xl font-black ${
              summary.totalSopTerlewat > 0 ? 'text-rose-400' : 'text-slate-500'
            }`}
          >
            {summary.totalSopTerlewat}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">SOP yang terlewat</p>
        </div>
      </div>

      {/* FILTER PERIOD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
          <Filter size={14} className="text-indigo-400" />
          <span>Periode Evaluasi</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
          {(
            [
              { value: 'bulan_ini', label: 'Bulan Ini' },
              { value: '30_hari', label: '30 Hari' },
              { value: '90_hari', label: '90 Hari' },
            ] as { value: PeriodOption; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* GRID DIVISI */}
      {divisiStats.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
          <Briefcase size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-bold text-slate-300 text-sm">Belum ada divisi terdaftar</p>
          <p className="text-xs text-slate-500 mt-1">
            Tambahkan divisi di tabel <code className="text-indigo-400">divisis</code> terlebih
            dahulu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {divisiStats.map((divisi) => (
            <DivisiCard
              key={divisi.id}
              divisi={divisi}
              onClick={() => handleOpenDetail(divisi)}
            />
          ))}
        </div>
      )}

      {/* TABEL PERBANDINGAN */}
      {divisiStats.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-400" />
              Tabel Perbandingan Divisi
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Peringkat berdasarkan persentase kinerja
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Divisi</th>
                  <th className="py-3 px-4">Kepala Divisi</th>
                  <th className="py-3 px-4 text-center">Anggota</th>
                  <th className="py-3 px-4 text-center text-emerald-400">Todo</th>
                  <th className="py-3 px-4 text-center text-teal-400">SOP</th>
                  <th className="py-3 px-4 text-center text-rose-400">Terlewat</th>
                  <th className="py-3 px-4 text-right">Kinerja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {divisiStats.map((d, idx) => {
                  const perfColor = getPerfColor(d.totalKinerja);
                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(d)}
                    >
                      <td className="py-3 px-4">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : idx === 1
                              ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                              : idx === 2
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">{d.nama}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {d.kepalaDivisi || '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400">
                        {d.jumlahAnggota}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-400">
                        {d.todoSelesai}/{d.todoTotal}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-teal-400">
                        {d.sopSelesai}/{d.sopTotal}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span
                          className={d.sopTerlewat > 0 ? 'text-rose-400' : 'text-slate-500'}
                        >
                          {d.sopTerlewat}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-sm font-extrabold ${perfColor}`}>
                          {d.totalKinerja}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETAIL DIVISI */}
      <Modal
        open={!!detailDivisi}
        onClose={() => {
          setDetailDivisi(null);
          setDetailAnggota([]);
        }}
        title={detailDivisi ? `Detail Divisi ${detailDivisi.nama}` : 'Detail Divisi'}
        size="lg"
      >
        {detailDivisi && (
          <div className="space-y-5 pt-1">
            {/* Header Info */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {(() => {
                  const { themeKey, Icon } = getDivisiVisual(detailDivisi.nama);
                  const theme = COLOR_THEMES[themeKey];
                  return (
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${theme.bg} ${theme.border} ${theme.text}`}
                    >
                      <Icon size={24} />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {detailDivisi.nama}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kepala:{' '}
                    <span className="text-slate-300 font-semibold">
                      {detailDivisi.kepalaDivisi || 'Belum ditunjuk'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick stats grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Anggota
                  </p>
                  <p className="text-lg font-black text-slate-200">
                    {detailDivisi.jumlahAnggota}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Todo
                  </p>
                  <p className="text-lg font-black text-emerald-400">
                    {detailDivisi.todoSelesai}/{detailDivisi.todoTotal}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    SOP
                  </p>
                  <p className="text-lg font-black text-teal-400">
                    {detailDivisi.sopSelesai}/{detailDivisi.sopTotal}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Kinerja
                  </p>
                  <p
                    className={`text-lg font-black ${getPerfColor(
                      detailDivisi.totalKinerja
                    )}`}
                  >
                    {detailDivisi.totalKinerja}%
                  </p>
                </div>
              </div>
            </div>

            {/* List Anggota */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-indigo-400" />
                  Kontribusi Anggota
                </h4>
                <span className="text-[10px] text-slate-500">
                  {detailAnggota.length} guru
                </span>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                  <Loader2 size={16} className="animate-spin text-indigo-400" />
                  <span className="text-xs">Memuat data anggota...</span>
                </div>
              ) : detailAnggota.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Belum ada anggota divisi ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {detailAnggota.map((a, idx) => (
                    <div
                      key={a.id}
                      className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              idx === 0
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-200 truncate">
                              {a.nama}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {a.role}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-extrabold shrink-0 ${getPerfColor(
                            a.persen
                          )}`}
                        >
                          {a.persen}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-2">
                        <div
                          className={`h-full rounded-full ${getPerfBarColor(a.persen)}`}
                          style={{ width: `${a.persen}%` }}
                        />
                      </div>

                      {/* Mini stats */}
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <ListTodo size={10} />
                          {a.todoSelesai}/{a.todoTotal}
                        </span>
                        <span className="flex items-center gap-1 text-teal-400 font-semibold">
                          <Repeat size={10} />
                          {a.sopSelesai}
                        </span>
                        {a.sopTerlewat > 0 && (
                          <span className="flex items-center gap-1 text-rose-400 font-semibold">
                            <XCircle size={10} />
                            {a.sopTerlewat}
                          </span>
                        )}
                        <span className="text-slate-500 ml-auto">
                          {a.totalAktivitas} aktivitas
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setDetailDivisi(null);
                  setDetailAnggota([]);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}