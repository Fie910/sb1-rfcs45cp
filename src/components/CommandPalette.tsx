// src/components/CommandPalette.tsx
// Command Palette untuk navigasi cepat — Ctrl+K / Cmd+K.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, CornerDownLeft, ArrowUp, ArrowDown,
  Clock, Sparkles, Zap, Megaphone, FileText, CalendarCheck, PlusCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccessTahfidz } from '@/components/tahfidz/shared';
import { NAVIGATION_CONFIG, type PageKey } from '@/config/navigation';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// KONSTANTA
// =============================================================================
const RECENT_KEY = 'smk_recent_actions';
const MAX_RECENT = 5;

// =============================================================================
// TYPES
// =============================================================================
type ItemType = 'page' | 'action';

type CommandItem = {
  type: ItemType;
  key: string;
  label: string;
  group: string;
  icon: LucideIcon;
  path: string;
  state?: Record<string, any>; // untuk membuka modal, dll.
};

// =============================================================================
// QUICK ACTIONS DEFINITION
// =============================================================================
const QUICK_ACTIONS: CommandItem[] = [
  {
    type: 'action',
    key: 'act_pengumuman',
    label: 'Buat Pengumuman Baru',
    group: 'Aksi Cepat',
    icon: Megaphone,
    path: '/pengumuman',
    state: { openCreate: true },
  },
  {
    type: 'action',
    key: 'act_izin',
    label: 'Ajukan Izin & Delegasi',
    group: 'Aksi Cepat',
    icon: FileText,
    path: '/izin',
    state: { openCreate: true },
  },
  {
    type: 'action',
    key: 'act_rapat',
    label: 'Buat Jadwal Rapat Baru',
    group: 'Aksi Cepat',
    icon: CalendarCheck,
    path: '/rapat',
    state: { openCreate: true },
  },
];

// =============================================================================
// HELPER — Fuzzy Match
// =============================================================================
/**
 * Simple fuzzy match: Apakah huruf-huruf di `query` muncul berurutan di `text`?
 * Contoh: query "izn" -> text "Izin" = TRUE
 * query "pgnuman" -> text "Pengumuman" = TRUE
 */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  
  // 1. Fast path: substring exact (prioritas tertinggi)
  if (t.includes(q)) return true;
  
  // 2. Fuzzy: cocokkan huruf berurutan
  let qIdx = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) qIdx++;
  }
  return qIdx === q.length;
}

