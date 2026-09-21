// src/pages/InventarisSarprasPage.tsx
// Container halaman Inventaris Sarpras.
// Tab "Dashboard" hanya tampil untuk role manager (admin/kepala/wakil_kepala/sarpras).

import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Send,
  Wrench,
  Trash2,
  Home,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AsetTab } from '@/components/sarpras/AsetTab';
import { PeminjamanTab } from '@/components/sarpras/PeminjamanTab';
import { PemeliharaanTab } from '@/components/sarpras/PemeliharaanTab';
import { PenghapusanTab } from '@/components/sarpras/PenghapusanTab';
import { DashboardSarprasTab } from '@/components/sarpras/DashboardSarprasTab';
import { isSarprasManager } from '@/components/sarpras/shared';

type TabKey = 'dashboard' | 'aset' | 'peminjaman' | 'pemeliharaan' | 'penghapusan';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof Package;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
  { key: 'aset', label: 'Aset Inventaris', icon: Package },
  { key: 'peminjaman', label: 'Peminjaman', icon: Send },
  { key: 'pemeliharaan', label: 'Pemeliharaan', icon: Wrench },
  { key: 'penghapusan', label: 'Penghapusan', icon: Trash2 },
];

export function InventarisSarprasPage() {
  const { guru } = useAuth();
  const isManager = isSarprasManager(guru?.role);

  // Filter tabs berdasarkan role
  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  // Default tab: Dashboard untuk manager, Aset untuk guru biasa
  const [activeTab, setActiveTab] = useState<TabKey>(isManager ? 'dashboard' : 'aset');

  // Guard: jika non-manager somehow mendapat activeTab = 'dashboard',
  // paksa kembali ke 'aset'
  useEffect(() => {
    if (!isManager && activeTab === 'dashboard') {
      setActiveTab('aset');
    }
  }, [isManager, activeTab]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <Home size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Sarana & Prasarana
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manajemen aset, peminjaman, pemeliharaan, dan penghapusan
          </p>
        </div>
      </div>

      {/* TAB NAVIGATION — DINAMIS SESUAI ROLE */}
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
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
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
        {activeTab === 'dashboard' && isManager && <DashboardSarprasTab />}
        {activeTab === 'aset' && <AsetTab />}
        {activeTab === 'peminjaman' && <PeminjamanTab />}
        {activeTab === 'pemeliharaan' && <PemeliharaanTab />}
        {activeTab === 'penghapusan' && <PenghapusanTab />}
      </div>
    </div>
  );
}