// src/pages/TvDisplayPage.tsx
// Halaman Publik untuk ditampilkan di TV Lobi Sekolah.
// Fitur: Auto-rotate antara Leaderboard Tahfidz, Prestasi, dan Kehadiran.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trophy, BookOpen, Star, Medal, Clock, Loader2, Sparkles, ChevronRight
} from 'lucide-react';

type LeaderboardTahfidz = { nama: string; kelas: string; total_halaman: number };
type LeaderboardPrestasi = { nama: string; kelas: string; total_poin: number };
type LeaderboardKehadiran = { nama: string; kelas: string; persentase: number };

type DisplayMode = 'tahfidz' | 'prestasi' | 'kehadiran';

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
      try {
        // A. Fetch Tahfidz (Total Halaman)
        const { data: tahfidzRes } = await supabase
          .from('tahfidz_setoran')
          .select(`
            halaman_snapshot,
            siswa:siswa_id (nama_lengkap, kelas:kelas_id (nama_kelas))
          `)
          .order('created_at', { ascending: false });

        if (tahfidzRes) {
          const map = new Map<string, LeaderboardTahfidz>();
          tahfidzRes.forEach((s: any) => {
            if (!s.siswa) return;
            const key = s.siswa.nama_lengkap;
            const existing = map.get(key);
            const halaman = Number(s.halaman_snapshot) || 0;
            if (existing) {
              existing.total_halaman += halaman;
            } else {
              map.set(key, {
                nama: s.siswa.nama_lengkap,
                kelas: s.siswa.kelas?.nama_kelas ?? '-',
                total_halaman: halaman,
              });
            }
          });
          const sorted = Array.from(map.values()).sort((a, b) => b.total_halaman - a.total_halaman);
          setDataTahfidz(sorted.slice(0, 10));
        }

        // B. Fetch Prestasi (Total Poin)
        const { data: prestasiRes } = await supabase
          .from('kesiswaan_prestasi')
          .select(`
            poin,
            siswa:siswa_id (nama_lengkap, kelas:kelas_id (nama_kelas))
          `);

        if (prestasiRes) {
          const map = new Map<string, LeaderboardPrestasi>();
          prestasiRes.forEach((p: any) => {
            if (!p.siswa) return;
            const key = p.siswa.nama_lengkap;
            const existing = map.get(key);
            if (existing) {
              existing.total_poin += p.poin;
            } else {
              map.set(key, {
                nama: p.siswa.nama_lengkap,
                kelas: p.siswa.kelas?.nama_kelas ?? '-',
                total_poin: p.poin,
              });
            }
          });
          const sorted = Array.from(map.values()).sort((a, b) => b.total_poin - a.total_poin);
          setDataPrestasi(sorted.slice(0, 10));
        }

        // C. Fetch Kehadiran (Mockup - Bisa disesuaikan dengan query presensi Anda)
        // Untuk sementara kita tampilkan data statis atau placeholder
        setDataKehadiran([
          { nama: 'Ahmad Fauzi', kelas: 'XII AKL 1', persentase: 100 },
          { nama: 'Siti Aminah', kelas: 'XI TKJ 2', persentase: 98 },
          { nama: 'Budi Santoso', kelas: 'XII TKR 1', persentase: 97 },
          { nama: 'Rina Melati', kelas: 'X FKK', persentase: 95 },
          { nama: 'Dedi Kurnia', kelas: 'XI AKL 2', persentase: 94 },
        ]);

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
        return { icon: BookOpen, title: 'TOP 10 TAHFIDZ', subtitle: 'Paling Banyak Menghafal (Halaman)', color: 'text-emerald-400' };
      case 'prestasi':
        return { icon: Trophy, title: 'TOP 10 PRESTASI', subtitle: 'Poin Prestasi Tertinggi', color: 'text-amber-400' };
      case 'kehadiran':
        return { icon: Clock, title: 'TOP 10 KEHADIRAN', subtitle: 'Siswa Paling Disiplin Hadir', color: 'text-indigo-400' };
    }
  };

  const header = renderHeader();
  const Icon = header.icon;

  const renderList = () => {
    const isTahfidz = mode === 'tahfidz';
    const isPrestasi = mode === 'prestasi';
    const list = isTahfidz ? dataTahfidz : isPrestasi ? dataPrestasi : dataKehadiran;

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
                {/* Medali / Peringkat */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black ${medalColor} shadow-lg`}>
                  #{idx + 1}
                </div>
                {/* Info Siswa */}
                <div>
                  <h3 className="text-3xl font-extrabold text-slate-100">{item.nama}</h3>
                  <p className="text-xl text-slate-400 font-medium">{item.kelas}</p>
                </div>
              </div>

              {/* Skor */}
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
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header TV */}
      <div className="text-center relative z-10">
        <div className="inline-flex items-center justify-center gap-4 mb-4">
          <Icon size={64} className={header.color} />
          <h1 className="text-6xl font-black tracking-tighter uppercase">{header.title}</h1>
        </div>
        <p className="text-2xl text-slate-400 font-semibold tracking-widest uppercase">{header.subtitle}</p>
        <div className="w-32 h-2 bg-gradient-to-r from-indigo-500 to-emerald-500 mx-auto mt-6 rounded-full" />
      </div>

      {/* List Content */}
      <div className="flex-1 relative z-10 flex items-center">
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
          {renderList()}
        </div>
      </div>

      {/* Footer TV */}
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