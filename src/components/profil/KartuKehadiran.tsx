// src/components/profil/KartuKehadiran.tsx
// Kartu ringkasan kehadiran di halaman Profil — donut + 6 stat cards + filter bulan.

import {
  Loader2, BookHeart, CalendarDays, TrendingUp, CheckCircle2,
  XCircle, Timer, ClockAlert, Stethoscope, HeartPulse, Calendar,
} from 'lucide-react';
import { useKehadiranGuru, getMonthOptions } from '@/hooks/useKehadiranGuru';

// =============================================================================
// KOMPONEN
// =============================================================================
export function KartuKehadiran() {
  const { stats, loading, filterMonth, setFilterMonth } = useKehadiranGuru();
  const monthOptions = getMonthOptions();

  const totalRecords =
    stats.hadir_jp + stats.alpa_jp + stats.izin_jp + stats.sakit_jp;

  const statCards = [
    {
      label: 'Hadir',
      unit: 'JP',
      value: stats.hadir_jp,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
    {
      label: 'Alpa',
      unit: 'JP',
      value: stats.alpa_jp,
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
    },
    {
      label: 'Izin',
      unit: 'JP',
      value: stats.izin_jp,
      icon: HeartPulse,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/30',
    },
    {
      label: 'Sakit',
      unit: 'JP',
      value: stats.sakit_jp,
      icon: Stethoscope,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
    },
    {
      label: 'Terlambat',
      unit: 'mnt',
      value: stats.total_menit_terlambat,
      icon: Timer,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      label: 'Setara',
      unit: 'JP',
      value: stats.total_terlambat_jp.toFixed(1),
      icon: ClockAlert,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <BookHeart size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-100">
              Catatan Kehadiran Saya
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Ringkasan presensi mengajar bulanan
            </p>
          </div>
        </div>

        {/* Filter bulan */}
        <div className="relative w-full sm:w-auto">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full text-xs font-bold pl-4 pr-8 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none outline-none cursor-pointer"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value} className="bg-slate-900">
                {m.label}
              </option>
            ))}
          </select>
          <CalendarDays
            size={13}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
        </div>
      </div>

      {/* BODY */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-400" size={26} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* DONUT */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center lg:border-r border-slate-800">
            <div className="relative w-32 h-32 md:w-36 md:h-36 mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="11"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="url(#gradient-khd)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.rate / 100) * 314.16} 314.16`}
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="gradient-khd" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-100">
                  {stats.rate}%
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Kehadiran
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
              <TrendingUp size={12} className="text-indigo-400" />
              <span>
                <strong className="text-slate-100">{stats.hadir_jp} JP hadir</strong>{' '}
                dari {totalRecords} JP
              </span>
            </div>

            {stats.total_sesi > 0 && (
              <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                <Calendar size={10} />
                {stats.total_sesi} sesi mengajar
                {stats.total_sesi_terlambat > 0 && (
                  <span className="text-amber-400">
                    {' · '}{stats.total_sesi_terlambat} terlambat
                  </span>
                )}
              </p>
            )}
          </div>

          {/* STAT CARDS */}
          <div className="lg:col-span-8">
            {totalRecords === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                <BookHeart size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-500">
                  Belum ada data presensi mengajar bulan ini
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className={`${card.bg} ${card.border} border rounded-xl p-3`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg bg-slate-950/60 ${card.color} flex items-center justify-center mb-2`}
                      >
                        <Icon size={13} />
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        {card.label}
                      </p>
                      <p className={`text-lg font-extrabold ${card.color} mt-0.5 leading-tight`}>
                        {card.value}
                        <span className="text-[10px] font-bold text-slate-500 ml-1">
                          {card.unit}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER NOTE */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          💡 <strong className="text-slate-400">Keterangan:</strong> 1 JP = 30 menit.
          Rate kehadiran = hadir / total (tidak termasuk keterlambatan).
          Info "Terlambat" hanya sebagai catatan pribadi.
        </p>
      </div>
    </div>
  );
}