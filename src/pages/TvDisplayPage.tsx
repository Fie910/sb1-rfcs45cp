// src/pages/TvDisplayPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, BookOpen, Clock, Loader2 } from 'lucide-react';

type LeaderboardTahfidz = { nama: string; kelas: string; total_halaman: number; total_ayat: number };
type LeaderboardPrestasi = { nama: string; kelas: string; total_poin: number };
type LeaderboardKehadiran = { nama: string; kelas: string; persentase: number; total_hari: number };

type DisplayMode = 'tahfidz' | 'prestasi' | 'kehadiran';

// =============================================================================
// HELPER TANGGAL (WIB)
// =============================================================================
function getWibDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getDateFilters() {
  const now = new Date();
  const todayStr = getWibDateString(now);

  // 1. Hitung 30 hari terakhir
  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = getWibDateString(thirtyDaysAgoDate);

  // 2. Hitung awal pekan ini (Senin)
  const wibDayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(now);
  const daysMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const currentDay = daysMap[wibDayStr] || 1; // 1 = Senin
  
  // Jika hari ini Minggu (0), mundur 6 hari ke Senin. Jika bukan, mundur (hari ini - 1)
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const startOfWeekDate = new Date(now.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
  const startOfWeekStr = getWibDateString(startOfWeekDate);

  return { todayStr, thirtyDaysAgoStr, startOfWeekStr };
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================
export default function TvDisplayPage() {
  const [mode, setMode] = useState<DisplayMode>('tahfidz');
  const [loading, setLoading] = useState(true);

  const [dataTahfidz, setDataTahfidz] = useState<LeaderboardTahfidz[]>([]);
  const [dataPrestasi, setDataPrestasi] = useState<LeaderboardPrestasi[]>([]);
  const [dataKehadiran, setDataKehadiran] = useState<LeaderboardKehadiran[]>([]);

  // 1. Auto-rotate mode setiap 15 detik
  useEffect(() => {
    const modes: DisplayMode[] = ['tahfidz', 'prestasi', 'kehadiran'];
    const interval = setInterval(() => {
      setMode((prev) => {
        const nextIdx = (modes.indexOf(prev) + 1) % modes.length;
        return modes[nextIdx];
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { todayStr, thirtyDaysAgoStr, startOfWeekStr } = getDateFilters();

      try {
        // =====================================================================
        // A. FETCH SISWA (Kamus Data untuk Join Manual)
        // =====================================================================
        const { data: siswaData } = await supabase
          .from('siswas')
          .select('id, nama_lengkap, kelas:kelas_id (nama_kelas)');

        const siswaMap = new Map<number, { nama: string; kelas: string }>();
        (siswaData || []).forEach((s: any) => {
          siswaMap.set(s.id, {
            nama: s.nama_lengkap,
            kelas: s.kelas?.nama_kelas ?? '-',
          });
        });

        // =====================================================================
        // B. FETCH TAHFIDZ (Pekan Ini)
        // =====================================================================
        const { data: setoranRes } = await supabase
          .from('tahfidz_setoran')
          .select('id, siswa_id, halaman_snapshot')
          .gte('tanggal', startOfWeekStr)
          .lte('tanggal', todayStr);

        const { data: ayatRes } = await supabase
          .from('tahfidz_setoran_ayat')
          .select('setoran_id');

        if (setoranRes) {
          const ayatCountMap = new Map<string, number>();
          (ayatRes || []).forEach((a: any) => {
            ayatCountMap.set(a.setoran_id, (ayatCountMap.get(a.setoran_id) || 0) + 1);
          });

          const map = new Map<number, LeaderboardTahfidz>();
          
          setoranRes.forEach((s: any) => {
            const siswaInfo = siswaMap.get(s.siswa_id);
            if (!siswaInfo) return;

            const existing = map.get(s.siswa_id) || {
              nama: siswaInfo.nama,
              kelas: siswaInfo.kelas,
              total_halaman: 0,
              total_ayat: 0,
            };

            existing.total_halaman += Number(s.halaman_snapshot) || 0;
            existing.total_ayat += ayatCountMap.get(s.id) || 0;

            map.set(s.siswa_id, existing);
          });

          const sorted = Array.from(map.values()).sort((a, b) => b.total_halaman - a.total_halaman);
          setDataTahfidz(sorted.slice(0, 10));
        }

        // =====================================================================
        // C. FETCH PRESTASI (Semua Waktu)
        // =====================================================================
        const { data: prestasiRes } = await supabase
          .from('kesiswaan_prestasi')
          .select('siswa_id, poin');

        if (prestasiRes) {
          const map = new Map<number, LeaderboardPrestasi>();
          prestasiRes.forEach((p: any) => {
            const siswaInfo = siswaMap.get(p.siswa_id);
            if (!siswaInfo) return;

            const existing = map.get(p.siswa_id) || {
              nama: siswaInfo.nama,
              kelas: siswaInfo.kelas,
              total_poin: 0,
            };
            existing.total_poin += p.poin;
            map.set(p.siswa_id, existing);
          });
          const sorted = Array.from(map.values()).sort((a, b) => b.total_poin - a.total_poin);
          setDataPrestasi(sorted.slice(0, 10));
        }

        // =====================================================================
        // D. FETCH KEHADIRAN (30 Hari Terakhir)
        // =====================================================================
        const { data: presensiRes } = await supabase
          .from('presensi_siswa_kesiswaans')
          .select('siswa_id, status_kehadiran')
          .gte('tanggal', thirtyDaysAgoStr)
          .lte('tanggal', todayStr);

        if (presensiRes) {
          const map = new Map<number, { hadir: number; total: number }>();
          presensiRes.forEach((p: any) => {
            const existing = map.get(p.siswa_id) || { hadir: 0, total: 0 };
            existing.total += 1;
            if (p.status_kehadiran === 'Hadir') existing.hadir += 1;
            map.set(p.siswa_id, existing);
          });

          const result: LeaderboardKehadiran[] = [];
          map.forEach((val, siswaId) => {
            const siswaInfo = siswaMap.get(siswaId);
            if (siswaInfo && val.total > 0) {
              result.push({
                nama: siswaInfo.nama,
                kelas: siswaInfo.kelas,
                persentase: Math.round((val.hadir / val.total) * 100),
                total_hari: val.total,
              });
            }
          });
          const sorted = result.sort((a, b) => b.persentase - a.persentase);
          setDataKehadiran(sorted.slice(0, 10));
        }

      } catch (err) {
        console.error('Error fetching TV data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={64} className="animate-spin text-indigo-500 mb-6" />
        <p className="text-2xl font-bold tracking-widest uppercase">Memuat Data...</p>
      </div>
    );
  }

  const renderHeader = () => {
    switch (mode) {
      case 'tahfidz':
        return { icon: BookOpen, title: 'TOP 10 TAHFIDZ', subtitle: 'Pekan Ini (Halaman)', color: 'text-emerald-400' };
      case 'prestasi':
        return { icon: Trophy, title: 'TOP 10 PRESTASI', subtitle: 'Poin Prestasi Tertinggi', color: 'text-amber-400' };
      case 'kehadiran':
        return { icon: Clock, title: 'TOP 10 KEHADIRAN', subtitle: '30 Hari Terakhir', color: 'text-indigo-400' };
    }
  };

  const header = renderHeader();
  const Icon = header.icon;

  const renderList = () => {
    const isTahfidz = mode === 'tahfidz';
    const isPrestasi = mode === 'prestasi';
    const list = isTahfidz ? dataTahfidz : isPrestasi ? dataPrestasi : dataKehadiran;

    if (list.length === 0) {
      return (
        <div className="text-center text-slate-500 text-3xl mt-20">
          Belum ada data untuk ditampilkan
        </div>
      );
    }

    return (
      <div className="space-y-4 w-full max-w-5xl mx-auto mt-8">
        {list.map((item, idx) => {
          const isTop3 = idx < 3;
          const medalColor = idx === 0 ? 'bg-amber-400 text-amber-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-amber-50' : 'bg-slate-800 text-slate-400';

          return (
            <div
              key={idx}
              className={`flex items-center justify-between p-4 md:p-6 rounded-3xl border transition-all duration-700 ${
                isTop3
                  ? 'bg-slate-900 border-slate-700 shadow-2xl shadow-indigo-500/10 scale-100'
                  : 'bg-slate-900/50 border-slate-800/50 scale-95 opacity-80'
              }`}
            >
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black ${medalColor} shadow-lg`}>
                  #{idx + 1}
                </div>
                <div>
                  <h3 className="text-3xl font-extrabold text-slate-100">{item.nama}</h3>
                  <p className="text-xl text-slate-400 font-medium">{item.kelas}</p>
                  
                  {isTahfidz && (
                    <p className="text-sm text-emerald-500/80 font-semibold mt-1">
                      {(item as LeaderboardTahfidz).total_ayat} Ayat Disetorkan
                    </p>
                  )}
                  {mode === 'kehadiran' && (
                    <p className="text-sm text-indigo-500/80 font-semibold mt-1">
                      Dari {(item as LeaderboardKehadiran).total_hari} Hari Tercatat
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className={`text-5xl font-black ${header.color}`}>
                  {isTahfidz ? (item as LeaderboardTahfidz).total_halaman.toFixed(1) : isPrestasi ? (item as LeaderboardPrestasi).total_poin : (item as LeaderboardKehadiran).persentase}
                </span>
                <span className="text-lg text-slate-500 font-bold ml-2">
                  {isTahfidz ? 'Hal' : isPrestasi ? 'Poin' : '%'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center relative z-10">
        <div className="inline-flex items-center justify-center gap-4 mb-4">
          <Icon size={64} className={header.color} />
          <h1 className="text-6xl font-black tracking-tighter uppercase">{header.title}</h1>
        </div>
        <p className="text-2xl text-slate-400 font-semibold tracking-widest uppercase">{header.subtitle}</p>
        <div className="w-32 h-2 bg-gradient-to-r from-indigo-500 to-emerald-500 mx-auto mt-6 rounded-full" />
      </div>

      <div className="flex-1 relative z-10 flex items-center">
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
          {renderList()}
        </div>
      </div>

      <div className="text-center relative z-10 pt-8 border-t border-slate-800/50 flex items-center justify-between text-slate-500">
        <p className="text-xl font-bold tracking-widest">SMK KH. A. WAHAB MUHSIN</p>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          Live Update
        </div>
      </div>
    </div>
  );
}