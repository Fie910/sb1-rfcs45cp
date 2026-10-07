// src/pages/RapatPage.tsx
// Halaman utama Modul Rapat & Notulensi dengan 3 tab.

import { useState, useMemo } from 'react';
import {
  CalendarCheck, ClipboardList, BarChart3, Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { JadwalRapatTab } from '@/components/rapat/JadwalRapatTab';
import { NotulensiSayaTab } from '@/components/rapat/NotulensiSayaTab';
import { ManajemenRapatTab } from '@/components/rapat/ManajemenRapatTab';
import { isRapatManager, useAutoCloseRapat } from '@/components/rapat/shared';
import { showToast } from '@/components/Toast';

type TabKey = 'jadwal' | 'notulensi' | 'manajemen';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof CalendarCheck;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'jadwal', label: 'Jadwal Rapat', icon: CalendarCheck },
  { key: 'notulensi', label: 'Notulensi Saya', icon: ClipboardList },
  { key: 'manajemen', label: 'Manajemen Rapat', icon: BarChart3, managerOnly: true },
];

export function RapatPage() {
  const { guru } = useAuth();
  const isManager = isRapatManager(guru);

  // ✅ Auto-close rapat menggantung > 7 hari (trigger sekali saat mount)
  useAutoCloseRapat((count) => {
    if (count > 0) {
      showToast('info', `${count} rapat menggantung di-close otomatis`);
    }
  });

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('jadwal');
  const effectiveTab = visibleTabs.find((t) => t.key === activeTab)?.key ?? 'jadwal';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <Users size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Rapat & Notulensi
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Jadwal rapat, notulensi dengan AI, dan action item tracker
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
        {effectiveTab === 'jadwal' && <JadwalRapatTab />}
        {effectiveTab === 'notulensi' && <NotulensiSayaTab />}
        {effectiveTab === 'manajemen' && <ManajemenRapatTab />}
      </div>
    </div>
  );
}