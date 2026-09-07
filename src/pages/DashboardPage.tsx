// DashboardPage.tsx

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Megaphone,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  BookHeart,
  CalendarDays,
  Timer,
  ClockAlert,
  HeartPulse,
  Stethoscope,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCanAccess } from '@/hooks/useCanAccess';
import { Modal } from '@/components/Modal';
import { TimelineKegiatan } from '@/components/TimelineKegiatan';

type AttendanceStats = {
  hadir: number;
  totalAlpaJp: number;
  totalTerlambatJp: number;
  totalMenitTerlambat: number;
  sakit: number;
  izin: number;
};

// Helper tanggal
const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper untuk menghitung selisih menit dari format "HH:mm:ss"
const hitungSelisihMenit = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};

// Helper untuk mengubah URL teks di dalam paragraf menjadi Link Aktif (Clickable)
const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all font-semibold transition-colors inline-flex items-center gap-1 mx-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink size={12} className="inline shrink-0" />
        </a>
      );
    }
    return part;
  });
};

export function DashboardPage() {
  const canAccess = useCanAccess('dashboard');
  const { guru } = useAuth();

  const [pengumumanList, setPengumumanList] = useState<any[]>([]);
  const [currentPengumuman, setCurrentPengumuman] = useState(0);
  const [detailPengumuman, setDetailPengumuman] = useState<any | null>(null);

  const [agendaList, setAgendaList] = useState<any[]>([]);
  const [izinList, setIzinList] = useState<any[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const today = getLocalToday();
  const DURASI_PER_JP_MENIT = 30; // 1 JP = 30 Menit.

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

  useEffect(() => {
    if (pengumumanList.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentPengumuman((prev) => (prev + 1) % pengumumanList.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [pengumumanList.length]);

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

  // LOGIKA PERHITUNGAN JP DINAMIS DARI WAKTU KBM
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

    if (!agendaByDate[date]) {
      agendaByDate[date] = { totalJadwalJp: 0, hadirJp: 0 };
    }

    agendaByDate[date].totalJadwalJp += jadwalJp;

    const mntTerlambat = a.menit_terlambat || 0;
    const alpaJpDariKolom = a.alpa_jam_pelajaran || 0;

    totalMenitTerlambat += mntTerlambat;

    if (a.status_kehadiran === 'Alpa') {
      const calculatedAlpaJp = jadwalJp > 0 ? jadwalJp : alpaJpDariKolom;
      totalAlpaJp += calculatedAlpaJp;
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
      if (i.kategori_izin === 'Sakit') {
        totalSakitJp += jpIzinSakit;
      } else if (i.kategori_izin === 'Izin') {
        totalIzinJp += jpIzinSakit;
      }
    } else {
      const estimasiJpKosong = 4;
      if (i.kategori_izin === 'Sakit') totalSakitJp += estimasiJpKosong;
      else if (i.kategori_izin === 'Izin') totalIzinJp += estimasiJpKosong;
    }
  });

  const stats: AttendanceStats = {
    hadir: totalHadirJp,
    totalAlpaJp: totalAlpaJp,
    totalTerlambatJp: totalTerlambatJp,
    totalMenitTerlambat: totalMenitTerlambat,
    sakit: totalSakitJp,
    izin: totalIzinJp,
  };

  const totalRecords = stats.hadir + stats.totalAlpaJp + stats.totalTerlambatJp + stats.sakit + stats.izin;
  const attendanceRate = totalRecords > 0 ? Math.round((stats.hadir / totalRecords) * 100) : 0;

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    };
  });

  const statCards = [
    { label: 'Hadir (JP)', value: stats.hadir, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/30', ring: 'ring-emerald-500/20', accent: 'bg-emerald-500' },
    { label: 'Absen (JP)', value: stats.totalAlpaJp, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-950/30', ring: 'ring-rose-500/20', accent: 'bg-rose-500' },
    { label: 'Terlambat (mnt)', value: `${stats.totalMenitTerlambat} mnt`, icon: Timer, color: 'text-amber-400', bg: 'bg-amber-950/30', ring: 'ring-amber-500/20', accent: 'bg-amber-500' },
    { label: 'Terlambat (JP)', value: stats.totalTerlambatJp, icon: ClockAlert, color: 'text-orange-400', bg: 'bg-orange-950/30', ring: 'ring-orange-500/20', accent: 'bg-orange-500' },
    { label: 'Sakit (JP)', value: stats.sakit, icon: Stethoscope, color: 'text-blue-400', bg: 'bg-blue-950/30', ring: 'ring-blue-500/20', accent: 'bg-blue-500' },
    { label: 'Izin (JP)', value: stats.izin, icon: HeartPulse, color: 'text-violet-400', bg: 'bg-violet-950/30', ring: 'ring-violet-500/20', accent: 'bg-violet-500' },
  ];

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
            Allõh yubãrik fĩkum, <span className="font-semibold text-slate-200">{guru?.nama_lengkap ?? 'Bapak/Ibu Guru'}</span>!
          </p>
        </div>
      </div>

      {/* PENGUMUMAN RESMI SEKOLAH */}
      <div className="relative group overflow-hidden rounded-3xl bg-slate-900 p-4 md:p-6 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
              <Megaphone size={16} />
            </div>
            <div>
              <h2 className="font-extrabold text-xs tracking-wide text-slate-100 uppercase">PENGUMUMAN RESMI SEKOLAH</h2>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">Klik banner pengumuman untuk melihat rincian penjelasan</p>
            </div>
          </div>

          {pengumumanList.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPengumuman((prev) => (prev === 0 ? pengumumanList.length - 1 : prev - 1))}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPengumuman((prev) => (prev + 1) % pengumumanList.length)}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 w-full">
          {pengumumanList.length > 0 ? (
            pengumumanList.map((p, idx) => {
              const imageUrl = p.gambar_url || p.image_url;
              return (
                <div
                  key={p.id}
                  className={`w-full transition-all duration-500 ease-in-out ${
                    idx === currentPengumuman
                      ? 'opacity-100 scale-100 relative pointer-events-auto'
                      : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'
                  }`}
                >
                  <button
                    onClick={() => setDetailPengumuman(p)}
                    className="w-full text-left group/item cursor-pointer overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 shadow-lg relative flex flex-col justify-end"
                  >
                    <div className="relative w-full aspect-video overflow-hidden bg-slate-950 flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={p.judul}
                          className="w-full h-full object-contain transition-transform duration-500 group-hover/item:scale-[1.02]"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 text-slate-400 p-6 text-center">
                          <Megaphone size={48} className="mb-2 text-indigo-400/50" />
                          <p className="text-xs font-semibold text-slate-400">Pengumuman Bergambar</p>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

                      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5 flex items-end justify-between gap-3 z-10">
                        <div className="flex-1 pr-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-1">
                            <Sparkles size={10} /> Informasi Resmi
                          </span>
                          <h3 className="font-extrabold text-sm sm:text-base md:text-xl text-slate-100 group-hover/item:text-indigo-300 transition-colors line-clamp-1 drop-shadow-md">
                            {p.judul}
                          </h3>
                        </div>
                        <span className="shrink-0 text-[11px] sm:text-xs font-bold px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center gap-1.5 transition-colors">
                          Lihat Detail <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="w-full py-10 flex flex-col items-center justify-center text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
              <Megaphone size={36} className="text-slate-600 mb-2" />
              <h3 className="font-bold text-sm text-slate-200">Tidak Ada Pengumuman Aktif</h3>
              <p className="text-xs text-slate-400 mt-0.5">Saat ini belum ada pengumuman baru yang diterbitkan.</p>
            </div>
          )}
        </div>
      </div>

      {/* LINIMASA RENCANA KEGIATAN SEKOLAH */}
      <TimelineKegiatan />

      {/* DASHBOARD PRESENSI */}
      <div className="relative group bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-800 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <BookHeart size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Catatan Kehadiran Saya</h2>
              <p className="text-slate-400 text-xs mt-0.5">Ringkasan statistik kehadiran mengajar bulanan</p>
            </div>
          </div>
          <div className="relative">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="text-xs font-bold pl-4 pr-8 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 shadow-inner focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none outline-none cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value} className="bg-slate-900 text-slate-200">
                  {m.label}
                </option>
              ))}
            </select>
            <CalendarDays size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {agendaLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>
        ) : (
          <div className="p-5 md:p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-inner">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 lg:border-r border-slate-800">
                <div className="relative w-36 h-36 mb-3 drop-shadow-md">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="11" />
                    <circle
                      cx="60" cy="60" r="50" fill="none" stroke="url(#gradient-blue-integrated)" strokeWidth="11" strokeLinecap="round"
                      strokeDasharray={`${(attendanceRate / 100) * 314.16} 314.16`}
                      className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id="gradient-blue-integrated" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-100">{attendanceRate}%</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kehadiran</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-800">
                  <TrendingUp size={14} className="text-indigo-400" />
                  <span><strong className="text-slate-100">{stats.hadir} JP hadir</strong> dari {totalRecords} JP total</span>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className={`relative overflow-hidden ${card.bg} rounded-2xl p-3.5 border border-slate-800/80 shadow-sm flex items-center gap-3`}>
                        <div className={`absolute top-0 left-0 bottom-0 w-1 ${card.accent}`} />
                        <div className={`w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 ring-1 ${card.ring}`}>
                          <Icon className={card.color} size={18} />
                        </div>
                        <div>
                          <p className={`text-base font-black ${card.color}`}>{card.value}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5">{card.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL PENGUMUMAN */}
      <Modal open={!!detailPengumuman} onClose={() => setDetailPengumuman(null)} title={detailPengumuman?.judul ?? ''} size="lg">
        {detailPengumuman && (
          <div className="space-y-4 pt-1">
            {(detailPengumuman.gambar_url || detailPengumuman.image_url) && (
              <div className="w-full max-h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-2">
                <img
                  src={detailPengumuman.gambar_url || detailPengumuman.image_url}
                  alt={detailPengumuman.judul}
                  className="w-full h-full object-contain max-h-80 mx-auto rounded-xl"
                />
              </div>
            )}

            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 w-fit">
              <CalendarDays size={14} />
              <span>
                Berlaku: {new Date(detailPengumuman.tanggal_mulai).toLocaleDateString('id-ID')} - {new Date(detailPengumuman.tanggal_selesai).toLocaleDateString('id-ID')}
              </span>
            </div>

            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {renderTextWithLinks(detailPengumuman.isi)}
            </div>

            {(detailPengumuman.url || detailPengumuman.link) && (
              <div className="pt-2">
                <a
                  href={detailPengumuman.url || detailPengumuman.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <Link2 size={16} /> Buka Tautan Terkait
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}