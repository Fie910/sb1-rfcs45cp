// src/pages/PerpustakaanPage.tsx
// Container halaman Perpustakaan dengan lazy-loaded tabs.
// Setiap tab di-load hanya saat dibuka (optimasi bundle).

import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import {
  Library, Book, Users, Send, Newspaper, BarChart3, Search, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isPustakawan } from '@/components/perpustakaan/shared';
import { TabLoadingFallback } from '@/components/TabLoadingFallback';
import { usePrefetchTabs } from '@/hooks/useLazyTabs';

// =============================================================================
// LAZY TAB COMPONENTS
// =============================================================================
const BukuTab = lazy(() =>
  import('@/components/perpustakaan/BukuTab').then((m) => ({ default: m.BukuTab }))
);
const AnggotaTab = lazy(() =>
  import('@/components/perpustakaan/AnggotaTab').then((m) => ({ default: m.AnggotaTab }))
);
const PeminjamanTab = lazy(() =>
  import('@/components/perpustakaan/PeminjamanTab').then((m) => ({ default: m.PeminjamanTab }))
);
const SerialTab = lazy(() =>
  import('@/components/perpustakaan/SerialTab').then((m) => ({ default: m.SerialTab }))
);
const OPACTab = lazy(() =>
  import('@/components/perpustakaan/OPACTab').then((m) => ({ default: m.OPACTab }))
);
const DashboardPerpusTab = lazy(() =>
  import('@/components/perpustakaan/DashboardPerpusTab').then((m) => ({
    default: m.DashboardPerpusTab,
  }))
);
const InventarisasiTab = lazy(() =>
  import('@/components/perpustakaan/InventarisasiTab').then((m) => ({
    default: m.InventarisasiTab,
  }))
);

// =============================================================================
// TAB DEFINITION
// =============================================================================
type TabKey = 'buku' | 'anggota' | 'peminjaman' | 'serial' | 'inventarisasi' | 'opac' | 'dashboard';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof Book;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'buku', label: 'Katalog Buku', icon: Book },
  { key: 'anggota', label: 'Anggota', icon: Users },
  { key: 'peminjaman', label: 'Peminjaman', icon: Send },
  { key: 'serial', label: 'Majalah & Jurnal', icon: Newspaper },
  { key: 'inventarisasi', label: 'Inventarisasi', icon: ClipboardCheck, managerOnly: true },
  { key: 'opac', label: 'Pencarian Publik (OPAC)', icon: Search },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

// Prefetch map — dipakai usePrefetchTabs untuk background load
const TAB_IMPORTERS: Record<TabKey, () => Promise<any>> = {
  buku: () => import('@/components/perpustakaan/BukuTab'),
  anggota: () => import('@/components/perpustakaan/AnggotaTab'),
  peminjaman: () => import('@/components/perpustakaan/PeminjamanTab'),
  serial: () => import('@/components/perpustakaan/SerialTab'),
  opac: () => import('@/components/perpustakaan/OPACTab'),
  dashboard: () => import('@/components/perpustakaan/DashboardPerpusTab'),
  inventarisasi: () => import('@/components/perpustakaan/InventarisasiTab'),
};

// =============================================================================
// COMPONENT
// =============================================================================
export function PerpustakaanPage() {
  const { guru } = useAuth();
  const isManager = isPustakawan(guru?.role);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('buku');

  useEffect(() => {
    const currentTab = ALL_TABS.find((t) => t.key === activeTab);
    if (currentTab?.managerOnly && !isManager) {
      setActiveTab('buku');
    }
  }, [isManager, activeTab]);

  // Prefetch tab lain saat browser idle
  usePrefetchTabs(TAB_IMPORTERS, activeTab);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <Library size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Perpustakaan Sekolah
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Katalog, sirkulasi, dan statistik literasi perpustakaan
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

      {/* TAB CONTENT — LAZY LOADED */}
      <div className="min-h-[400px]">
        <Suspense
          fallback={
            <TabLoadingFallback
              label={`Memuat ${visibleTabs.find((t) => t.key === activeTab)?.label ?? ''}...`}
              minHeight="500px"
            />
          }
        >
          {activeTab === 'buku' && <BukuTab />}
          {activeTab === 'anggota' && <AnggotaTab />}
          {activeTab === 'peminjaman' && <PeminjamanTab />}
          {activeTab === 'serial' && <SerialTab />}
          {activeTab === 'opac' && <OPACTab />}
          {activeTab === 'dashboard' && <DashboardPerpusTab />}
          {activeTab === 'inventarisasi' && <InventarisasiTab />}
        </Suspense>
      </div>
    </div>
  );
}