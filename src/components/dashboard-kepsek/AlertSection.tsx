// src/components/dashboard-kepsek/AlertSection.tsx
// Section peringatan sistem — dokumen expired, SP aktif, action item, dll.

import { Link } from 'react-router-dom';
import {
  AlertTriangle, FileWarning, ShieldAlert, ListChecks, Calendar,
  ChevronRight, CheckCircle2,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================
export type AlertLevel = 'Tinggi' | 'Sedang' | 'Rendah';

export type AlertItem = {
  id: string;
  level: AlertLevel;
  judul: string;
  pesan: string;
  link: string;
  icon: 'dokumen' | 'sp' | 'action' | 'cuti';
};

type Props = {
  alerts: AlertItem[];
  loading: boolean;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function AlertSection({ alerts, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Perhatian Khusus</h3>
        </div>
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Perhatian Khusus</h3>
        </div>
        <div className="text-center py-6 rounded-lg border border-dashed border-slate-800">
          <CheckCircle2
            size={24}
            className="mx-auto text-emerald-500/60 mb-2"
          />
          <p className="text-xs text-slate-400 font-semibold">
            Tidak ada hal yang perlu perhatian khusus 🎉
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Semua modul berjalan normal
          </p>
        </div>
      </div>
    );
  }

  const levelStyle: Record<AlertLevel, string> = {
    Tinggi: 'border-rose-500/40 bg-rose-500/10',
    Sedang: 'border-amber-500/40 bg-amber-500/10',
    Rendah: 'border-slate-700 bg-slate-950/40',
  };

  const levelBadge: Record<AlertLevel, string> = {
    Tinggi: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    Sedang: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Rendah: 'bg-slate-700/50 text-slate-300 border-slate-600',
  };

  const iconMap = {
    dokumen: FileWarning,
    sp: ShieldAlert,
    action: ListChecks,
    cuti: Calendar,
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Perhatian Khusus</h3>
        </div>
        <span className="text-[10px] text-slate-500">
          {alerts.length} item
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((a) => {
          const Icon = iconMap[a.icon];
          return (
            <Link
              key={a.id}
              to={a.link}
              className={`flex items-start gap-3 p-3 rounded-xl border ${levelStyle[a.level]} hover:opacity-90 transition cursor-pointer group`}
            >
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-slate-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${levelBadge[a.level]}`}
                  >
                    {a.level}
                  </span>
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {a.judul}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {a.pesan}
                </p>
              </div>
              <ChevronRight
                size={14}
                className="text-slate-600 group-hover:text-slate-300 transition shrink-0 mt-1"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}