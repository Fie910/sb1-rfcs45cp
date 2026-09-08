// AttendanceSummary.tsx
// Blok ringkasan kehadiran: donut chart + grid StatCard + filter bulan.

import {
  Loader2,
  BookHeart,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Timer,
  ClockAlert,
  Stethoscope,
  HeartPulse,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';

interface AttendanceStats {
  hadir: number;
  totalAlpaJp: number;
  totalTerlambatJp: number;
  totalMenitTerlambat: number;
  sakit: number;
  izin: number;
}

interface AttendanceSummaryProps {
  stats: AttendanceStats;
  filterMonth: string;
  onFilterChange: (month: string) => void;
  loading: boolean;
}

export function AttendanceSummary({ stats, filterMonth, onFilterChange, loading }: AttendanceSummaryProps) {
  const totalRecords = stats.hadir + stats.totalAlpaJp + stats.totalTerlambatJp + stats.sakit + stats.izin;
  const attendanceRate = totalRecords > 0 ? Math.round((stats.hadir / totalRecords) * 100) : 0;

  // Opsi dropdown: 12 bulan ke belakang
  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    };
  });

  const statCards = [
    { label: 'Hadir (JP)',         value: stats.hadir,                  icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/30', ring: 'ring-emerald-500/20', accent: 'bg-emerald-500' },
    { label: 'Absen (JP)',         value: stats.totalAlpaJp,            icon: XCircle,      color: 'text-rose-400',    bg: 'bg-rose-950/30',    ring: 'ring-rose-500/20',    accent: 'bg-rose-500'    },
    { label: 'Terlambat (mnt)',    value: `${stats.totalMenitTerlambat} mnt`, icon: Timer,   color: 'text-amber-400',   bg: 'bg-amber-950/30',   ring: 'ring-amber-500/20',   accent: 'bg-amber-500'   },
    { label: 'Terlambat (JP)',     value: stats.totalTerlambatJp,       icon: ClockAlert,   color: 'text-orange-400',  bg: 'bg-orange-950/30',  ring: 'ring-orange-500/20',  accent: 'bg-orange-500'  },
    { label: 'Sakit (JP)',         value: stats.sakit,                  icon: Stethoscope,  color: 'text-blue-400',    bg: 'bg-blue-950/30',    ring: 'ring-blue-500/20',    accent: 'bg-blue-500'    },
    { label: 'Izin (JP)',          value: stats.izin,                   icon: HeartPulse,   color: 'text-violet-400',  bg: 'bg-violet-950/30',  ring: 'ring-violet-500/20',  accent: 'bg-violet-500'  },
  ];

  return (
    <div className="relative group bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-800 flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <BookHeart size={22} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-slate-100 tracking-tight">Catatan Kehadiran Saya</h2>
            <p className="text-slate-400 text-xs mt-0.5">Ringkasan statistik kehadiran mengajar bulanan</p>
          </div>
        </div>

        {/* Filter bulan */}
        <div className="relative w-full sm:w-auto">
          <select
            value={filterMonth}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full text-xs font-bold pl-4 pr-8 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 shadow-inner focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none outline-none cursor-pointer"
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

      {/* Konten */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-400" size={28} />
        </div>
      ) : (
        <div className="p-5 md:p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-inner">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Donut Chart */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 lg:border-r border-slate-800">
              <div className="relative w-36 h-36 mb-3 drop-shadow-md">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="11" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke="url(#gradient-attendance)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${(attendanceRate / 100) * 314.16} 314.16`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="gradient-attendance" x1="0%" y1="0%" x2="100%" y2="100%">
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
                <span>
                  <strong className="text-slate-100">{stats.hadir} JP hadir</strong> dari {totalRecords} JP total
                </span>
              </div>
            </div>

            {/* Grid StatCard */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {statCards.map((card) => (
                  <StatCard key={card.label} {...card} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
