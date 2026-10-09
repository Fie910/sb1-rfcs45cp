// src/pages/KedisiplinanPage.tsx
// Container halaman Kedisiplinan Siswa dengan tab navigation.
// ✅ Lazy load per tab — optimasi bundle size.

import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert, AlertTriangle, Trophy, FileWarning,
  BarChart3, ClipboardList, Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isKedisiplinanManager } from '@/components/kedisiplinan/shared';
import { TabLoadingFallback } from '@/components/TabLoadingFallback';
import { usePrefetchTabs } from '@/hooks/useLazyTabs';

// =============================================================================
// LAZY TAB COMPONENTS
// =============================================================================
const PelanggaranTab = lazy(() =>
  import('@/components/kedisiplinan/PelanggaranTab').then((m) => ({
    default: m.PelanggaranTab,
  }))
);
const PrestasiTab = lazy(() =>
  import('@/components/kedisiplinan/PrestasiTab').then((m) => ({
    default: m.PrestasiTab,
  }))
);
const SuratPeringatanTab = lazy(() =>
  import('@/components/kedisiplinan/SuratPeringatanTab').then((m) => ({
    default: m.SuratPeringatanTab,
  }))
);
const RekapPoinTab = lazy(() =>
  import('@/components/kedisiplinan/RekapPoinTab').then((m) => ({
    default: m.RekapPoinTab,
  }))
);
const DashboardKedisiplinanTab = lazy(() =>
  import('@/components/kedisiplinan/DashboardKedisiplinanTab').then((m) => ({
    default: m.DashboardKedisiplinanTab,
  }))
);

// =============================================================================
// TYPES
// =============================================================================
type TabKey = 'pelanggaran' | 'prestasi' | 'sp' | 'rekap' | 'dashboard';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof ShieldAlert;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'pelanggaran', label: 'Pelanggaran', icon: AlertTriangle },
  { key: 'prestasi', label: 'Prestasi', icon: Trophy },
  { key: 'sp', label: 'Surat Peringatan', icon: FileWarning },
  { key: 'rekap', label: 'Rekap Poin', icon: ClipboardList },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

// Prefetch map
const TAB_IMPORTERS: Record<TabKey, () => Promise<any>> = {
  pelanggaran: () => import('@/components/kedisiplinan/PelanggaranTab'),
  prestasi: () => import('@/components/kedisiplinan/PrestasiTab'),
  sp: () => import('@/components/kedisiplinan/SuratPeringatanTab'),
  rekap: () => import('@/components/kedisiplinan/RekapPoinTab'),
  dashboard: () => import('@/components/kedisiplinan/DashboardKedisiplinanTab'),
};

// =============================================================================
// COMPONENT
// =============================================================================
export function KedisiplinanPage() {
  const { guru } = useAuth();
  const isManager = isKedisiplinanManager(guru?.role);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('pelanggaran');

  useEffect(() => {
    const currentTab = ALL_TABS.find((t) => t.key === activeTab);
    if (currentTab?.managerOnly && !isManager) {
      setActiveTab('pelanggaran');
    }
  }, [isManager, activeTab]);

  // Prefetch tab lain saat browser idle
  usePrefetchTabs(TAB_IMPORTERS, activeTab);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/10">
          <ShieldAlert size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Kedisiplinan Siswa
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pencatatan pelanggaran, prestasi, dan surat peringatan siswa
          </p>
        </div>
      </div>

      {/* Guard akses */}
      {!isManager ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 text-center space-y-3">
          <Shield size={40} className="mx-auto text-amber-400" />
          <h2 className="text-lg font-bold text-amber-300">Akses Terbatas</h2>
          <p className="text-xs text-amber-400/80 max-w-md mx-auto">
            Modul Kedisiplinan hanya dapat diakses oleh Divisi Kesiswaan, BK,
            Kepala Sekolah, Wakil Kepala, dan Admin.
          </p>
        </div>
      ) : (
        <>
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
                      ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-lg shadow-rose-500/20'
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
              {activeTab === 'pelanggaran' && <PelanggaranTab />}
              {activeTab === 'prestasi' && <PrestasiTab />}
              {activeTab === 'sp' && <SuratPeringatanTab />}
              {activeTab === 'rekap' && <RekapPoinTab />}
              {activeTab === 'dashboard' && <DashboardKedisiplinanTab />}
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}