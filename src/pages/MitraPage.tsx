// src/pages/MitraPage.tsx
// Halaman utama Modul Mitra DUDI & MoU dengan 4 tab.

import { useState, useMemo } from 'react';
import { Building2, FileSignature, History, BarChart3, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isMitraManager } from '@/components/mitra/shared';
import { DatabaseMitraTab } from '@/components/mitra/DatabaseMitraTab';
import { MouKerjasamaTab } from '@/components/mitra/MouKerjasamaTab';
import { RiwayatKerjasamaTab } from '@/components/mitra/RiwayatKerjasamaTab';
import { DashboardMitraTab } from '@/components/mitra/DashboardMitraTab';

type TabKey = 'mitra' | 'mou' | 'riwayat' | 'dashboard';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof Building2;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'mitra', label: 'Database Mitra', icon: Building2 },
  { key: 'mou', label: 'MoU & Kerjasama', icon: FileSignature },
  { key: 'riwayat', label: 'Riwayat Kerjasama', icon: History },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

export function MitraPage() {
  const { guru } = useAuth();
  const isManager = isMitraManager(guru?.role);
  
  // ✅ Auto-cek reminder MoU (throttle 30 menit)
  useEffect(() => {
    if (!isManager) return;
    let mounted = true;

    (async () => {
      const sent = await checkMouRemindersThrottled();
      if (mounted && sent > 0) {
        showToast('info', `${sent} reminder MoU terkirim`);
      }
    })();

    return () => { mounted = false; };
  }, [isManager]);
  
  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('mitra');
  const effectiveTab = visibleTabs.find((t) => t.key === activeTab)?.key ?? 'mitra';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <Users size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Mitra DUDI & MoU
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Database mitra industri, kerjasama, dan tracking MoU
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
        {effectiveTab === 'mitra' && <DatabaseMitraTab />}
        {effectiveTab === 'mou' && <MouKerjasamaTab />}
        {effectiveTab === 'riwayat' && <RiwayatKerjasamaTab />}
        {effectiveTab === 'dashboard' && isManager && <DashboardMitraTab />}
      </div>
    </div>
  );
}