// =============================================================================
// HELPER — localStorage recent
// =============================================================================
function getRecentKeys(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentKey(key: string) {
  try {
    const cur = getRecentKeys().filter((k) => k !== key);
    const next = [key, ...cur].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// =============================================================================
// PROPS
// =============================================================================
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { hasAccess, guru } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentKeys, setRecentKeys] = useState<string[]>([]);

  // Build flat list of accessible items (Pages + Actions)
  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

    // 1. Tambahkan Quick Actions (selalu di atas)
    QUICK_ACTIONS.forEach((action) => {
      // Opsional: filter aksi berdasarkan akses (misal: hanya yang bisa akses /izin bisa melihat "Ajukan Izin")
      if (hasAccess(action.path.replace('/', '') as PageKey)) {
        items.push(action);
      }
    });

    // 2. Tambahkan Halaman Navigasi
    NAVIGATION_CONFIG.forEach((group) => {
      group.items.forEach((item) => {
        if (!hasAccess(item.key)) return;
        if (item.customAccess === 'tahfidz' && !canAccessTahfidz(guru)) return;
        items.push({
          type: 'page',
          key: item.key,
          label: item.label,
          group: group.groupTitle,
          icon: item.icon,
          path: item.path,
        });
      });
    });

    return items;
  }, [hasAccess, guru]);

  // Recent items (resolve + filter accessible)
  const recentItems: CommandItem[] = useMemo(() => {
    return recentKeys
      .map((k) => allItems.find((i) => i.key === k))
      .filter((x): x is CommandItem => Boolean(x))
      .slice(0, MAX_RECENT);
  }, [recentKeys, allItems]);

  // Filtered items (by query) — menggunakan FUZZY MATCH
  const filteredItems: CommandItem[] = useMemo(() => {
    const q = query.trim();
    if (!q) return allItems;
    return allItems.filter(
      (i) =>
        fuzzyMatch(q, i.label) ||
        fuzzyMatch(q, i.group)
    );
  }, [allItems, query]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filteredItems.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    });
    return Array.from(map.entries());
  }, [filteredItems]);

  // Reset state saat dibuka
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    setRecentKeys(getRecentKeys());
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Reset active index saat query berubah
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Lock body scroll saat open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Build flat ordered list: [recent] + [grouped non-recent]
  const flatItems: CommandItem[] = useMemo(() => {
    const showRecent = !query.trim() && recentItems.length > 0;
    if (!showRecent) return filteredItems;

    const recentKeySet = new Set(recentItems.map((r) => r.key));
    const rest = filteredItems.filter((i) => !recentKeySet.has(i.key));
    return [...recentItems, ...rest];
  }, [query, recentItems, filteredItems]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex, open]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleSelect = (item: CommandItem) => {
    saveRecentKey(item.key);
    // Navigasi dengan state jika ini adalah Quick Action (untuk buka modal)
    navigate(item.path, { state: item.state });
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatItems[activeIndex];
      if (target) handleSelect(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (!open) return null;

  const showRecent = !query.trim() && recentItems.length > 0;
  const recentKeySet = new Set(recentItems.map((r) => r.key));
  const hasAnyResult = flatItems.length > 0;

  let cursor = 0;

  return (
    <div
      className="fixed inset-0 z-[700] flex items-start justify-center p-4 pt-[8vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 shrink-0">
          <Search size={18} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari menu atau aksi... (ketik: izn, pgnuman, buat izin)"
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-500 hover:text-slate-300 transition cursor-pointer"
              title="Bersihkan"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            title="Tutup (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Result list */}
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar">
          {!hasAnyResult ? (
            <div className="py-12 text-center">
              <Sparkles size={28} className="mx-auto text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">
                Tidak ada menu cocok dengan "{query}"
              </p>
            </div>
          ) : (
            <>
              {/* RECENT SECTION */}
              {showRecent && (
                <div>
                  <SectionHeader
                    icon={<Clock size={11} className="text-slate-500" />}
                    label="Terakhir Dibuka"
                  />
                  {recentItems.map((item) => {
                    const idx = cursor++;
                    return (
                      <CommandRow
                        key={`recent-${item.key}`}
                        item={item}
                        active={activeIndex === idx}
                        index={idx}
                        onSelect={() => handleSelect(item)}
                        onHover={() => setActiveIndex(idx)}
                        isRecent
                      />
                    );
                  })}
                </div>
              )}

              {/* GROUPED SECTION */}
              {groupedItems.map(([group, items]) => {
                const visibleItems = showRecent
                  ? items.filter((i) => !recentKeySet.has(i.key))
                  : items;
                if (visibleItems.length === 0) return null;

                return (
                  <div key={group}>
                    <SectionHeader
                      label={group}
                      withBorder={showRecent || cursor > 0}
                    />
                    {visibleItems.map((item) => {
                      const idx = cursor++;
                      return (
                        <CommandRow
                          key={item.key}
                          item={item}
                          active={activeIndex === idx}
                          index={idx}
                          onSelect={() => handleSelect(item)}
                          onHover={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-800 bg-slate-950/50 text-[10px] text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Kbd>
                <ArrowUp size={9} />
              </Kbd>
              <Kbd>
                <ArrowDown size={9} />
              </Kbd>
              <span className="ml-1">Navigasi</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeft size={9} />
              </Kbd>
              <span className="ml-1">Pilih</span>
            </span>
          </div>
          <span className="font-mono">{flatItems.length} hasil</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[9px] inline-flex items-center justify-center min-w-[18px]">
      {children}
    </kbd>
  );
}

function SectionHeader({
  icon,
  label,
  withBorder = false,
}: {
  icon?: React.ReactNode;
  label: string;
  withBorder?: boolean;
}) {
  return (
    <div
      className={`px-4 pt-3 pb-1.5 flex items-center gap-2 ${
        withBorder ? 'border-t border-slate-800/60' : ''
      }`}
    >
      {icon}
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

interface RowProps {
  item: CommandItem;
  active: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
  isRecent?: boolean;
}

function CommandRow({ item, active, index, onSelect, onHover, isRecent }: RowProps) {
  const Icon = item.icon;
  const isAction = item.type === 'action';

  return (
    <button
      type="button"
      data-index={index}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer border-l-2 ${
        active
          ? 'bg-indigo-500/15 border-indigo-500'
          : 'border-transparent hover:bg-slate-800/40'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isAction
            ? active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-emerald-400/70'
            : active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
        }`}
      >
        {isAction ? <Zap size={14} /> : <Icon size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium truncate ${
            active ? 'text-indigo-100' : 'text-slate-200'
          }`}
        >
          {item.label}
        </p>
        <p className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
          {isRecent ? (
            'Terakhir dibuka'
          ) : isAction ? (
            <><span className="text-emerald-400/80 font-bold">Aksi</span> · {item.group}</>
          ) : (
            item.group
          )}
        </p>
      </div>
      {active && <CornerDownLeft size={12} className="text-indigo-400 shrink-0" />}
    </button>
  );
}