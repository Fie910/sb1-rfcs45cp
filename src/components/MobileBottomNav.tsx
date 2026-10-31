// src/components/MobileBottomNav.tsx
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Settings, Check, RotateCcw, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useMemo,
  useState,
  useRef,
  useCallback,
  type MouseEvent,
} from 'react';
import { useBottomNavTabs, MAX_TABS } from '@/hooks/useBottomNavTabs';
import { PAGE_CONFIG } from '@/components/dashboard/ShortcutGrid';
import { canAccessTahfidz } from '@/components/tahfidz/shared';
import type { PageKey } from '@/config/navigation';

type TabItem = {
  path: string;
  icon: any;
  label: string;       // shortLabel — untuk tampilan bottom nav (ringkas)
  fullLabel?: string;  // label lengkap — untuk panel pengaturan
  accessKey?: PageKey;
  isProfile?: boolean; // profile selalu tampil tanpa cek RBAC
};

/**
 * Tab "Beranda" — tidak ada di PAGE_CONFIG ShortcutGrid,
 * jadi kita tambahkan manual di sini.
 */
const HOME_TAB: TabItem = {
  path: '/',
  icon: LayoutDashboard,
  label: 'Beranda',
  fullLabel: 'Dashboard / Beranda',
};

/**
 * Katalog lengkap tab — sumbernya dari PAGE_CONFIG ShortcutGrid.
 * Ikon, label, dan path otomatis sinkron dengan shortcut grid.
 */
const TAB_CATALOG: TabItem[] = [
  HOME_TAB,
  ...Object.entries(PAGE_CONFIG).map(([key, cfg]) => ({
    path: cfg.path,
    icon: cfg.icon,
    label: cfg.shortLabel,
    fullLabel: cfg.label,
    accessKey: key as PageKey,
    isProfile: key === 'profile',
  })),
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { hasAccess, guru } = useAuth();
  const { paths, setPaths, reset } = useBottomNavTabs();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- Filter tab sesuai hak akses (RBAC + custom Tahfidz) ----
  const availableTabs = useMemo(
    () =>
      TAB_CATALOG.filter((t) => {
        if (!t.accessKey) return true;          // Beranda — selalu tampil
        if (t.isProfile) return true;           // Profil — selalu tampil
        if (t.accessKey === 'tahfidz' && !canAccessTahfidz(guru)) return false;
        return hasAccess(t.accessKey);
      }),
    [hasAccess, guru],
  );

  // ---- Tab aktif (urut sesuai pilihan user) ----
  const activeTabs = useMemo(
    () =>
      paths
        .map((p) => availableTabs.find((t) => t.path === p))
        .filter((t): t is TabItem => Boolean(t)),
    [paths, availableTabs],
  );

  // ---- Long-press untuk buka panel pengaturan ----
  const longPressTimer = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const startLongPress = useCallback(() => {
    longPressedRef.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setSettingsOpen(true);
    }, 550);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTabClick = (e: MouseEvent) => {
    if (longPressedRef.current) {
      e.preventDefault();
      longPressedRef.current = false;
    }
  };

  // ---- Toggle tab di panel pengaturan ----
  const togglePath = (path: string) => {
    if (paths.includes(path)) {
      if (paths.length <= 1) return; // minimal 1 tab
      setPaths(paths.filter((p) => p !== path));
    } else {
      if (paths.length >= MAX_TABS) return;
      setPaths([...paths, path]);
    }
  };

  return (
    <>
      {/* ====================== BOTTOM NAV ====================== */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden
                   bg-slate-900/70 backdrop-blur-2xl saturate-150
                   border-t border-slate-800/80
                   pb-[env(safe-area-inset-bottom)]
                   shadow-[0_-1px_0_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex items-center justify-around h-16">
          {activeTabs.map((tab) => {
            const active =
              pathname === tab.path ||
              (tab.path === '/' && pathname === '/dashboard');
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={handleTabClick}
                onPointerDown={startLongPress}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                className="relative flex flex-col items-center justify-center gap-0.5 px-2 py-2 flex-1 min-w-0 select-none"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-1 rounded-2xl bg-indigo-500/15"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  size={22}
                  className={`relative z-10 transition-colors ${
                    active ? 'text-indigo-400' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`relative z-10 text-[10px] font-medium transition-colors truncate ${
                    active ? 'text-indigo-400' : 'text-slate-500'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* Gear kecil untuk buka panel pengaturan */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="shrink-0 w-8 h-8 mx-1 rounded-lg flex items-center justify-center text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
            aria-label="Atur menu bawah"
            title="Atur menu bawah"
          >
            <Settings size={14} />
          </button>
        </div>
      </nav>

      {/* ====================== PANEL PENGATURAN ====================== */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={() => setSettingsOpen(false)}
            className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center lg:hidden"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-100">
                  Atur Menu Bawah
                </h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  aria-label="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Pilih maksimal {MAX_TABS} menu yang sering Anda akses.{' '}
                <span className="text-slate-400 font-medium">
                  ({paths.length}/{MAX_TABS} dipilih)
                </span>
              </p>

              {/* Daftar pilihan */}
              <div className="space-y-1.5">
                {availableTabs.map((tab) => {
                  const selected = paths.includes(tab.path);
                  const disabled = !selected && paths.length >= MAX_TABS;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.path}
                      onClick={() => togglePath(tab.path)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                        selected
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-slate-100'
                          : disabled
                          ? 'bg-slate-950/30 border-slate-800/50 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <Icon
                        size={18}
                        className={selected ? 'text-indigo-400' : ''}
                      />
                      <span className="flex-1 text-sm">
                        {tab.fullLabel ?? tab.label}
                      </span>
                      {selected && (
                        <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                          <Check
                            size={12}
                            className="text-white"
                            strokeWidth={3}
                          />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tombol aksi */}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
                >
                  <RotateCcw size={14} />
                  Default
                </button>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
                >
                  Selesai
                </button>
              </div>

              <p className="text-[10px] text-slate-600 text-center mt-3 leading-relaxed">
                💡 Tips: tekan lama salah satu tab untuk membuka panel ini kapan saja
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}