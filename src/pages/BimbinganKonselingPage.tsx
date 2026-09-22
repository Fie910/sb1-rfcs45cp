// src/pages/BimbinganKonselingPage.tsx
// Container halaman BK dengan tab navigation.
// Tab Dashboard & Profil Siswa hanya untuk BK manager.

import { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  BarChart3,
  MessageSquare,
  Users,
  UserCheck,
  ClipboardList,
  UserCircle,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isBkManager } from '@/components/bk/shared';
import { KonselingTab } from '@/components/bk/KonselingTab';

// Placeholder untuk tab yang belum dibuat
function PlaceholderTab({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Heart;
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

type TabKey =
  | 'konseling'
  | 'curhat'
  | 'rujukan'
  | 'asesmen'
  | 'profil'
  | 'dashboard';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof Heart;
  managerOnly?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'konseling', label: 'Konseling', icon: MessageSquare },
  { key: 'curhat', label: 'Kotak Curhat', icon: Heart },
  { key: 'rujukan', label: 'Rujukan Masalah', icon: UserCheck },
  { key: 'asesmen', label: 'Asesmen', icon: ClipboardList },
  { key: 'profil', label: 'Profil Siswa', icon: UserCircle, managerOnly: true },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, managerOnly: true },
];

export function BimbinganKonselingPage() {
  const { guru } = useAuth();
  const isManager = isBkManager(guru?.role);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.managerOnly || isManager),
    [isManager]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('konseling');

  // Guard: jika non-manager somehow punya tab manager-only, paksa ke konseling
  useEffect(() => {
    const currentTab = ALL_TABS.find((t) => t.key === activeTab);
    if (currentTab?.managerOnly && !isManager) {
      setActiveTab('konseling');
    }
  }, [isManager, activeTab]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-lg shadow-purple-500/10">
          <Heart size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Bimbingan & Konseling
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Layanan pendampingan siswa: pribadi, sosial, belajar, dan karier
          </p>
        </div>
      </div>

      {/* Guard: non-manager tidak boleh akses halaman sama sekali */}
      {!isManager ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 text-center space-y-3">
          <ShieldAlert size={40} className="mx-auto text-amber-400" />
          <h2 className="text-lg font-bold text-amber-300">Akses Terbatas</h2>
          <p className="text-xs text-amber-400/80 max-w-md mx-auto">
            Modul Bimbingan & Konseling hanya dapat diakses oleh Guru BK, Kepala
            Sekolah, Wakil Kepala, dan Admin.
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
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
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
            {activeTab === 'konseling' && <KonselingTab />}

            {activeTab === 'curhat' && (
              <PlaceholderTab
                icon={Heart}
                title="Kotak Curhat"
                description="Ruang aman bagi siswa untuk bercerita secara anonim atau terbuka. Guru BK akan merespons dengan penuh empati."
              />
            )}
            {activeTab === 'rujukan' && (
              <PlaceholderTab
                icon={UserCheck}
                title="Rujukan Masalah"
                description="Wali kelas, kesiswaan, atau guru mapel dapat merujuk siswa yang membutuhkan pendampingan BK."
              />
            )}
            {activeTab === 'asesmen' && (
              <PlaceholderTab
                icon={ClipboardList}
                title="Asesmen & Instrumen BK"
                description="Daftar Cek Masalah (DCM), tes minat bakat, dan instrumen asesmen lainnya untuk memetakan kebutuhan siswa."
              />
            )}
            {activeTab === 'profil' && (
              <PlaceholderTab
                icon={UserCircle}
                title="Profil Perkembangan Siswa"
                description="Timeline lengkap perjalanan siswa: konseling, rujukan, asesmen, dan catatan pendampingan lainnya."
              />
            )}
            {activeTab === 'dashboard' && (
              <PlaceholderTab
                icon={BarChart3}
                title="Dashboard BK"
                description="KPI layanan BK: jumlah kasus, rasio siswa-konselor, tren bulanan, dan waktu layanan langsung (ASCA standard)."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}