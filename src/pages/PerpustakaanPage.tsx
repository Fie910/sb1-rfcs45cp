// src/pages/PerpustakaanPage.tsx
// Container halaman Perpustakaan dengan tab navigation.

import { useState, useEffect, useMemo } from 'react';
import {
  Library, Book, Users, Send, Newspaper, BarChart3, Search,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isPustakawan } from '@/components/perpustakaan/shared';
import { BukuTab } from '@/components/perpustakaan/BukuTab';
import { AnggotaTab } from '@/components/perpustakaan/AnggotaTab';
import { PeminjamanTab } from '@/components/perpustakaan/PeminjamanTab';
import { SerialTab } from '@/components/perpustakaan/SerialTab';
import { OPACTab } from '@/components/perpustakaan/OPACTab';

function PlaceholderTab({
  title, description, icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Book;
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

type TabKey = 'buku' | 'anggota' | 'peminjaman' | 'serial' | 'dashboard' | 'opac';

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
  { key: 'opac', label: 'Pencarian Publik (OPAC)', icon: Search },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

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

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {activeTab === 'buku' && <BukuTab />}
        {activeTab === 'anggota' && <AnggotaTab />}
        {activeTab === 'peminjaman' && <PeminjamanTab />}
        {activeTab === 'serial' && <SerialTab />}
        {activeTab === 'opac' && <OPACTab />}
        {activeTab === 'dashboard' && (
          <PlaceholderTab
            icon={BarChart3}
            title="Dashboard Perpustakaan"
            description="Statistik literasi: buku terpopuler, siswa paling rajin, tren peminjaman bulanan."
          />
        )}
      </div>
    </div>
  );
}