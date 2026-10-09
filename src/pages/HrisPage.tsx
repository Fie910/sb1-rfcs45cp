// src/pages/HrisPage.tsx
// Container halaman HRIS dengan 4 tab fungsional.
// ✅ Lazy load per tab — optimasi bundle size.

import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import {
  UserCog, Users, User, FolderOpen, BarChart3, Shield,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isHrManager } from '@/components/hris/shared';
import { TabLoadingFallback } from '@/components/TabLoadingFallback';
import { usePrefetchTabs } from '@/hooks/useLazyTabs';

// =============================================================================
// LAZY TAB COMPONENTS
// =============================================================================
const PegawaiTab = lazy(() =>
  import('@/components/hris/PegawaiTab').then((m) => ({ default: m.PegawaiTab }))
);
const ProfilSayaTab = lazy(() =>
  import('@/components/hris/ProfilSayaTab').then((m) => ({ default: m.ProfilSayaTab }))
);
const DokumenSayaTab = lazy(() =>
  import('@/components/hris/DokumenSayaTab').then((m) => ({ default: m.DokumenSayaTab }))
);
const DashboardHrTab = lazy(() =>
  import('@/components/hris/DashboardHrTab').then((m) => ({ default: m.DashboardHrTab }))
);
const CutiIzinPage = lazy(() =>
  import('@/components/hris/cuti/CutiIzinPage').then((m) => ({
    default: m.CutiIzinPage,
  }))
);

// =============================================================================
// TYPES
// =============================================================================
type TabKey = 'pegawai' | 'profil_saya' | 'dokumen' | 'cuti' | 'dashboard';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof UserCog;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'pegawai', label: 'Data Pegawai', icon: Users, managerOnly: true },
  { key: 'profil_saya', label: 'Profil Saya', icon: User },
  { key: 'dokumen', label: 'Dokumen Saya', icon: FolderOpen },
  { key: 'cuti', label: 'Cuti & Izin', icon: CalendarDays },
  { key: 'dashboard', label: 'Dashboard HR', icon: BarChart3, managerOnly: true },
];

// Prefetch map
const TAB_IMPORTERS: Record<TabKey, () => Promise<any>> = {
  pegawai: () => import('@/components/hris/PegawaiTab'),
  profil_saya: () => import('@/components/hris/ProfilSayaTab'),
  dokumen: () => import('@/components/hris/DokumenSayaTab'),
  cuti: () => import('@/components/hris/cuti/CutiIzinPage'),
  dashboard: () => import('@/components/hris/DashboardHrTab'),
};

// Role yang boleh akses HRIS (non-manager)
const HR_ACCESS_ROLES = [
  'guru',
  'guru_piket',
  'bk',
  'pustakawan',
  'akademik',
  'kesiswaan',
  'sarpras',
  'keuangan',
  'staf_akademik',
  'staf_kesiswaan',
  'staf_sarpras',
  'staf_keuangan',
];

// =============================================================================
// COMPONENT
// =============================================================================
export function HrisPage() {
  const { guru } = useAuth();
  const isManager = isHrManager(guru?.role);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>(
    isManager ? 'pegawai' : 'profil_saya'
  );

  useEffect(() => {
    const currentTab = ALL_TABS.find((t) => t.key === activeTab);
    if (currentTab?.managerOnly && !isManager) {
      setActiveTab('profil_saya');
    }
  }, [isManager, activeTab]);

  // Prefetch tab lain saat browser idle
  usePrefetchTabs(TAB_IMPORTERS, activeTab);

  // Guard: role tanpa akses
  if (
    !isManager &&
    guru?.role &&
    !HR_ACCESS_ROLES.includes(guru.role.toLowerCase())
  ) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 text-center space-y-3">
          <Shield size={40} className="mx-auto text-amber-400" />
          <h2 className="text-lg font-bold text-amber-300">Akses Terbatas</h2>
          <p className="text-xs text-amber-400/80 max-w-md mx-auto">
            Anda tidak memiliki akses ke modul ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <UserCog size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Data Kepegawaian
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Profil 360° pegawai, dokumen, pendidikan, dan riwayat kepegawaian
          </p>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
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

      {/* TAB CONTENT — LAZY */}
      <div className="min-h-[400px]">
        <Suspense
          fallback={
            <TabLoadingFallback
              label={`Memuat ${visibleTabs.find((t) => t.key === activeTab)?.label ?? ''}...`}
              minHeight="500px"
            />
          }
        >
          {activeTab === 'pegawai' && isManager && <PegawaiTab />}
          {activeTab === 'profil_saya' && <ProfilSayaTab />}
          {activeTab === 'dokumen' && <DokumenSayaTab />}
          {activeTab === 'cuti' && <CutiIzinPage />}
          {activeTab === 'dashboard' && isManager && <DashboardHrTab />}
        </Suspense>
      </div>
    </div>
  );
}