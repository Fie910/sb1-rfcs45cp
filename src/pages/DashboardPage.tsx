// DashboardPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Sparkles, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCanAccess } from '@/hooks/useCanAccess';
import { TimelineKegiatan } from '@/components/TimelineKegiatan';
import { PengumumanBanner } from '@/components/PengumumanBanner';
import { AttendanceSummary } from '@/components/AttendanceSummary';

// --------------------------------------------------------------------------
// Types & Helpers
// --------------------------------------------------------------------------

type AttendanceStats = {
  hadir: number;
  totalAlpaJp: number;
  totalTerlambatJp: number;
  totalMenitTerlambat: number;
  sakit: number;
  izin: number;
};

const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hitungSelisihMenit = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function DashboardPage() {
  const canAccess = useCanAccess('dashboard');
  const { guru } = useAuth();

  const [pengumumanList, setPengumumanList] = useState<any[]>([]);
  const [agendaList, setAgendaList] = useState<any[]>([]);
  const [izinList, setIzinList] = useState<any[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const today = getLocalToday();
  const DURASI_PER_JP_MENIT = 30;

  // ---- Data fetching ----

  const fetchPengumuman = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pengumumans')
        .select('*')
        .eq('is_aktif', true)
        .lte('tanggal_mulai', today)
        .gte('tanggal_selesai', today)
        .order('created_at', { ascending: false });

      if (error) console.error('Error fetching pengumuman:', error);
      setPengumumanList(data ?? []);
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }, [today]);

  const fetchAgenda = useCallback(async () => {
    if (!guru) return;
    setAgendaLoading(true);
    const [year, month] = filterMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const [agendaRes, izinRes] = await Promise.all([
      supabase
        .from('agenda_gurus')
        .select('*, jadwal_kbms(waktu_mulai, waktu_selesai, kelas(nama_kelas), mata_pelajarans(nama_mapel))')
        .eq('guru_id', guru.id)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false }),
      supabase
        .from('izin_guru_pikets')
        .select('*')
        .eq('guru_izin_id', guru.id)
        .gte('tanggal_izin', startDate)
        .lte('tanggal_izin', endDate),
    ]);

    setAgendaList(agendaRes.data ?? []);
    setIzinList(izinRes.data ?? []);
    setAgendaLoading(false);
  }, [guru, filterMonth]);

  useEffect(() => {
    if (!canAccess) return;
    fetchPengumuman();
    fetchAgenda();
  }, [canAccess, fetchPengumuman, fetchAgenda]);

  // ---- Access guard ----

  if (canAccess === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={36} />
        <p className="text-slate-400 text-xs font-medium">Memeriksa Hak Akses...</p>
      </div>
    );
  }

  if (canAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Akses Ditolak</h2>
        <p className="text-slate-400 text-sm max-w-md">
          Anda tidak memiliki hak akses untuk melihat halaman Dashboard Utama ini. Silakan hubungi Administrator jika ini merupakan kekeliruan.
        </p>
      </div>
    );
  }

  // ---- Kalkulasi statistik kehadiran ----

  let totalHadirJp = 0;
  let totalAlpaJp = 0;
  let totalTerlambatJp = 0;
  let totalMenitTerlambat = 0;

  const agendaByDate: Record<string, { totalJadwalJp: number; hadirJp: number }> = {};

  agendaList.forEach((a) => {
    const waktuMulai = a.jadwal_kbms?.waktu_mulai;
    const waktuSelesai = a.jadwal_kbms?.waktu_selesai;
    const date = a.tanggal;

    const totalMenitJadwal = hitungSelisihMenit(waktuMulai, waktuSelesai);
    const jadwalJp = Math.ceil(totalMenitJadwal / DURASI_PER_JP_MENIT);

    if (!agendaByDate[date]) agendaByDate[date] = { totalJadwalJp: 0, hadirJp: 0 };
    agendaByDate[date].totalJadwalJp += jadwalJp;

    const mntTerlambat = a.menit_terlambat || 0;
    const alpaJpDariKolom = a.alpa_jam_pelajaran || 0;
    totalMenitTerlambat += mntTerlambat;

    if (a.status_kehadiran === 'Alpa') {
      totalAlpaJp += jadwalJp > 0 ? jadwalJp : alpaJpDariKolom;
    } else {
      totalTerlambatJp += alpaJpDariKolom;
      if (a.status_kehadiran === 'Hadir Mengajar' || a.status_kehadiran === 'Terlambat') {
        const menitHadir = Math.max(0, totalMenitJadwal - mntTerlambat);
        const hadirJp = Math.ceil(menitHadir / DURASI_PER_JP_MENIT);
        totalHadirJp += hadirJp;
        agendaByDate[date].hadirJp += hadirJp;
      }
    }
  });

  let totalSakitJp = 0;
  let totalIzinJp = 0;

  izinList.forEach((i) => {
    const date = i.tanggal_izin;
    const dailyAgenda = agendaByDate[date];
    if (dailyAgenda) {
      const jpIzinSakit = Math.max(0, dailyAgenda.totalJadwalJp - dailyAgenda.hadirJp);
      if (i.kategori_izin === 'Sakit') totalSakitJp += jpIzinSakit;
      else if (i.kategori_izin === 'Izin') totalIzinJp += jpIzinSakit;
    } else {
      const estimasiJpKosong = 4;
      if (i.kategori_izin === 'Sakit') totalSakitJp += estimasiJpKosong;
      else if (i.kategori_izin === 'Izin') totalIzinJp += estimasiJpKosong;
    }
  });

  const stats: AttendanceStats = {
    hadir: totalHadirJp,
    totalAlpaJp,
    totalTerlambatJp,
    totalMenitTerlambat,
    sakit: totalSakitJp,
    izin: totalIzinJp,
  };

  // ---- Render ----

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold mb-2">
            <Sparkles size={16} className="text-indigo-400" /> Dashboard Utama
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
            Merawat Fitrah Mengukir Karya
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            All&#245;h yub&#257;rik f&#297;kum,{' '}
            <span className="font-semibold text-slate-200">{guru?.nama_lengkap ?? 'Bapak/Ibu Guru'}</span>!
          </p>
        </div>
      </div>

      {/* PENGUMUMAN */}
      <PengumumanBanner pengumumanList={pengumumanList} />

      {/* LINIMASA KEGIATAN */}
      <TimelineKegiatan />

      {/* RINGKASAN KEHADIRAN */}
      <AttendanceSummary
        stats={stats}
        filterMonth={filterMonth}
        onFilterChange={setFilterMonth}
        loading={agendaLoading}
      />
    </div>
  );
}
