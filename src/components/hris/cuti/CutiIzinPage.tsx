// src/components/hris/cuti/CutiIzinPage.tsx
// Halaman utama modul Cuti & Izin dengan 3 tab.

import { useState, useMemo } from 'react';
import { CalendarDays, FileText, ShieldCheck, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PengajuanSayaTab } from './PengajuanSayaTab';
import { ApprovalTab } from './ApprovalTab';
import { RekapTab } from './RekapTab';
import {
  HR_APPROVER_ROLES, KEPSEK_ROLES, KEPALA_DIVISI_ROLES,
} from '../shared';

type TabKey = 'pengajuan' | 'approval' | 'rekap';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof FileText;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'pengajuan', label: 'Pengajuan Saya', icon: FileText },
  { key: 'approval', label: 'Approval', icon: ShieldCheck, managerOnly: true },
  { key: 'rekap', label: 'Rekap & Laporan', icon: BarChart3, managerOnly: true },
];

export function CutiIzinPage() {
  const { guru } = useAuth();

  const isManager = useMemo(() => {
    if (!guru?.role) return false;
    const r = guru.role.toLowerCase();
    return (
      HR_APPROVER_ROLES.includes(r) ||
      KEPSEK_ROLES.includes(r) ||
      KEPALA_DIVISI_ROLES.includes(r) ||
      ['admin', 'wakil_kepala'].includes(r)
    );
  }, [guru?.role]);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('pengajuan');

  // Guard: kalau tab aktif tidak visible → fallback
  const effectiveTab = visibleTabs.find((t) => t.key === activeTab)?.key ?? 'pengajuan';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <CalendarDays size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Cuti & Izin Pegawai
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pengajuan cuti, izin, approval berjenjang, dan laporan kepegawaian
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = effectiveTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div className="min-h-[400px]">
        {effectiveTab === 'pengajuan' && <PengajuanSayaTab />}
        {effectiveTab === 'approval' && isManager && <ApprovalTab />}
        {effectiveTab === 'rekap' && isManager && <RekapTab />}
      </div>
    </div>
  );
}