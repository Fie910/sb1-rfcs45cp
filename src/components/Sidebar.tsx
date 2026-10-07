// src/components/Sidebar.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NAVIGATION_CONFIG, type PageKey } from '@/config/navigation';
import { canAccessTahfidz } from '@/components/tahfidz/shared';

// =============================================================================
// KONSTANTA
// =============================================================================
const STORAGE_KEY = 'smk_sidebar_collapsed_groups';

// =============================================================================
// PROPS
// =============================================================================
interface SidebarProps {
  current: PageKey;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  badgeCounts?: Partial<Record<PageKey, number>>;
}

// =============================================================================
// HELPER — Role badge style
// =============================================================================
const getRoleBadgeStyle = (roleStr: string): string => {
  const customStyles: Record<string, string> = {
    admin: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    guru: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
    guru_piket: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
  };
  return (
    customStyles[roleStr] || 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
  );
};

// =============================================================================
// HELPER — Load & save state collapse
// =============================================================================
function loadCollapsedState(current: PageKey): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    /* ignore */
  }

  // First visit — collapse semua kecuali grup yang mengandung halaman aktif
  const activeGroup = NAVIGATION_CONFIG.find((g) =>
    g.items.some((i) => i.key === current)
  );
  return new Set(
    NAVIGATION_CONFIG
      .filter((g) => g.groupTitle !== activeGroup?.groupTitle)
      .map((g) => g.groupTitle)
  );
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function Sidebar({ current, sidebarOpen, setSidebarOpen, badgeCounts }: SidebarProps) {
  const { guru, role, namaRole, signOut, hasAccess } = useAuth();

  // State collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    loadCollapsedState(current)
  );

  // Persist ke localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(collapsedGroups))
      );
    } catch {
      /* ignore */
    }
  }, [collapsedGroups]);

  // Auto-expand grup yang mengandung halaman aktif
  useEffect(() => {
    const activeGroup = NAVIGATION_CONFIG.find((g) =>
      g.items.some((i) => i.key === current)
    );
    if (!activeGroup) return;

    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup.groupTitle)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup.groupTitle);
      return next;
    });
  }, [current]);

  // ==========================================================================
  // Visible groups (filter akses)
  // ==========================================================================
const visibleGroups = useMemo(() => {
  return NAVIGATION_CONFIG
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        // 1. Cek hak akses (existing)
        if (!hasAccess(item.key)) return false;

        // 2. Cek customAccess — tahfidz hanya untuk guru tahfidz
        if (item.customAccess === 'tahfidz' && !canAccessTahfidz(guru)) {
          return false;
        }

        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}, [hasAccess, guru]);   // ← tambah `guru` ke deps

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedGroups(new Set(visibleGroups.map((g) => g.groupTitle)));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  const allCollapsed =
    visibleGroups.length > 0 &&
    visibleGroups.every((g) => collapsedGroups.has(g.groupTitle));

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 h-screen h-dvh w-72 bg-slate-900 border-r border-slate-800 z-40 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* HEADER */}
      <div className="px-6 py-6 flex items-center gap-3.5 border-b border-slate-800">
        <div className="w-11 h-11 bg-indigo-500/15 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-bold text-xl shadow-sm">
          WM
        </div>
        <div className="min-w-0">
          <h1 className="text-slate-100 font-extrabold text-[13px] tracking-tight leading-snug">
            SMK KH. A. WAHAB
            <br /> MUHSIN
          </h1>
          <p className="text-slate-500 text-[11px] font-medium mt-0.5 uppercase tracking-wider">
            SISFO Pemuliaan Murid
          </p>
        </div>
      </div>

      {/* QUICK ACTION BAR */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-800/60">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Menu
        </span>
        <button
          onClick={allCollapsed ? expandAll : collapseAll}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 px-2 py-1 rounded-md hover:bg-slate-800/60 transition-colors cursor-pointer"
          title={allCollapsed ? 'Buka semua grup' : 'Tutup semua grup'}
        >
          <ChevronsUpDown size={11} />
          {allCollapsed ? 'Buka Semua' : 'Tutup Semua'}
        </button>
      </div>

      {/* NAVIGASI */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
        {visibleGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.groupTitle);

          // Aggregate badge count (hanya hitung dari item yang visible)
          const aggregateBadge = group.items.reduce(
            (sum, item) => sum + (badgeCounts?.[item.key] ?? 0),
            0
          );

          return (
            <div key={group.groupTitle}>
              {/* GROUP HEADER — clickable toggle */}
              <button
                type="button"
                onClick={() => toggleGroup(group.groupTitle)}
                aria-expanded={!isCollapsed}
                className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/40 transition-colors group/header cursor-pointer"
              >
                <ChevronRight
                  size={12}
                  className={`text-slate-600 shrink-0 transition-transform duration-200 group-hover/header:text-slate-400 ${
                    !isCollapsed ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex-1 text-left group-hover/header:text-slate-400 transition-colors truncate">
                  {group.groupTitle}
                </span>

                {/* Item count — hanya tampil saat collapsed */}
                {isCollapsed && (
                  <span className="text-[10px] font-mono text-slate-600 shrink-0">
                    {group.items.length}
                  </span>
                )}

                {/* Aggregate badge — hanya tampil saat collapsed */}
                {isCollapsed && aggregateBadge > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-sm shrink-0">
                    {aggregateBadge > 99 ? '99+' : aggregateBadge}
                  </span>
                )}
              </button>

              {/* GROUP ITEMS */}
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5 pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = current === item.key;
                    const count = badgeCounts?.[item.key] ?? 0;

                    return (
                      <Link
                        key={item.key}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${
                          active
                            ? 'bg-indigo-500/15 text-indigo-300 font-semibold shadow-sm border border-indigo-500/10'
                            : 'text-slate-400 font-medium hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Icon
                            size={17}
                            strokeWidth={active ? 2.5 : 2}
                            className={active ? 'text-indigo-400' : 'text-slate-500'}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {/* Lencana Notifikasi */}
                        {count > 0 && (
                          <span
                            className={`ml-2 px-2 py-0.5 text-[11px] font-bold rounded-full transition-all shrink-0 ${
                              active
                                ? 'bg-indigo-500 text-white'
                                : 'bg-rose-500 text-white animate-pulse'
                            }`}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER (Profil & Logout) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 shadow-sm mb-3">
          <p className="text-sm font-semibold text-slate-200 truncate">
            {guru?.nama_lengkap ?? 'Guru'}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{guru?.email}</p>
          <div className="flex items-center gap-2 mt-3">
            {role && (
              <span
                className={`text-[10px] tracking-wide font-bold px-2 py-1 rounded-md ${getRoleBadgeStyle(
                  role
                )}`}
              >
                {namaRole || role}
              </span>
            )}
            {guru?.mata_pelajaran && (
              <span
                className="text-xs text-slate-500 truncate max-w-[100px] font-medium"
                title={guru.mata_pelajaran}
              >
                {guru.mata_pelajaran}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}