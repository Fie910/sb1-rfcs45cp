// src/components/dashboard-kepsek/ModulKpiSection.tsx
// KPI 4 modul khusus: Tahfidz, Kedisiplinan, HRIS, Rapat.

import { Link } from 'react-router-dom';
import {
  BookMarked, ShieldAlert, UserCog, Users, ArrowRight,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================
export type ModulKpiData = {
  tahfidz: { totalSetoran: number; siswaAktif: number; milestone: number };
  kedisiplinan: { pelanggaran: number; spAktif: number; prestasi: number };
  hris: { cutiPending: number; dokumenExpired: number };
  rapat: { bulanIni: number; actionItemPending: number };
};

type Props = {
  data: ModulKpiData | null;
  loading: boolean;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function ModulKpiSection({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse h-[140px]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Tahfidz */}
      <KpiCard
        icon={BookMarked}
        title="Tahfidz Quran"
        path="/tahfidz"
        color="emerald"
        metrics={[
          { label: 'Total Setoran', value: data.tahfidz.totalSetoran },
          { label: 'Siswa Aktif', value: data.tahfidz.siswaAktif },
          { label: 'Milestone', value: data.tahfidz.milestone },
        ]}
      />

      {/* Kedisiplinan */}
      <KpiCard
        icon={ShieldAlert}
        title="Kedisiplinan"
        path="/kedisiplinan"
        color="rose"
        metrics={[
          { label: 'Pelanggaran Bulan Ini', value: data.kedisiplinan.pelanggaran },
          { label: 'SP Aktif', value: data.kedisiplinan.spAktif, danger: data.kedisiplinan.spAktif > 0 },
          { label: 'Prestasi Bulan Ini', value: data.kedisiplinan.prestasi },
        ]}
      />

      {/* HRIS */}
      <KpiCard
        icon={UserCog}
        title="Kepegawaian"
        path="/hris"
        color="pink"
        metrics={[
          { label: 'Cuti Pending', value: data.hris.cutiPending, danger: data.hris.cutiPending > 3 },
          { label: 'Dokumen Expired', value: data.hris.dokumenExpired, danger: data.hris.dokumenExpired > 0 },
        ]}
      />

      {/* Rapat */}
      <KpiCard
        icon={Users}
        title="Rapat & Notulensi"
        path="/rapat"
        color="indigo"
        metrics={[
          { label: 'Rapat Bulan Ini', value: data.rapat.bulanIni },
          { label: 'Action Item Pending', value: data.rapat.actionItemPending, danger: data.rapat.actionItemPending > 5 },
        ]}
      />
    </div>
  );
}

// =============================================================================
// SUB — KPI CARD
// =============================================================================
type KpiColor = 'emerald' | 'rose' | 'pink' | 'indigo';

const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
};

type Metric = {
  label: string;
  value: number;
  danger?: boolean;
};

function KpiCard({
  icon: Icon,
  title,
  path,
  color,
  metrics,
}: {
  icon: any;
  title: string;
  path: string;
  color: KpiColor;
  metrics: Metric[];
}) {
  const c = CM[color];

  return (
    <Link
      to={path}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}
          >
            <Icon size={14} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
        </div>
        <ArrowRight
          size={12}
          className="text-slate-600 group-hover:text-slate-300 transition"
        />
      </div>

      <div className="space-y-1.5">
        {metrics.map((m, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{m.label}</span>
            <span
              className={`font-extrabold ${
                m.danger ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}