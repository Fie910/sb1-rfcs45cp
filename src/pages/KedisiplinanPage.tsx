// src/pages/KedisiplinanPage.tsx
// Container halaman Kedisiplinan Siswa dengan tab navigation.

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert, AlertTriangle, Trophy, FileWarning,
  BarChart3, ClipboardList, Shield, Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isKedisiplinanManager } from '@/components/kedisiplinan/shared';
import { PelanggaranTab } from '@/components/kedisiplinan/PelanggaranTab';
import { PrestasiTab } from '@/components/kedisiplinan/PrestasiTab';
import { SuratPeringatanTab } from '@/components/kedisiplinan/SuratPeringatanTab';
import { RekapPoinTab } from '@/components/kedisiplinan/RekapPoinTab';
import { DashboardKedisiplinanTab } from '@/components/kedisiplinan/DashboardKedisiplinanTab';

// Placeholder sementara
function PlaceholderTab({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof ShieldAlert;
}) {
  return (
    <div className="text-center py-20 px-6 bg-slate-900 border border-slate-800 rounded-3xl">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto mb-4">
        <Icon size={28} />
      </div>
      <h3 className="text-lg font-bold text-slate-100 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
        Sedang dalam pengembangan
      </div>
    </div>
  );
}

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

          {/* TAB CONTENT */}
          <div className="min-h-[400px]">
            {activeTab === 'pelanggaran' && <PelanggaranTab />}
            {activeTab === 'prestasi' && <PrestasiTab />}
            {activeTab === 'sp' && <SuratPeringatanTab />}
            {activeTab === 'rekap' && <RekapPoinTab />}
            {activeTab === 'dashboard' && <DashboardKedisiplinanTab />}
          </div>
        </>
      )}
    </div>
  );
}