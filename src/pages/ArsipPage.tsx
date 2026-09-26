// src/pages/ArsipPage.tsx
// Halaman utama Modul Arsip Digital dengan 4 tab.

import { useState, useMemo } from 'react';
import {
  FolderArchive, Eye, FolderTree, BarChart3, Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isArsipManager, canManageKategori } from '@/components/arsip/shared';
import { DaftarArsipTab } from '@/components/arsip/DaftarArsipTab';
import { WajibBacaTab } from '@/components/arsip/WajibBacaTab';
import { KelolaKategoriTab } from '@/components/arsip/KelolaKategoriTab';
import { DashboardArsipTab } from '@/components/arsip/DashboardArsipTab';

type TabKey = 'daftar' | 'wajib_baca' | 'kategori' | 'dashboard';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof FolderArchive;
  managerOnly?: boolean;
  kategoriOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'daftar', label: 'Daftar Arsip', icon: FolderArchive },
  { key: 'wajib_baca', label: 'Wajib Baca', icon: Eye },
  { key: 'kategori', label: 'Kelola Kategori', icon: FolderTree, kategoriOnly: true },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

export function ArsipPage() {
  const { guru } = useAuth();
  const isManager = isArsipManager(guru?.role);
  const canKategori = canManageKategori(guru?.role);

  const visibleTabs = useMemo(
    () =>
      ALL_TABS.filter((t) => {
        if (t.managerOnly && !isManager) return false;
        if (t.kategoriOnly && !canKategori) return false;
        return true;
      }),
    [isManager, canKategori]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('daftar');
  const effectiveTab = visibleTabs.find((t) => t.key === activeTab)?.key ?? 'daftar';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <FolderArchive size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Arsip Digital
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manajemen dokumen sekolah dengan versioning, tracking, & retensi otomatis
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
        {effectiveTab === 'daftar' && <DaftarArsipTab />}
        {effectiveTab === 'wajib_baca' && <WajibBacaTab />}
        {effectiveTab === 'kategori' && canKategori && <KelolaKategoriTab />}
        {effectiveTab === 'dashboard' && isManager && <DashboardArsipTab />}
      </div>
    </div>
  );
}