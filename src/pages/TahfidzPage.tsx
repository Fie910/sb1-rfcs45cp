// src/pages/TahfidzPage.tsx
// Container halaman Tahfidz Quran dengan lazy-loaded tabs.

import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { BookOpen, Users, Target, BarChart3, BookMarked } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isTahfidzManager } from '@/components/tahfidz/shared';
import { TabLoadingFallback } from '@/components/TabLoadingFallback';
import { usePrefetchTabs } from '@/hooks/useLazyTabs';
import { supabase } from '@/lib/supabase';
import type { TahfidzSurah } from '@/types/database';
import { canAccessTahfidz, isTahfidzManager } from '@/components/tahfidz/shared';
import { ShieldAlert } from 'lucide-react';

// =============================================================================
// LAZY TAB COMPONENTS
// =============================================================================
const SetoranTab = lazy(() =>
  import('@/components/tahfidz/SetoranTab').then((m) => ({ default: m.SetoranTab }))
);
const DashboardTahfidzTab = lazy(() =>
  import('@/components/tahfidz/DashboardTahfidzTab').then((m) => ({
    default: m.DashboardTahfidzTab,
  }))
);
const ProgressSiswaTab = lazy(() =>
  import('@/components/tahfidz/ProgressSiswaTab').then((m) => ({
    default: m.ProgressSiswaTab,
  }))
);
const TargetTab = lazy(() =>
  import('@/components/tahfidz/TargetTab').then((m) => ({ default: m.TargetTab }))
);
const RekapTab = lazy(() =>
  import('@/components/tahfidz/RekapTab').then((m) => ({ default: m.RekapTab }))
);

// =============================================================================
// TAB DEFINITION
// =============================================================================
type TabKey = 'setoran' | 'dashboard' | 'progress' | 'target' | 'rekap';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof BookOpen;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'setoran', label: 'Setoran', icon: BookMarked },
  { key: 'progress', label: 'Progress Siswa', icon: Users },
  { key: 'target', label: 'Target', icon: Target, managerOnly: true },
  { key: 'rekap', label: 'Rekap', icon: BarChart3, managerOnly: true },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

const TAB_IMPORTERS: Record<TabKey, () => Promise<any>> = {
  setoran: () => import('@/components/tahfidz/SetoranTab'),
  dashboard: () => import('@/components/tahfidz/DashboardTahfidzTab'),
  progress: () => import('@/components/tahfidz/ProgressSiswaTab'),
  target: () => import('@/components/tahfidz/TargetTab'),
  rekap: () => import('@/components/tahfidz/RekapTab'),
};

// =============================================================================
// COMPONENT
// =============================================================================
export function TahfidzPage() {
  const { guru } = useAuth();
  const isManager = isTahfidzManager(guru);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('setoran');

  // Fetch master surah sekali, share ke semua tab
  const [surahList, setSurahList] = useState<TahfidzSurah[]>([]);
  const [loadingSurah, setLoadingSurah] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tahfidz_surah')
        .select('*')
        .order('nomor', { ascending: true });
      setSurahList((data as TahfidzSurah[]) ?? []);
      setLoadingSurah(false);
    })();
  }, []);

  // Buat map untuk lookup O(1)
  const surahMap = useMemo(() => {
    const m = new Map<number, TahfidzSurah>();
    surahList.forEach((s) => m.set(s.nomor, s));
    return m;
  }, [surahList]);

  useEffect(() => {
    const currentTab = ALL_TABS.find((t) => t.key === activeTab);
    if (currentTab?.managerOnly && !isManager) setActiveTab('setoran');
  }, [isManager, activeTab]);

  usePrefetchTabs(TAB_IMPORTERS, activeTab);

  const tabProps = { surahList, surahMap, isManager };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
          <BookOpen size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Tahfidz Quran
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Program hafalan Al-Quran siswa · Setoran, murojaah, target, dan rekap
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
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {loadingSurah ? (
          <TabLoadingFallback label="Memuat data surah..." minHeight="300px" />
        ) : (
          <Suspense
            fallback={
              <TabLoadingFallback
                label={`Memuat ${visibleTabs.find((t) => t.key === activeTab)?.label ?? ''}...`}
                minHeight="500px"
              />
            }
          >
            {activeTab === 'setoran' && <SetoranTab {...tabProps} />}
            {activeTab === 'dashboard' && <DashboardTahfidzTab {...tabProps} />}
            {activeTab === 'progress' && <ProgressSiswaTab {...tabProps} />}
            {activeTab === 'target' && <TargetTab {...tabProps} />}
            {activeTab === 'rekap' && <RekapTab {...tabProps} />}
          </Suspense>
        )}
      </div>
    </div>
  );
}