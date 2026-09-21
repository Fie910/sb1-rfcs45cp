// src/pages/InventarisSarprasPage.tsx
// Container halaman Inventaris Sarpras dengan 4 tab aktif.

import { useState } from 'react';
import { Package, Send, Wrench, Trash2, Home } from 'lucide-react';
import { AsetTab } from '@/components/sarpras/AsetTab';
import { PeminjamanTab } from '@/components/sarpras/PeminjamanTab';
import { PemeliharaanTab } from '@/components/sarpras/PemeliharaanTab';
import { PenghapusanTab } from '@/components/sarpras/PenghapusanTab';

type TabKey = 'aset' | 'peminjaman' | 'pemeliharaan' | 'penghapusan';

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: 'aset', label: 'Aset Inventaris', icon: Package },
  { key: 'peminjaman', label: 'Peminjaman', icon: Send },
  { key: 'pemeliharaan', label: 'Pemeliharaan', icon: Wrench },
  { key: 'penghapusan', label: 'Penghapusan', icon: Trash2 },
];

export function InventarisSarprasPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('aset');

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

      {/* TAB NAVIGATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
        {activeTab === 'aset' && <AsetTab />}
        {activeTab === 'peminjaman' && <PeminjamanTab />}
        {activeTab === 'pemeliharaan' && <PemeliharaanTab />}
        {activeTab === 'penghapusan' && <PenghapusanTab />}
      </div>
    </div>
  );
}