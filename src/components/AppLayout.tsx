// src/components/AppLayout.tsx
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { LogOut, Menu, X, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { CommandPalette } from '@/components/CommandPalette';
import type { PageKey } from '@/config/navigation';
import VerifikasiArsipPage from '@/pages/VerifikasiArsipPage';
import { InstallPWA } from '@/components/InstallPWA';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';

type LayoutProps = {
  current: PageKey;
  onNavigate?: (page: PageKey) => void;
  badgeCounts?: Partial<Record<PageKey, number>>;
  children: ReactNode;
};

export function AppLayout({ current, badgeCounts, children }: LayoutProps) {
  const { guru, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Ambil ID guru yang sedang login untuk komponen lonceng
  const guruId = guru?.id || '';

  // Deteksi platform untuk label shortcut
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const platform =
      (navigator as any).userAgentData?.platform ?? navigator.platform ?? '';
    return /Mac|iPhone|iPad/.test(platform);
  }, []);
  const modKeyLabel = isMac ? '⌘' : 'Ctrl';

  // ==========================================================================
  // Global keyboard shortcut
  // - Ctrl+K / Cmd+K → toggle command palette
  // - "/" (kalau tidak di input/textarea) → buka command palette
  // ==========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }

      // "/" shortcut — only when NOT typing in input/textarea
      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        const el = document.activeElement;
        const tag = el?.tagName;
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          (el as HTMLElement)?.isContentEditable === true;
        if (!isEditable) {
          e.preventDefault();
          setCommandOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans text-slate-300 selection:bg-indigo-500/30">
      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <Sidebar
        current={current}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        badgeCounts={badgeCounts}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header / Topbar Utama */}
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Sisi Kiri: Tombol Menu (Mobile) & Judul */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors lg:hidden shrink-0"
              aria-label="Buka Menu"
            >
              <Menu size={22} />
            </button>

            <span className="font-extrabold text-slate-100 text-sm tracking-tight truncate lg:hidden">
              SMK KH. A. WAHAB MUHSIN
            </span>

            {/* Desktop: Quick Search Trigger */}
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-all cursor-pointer group w-full max-w-md"
              title={`Cari menu (${modKeyLabel}+K)`}
            >
              <Search size={14} className="shrink-0" />
              <span className="text-xs flex-1 text-left">
                Cari menu atau fitur...
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-500 group-hover:text-slate-300 group-hover:border-indigo-500/40 transition-colors">
                {modKeyLabel}+K
              </kbd>
            </button>
          </div>

          {/* Sisi Kanan: Search (mobile), Lonceng Notifikasi & Tombol Logout Mobile */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {/* Mobile: Search Icon */}
            <button
              onClick={() => setCommandOpen(true)}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors lg:hidden"
              title="Cari menu"
              aria-label="Cari menu"
            >
              <Search size={20} />
            </button>

            {/* Lonceng Notifikasi */}
            {guruId && <NotificationBell guruId={guruId} />}

            {/* Tombol Logout Khusus Mobile */}
            <button
              onClick={signOut}
              className="p-2 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors lg:hidden"
              title="Keluar"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Tombol Tutup Sidebar Mobile */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed top-4 right-4 z-50 lg:hidden p-2 bg-slate-800 text-slate-300 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
        >
          <X size={20} />
        </button>
      )}

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      {/* Install PWA Banner (muncul otomatis di bottom-right) */}
      <InstallPWA />
    </div>
  );
}