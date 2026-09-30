import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export type SelectOption = {
  value: string | number;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  options: SelectOption[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

const DROPDOWN_MAX_HEIGHT = 320;
const GAP = 6;

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyMessage = 'Tidak ada hasil',
  disabled = false,
  clearable = true,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Hitung posisi dropdown relatif terhadap viewport (fixed positioning)
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;

    const shouldFlip = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: shouldFlip ? undefined : rect.bottom + GAP,
      bottom: shouldFlip ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: Math.min(
        DROPDOWN_MAX_HEIGHT,
        shouldFlip ? spaceAbove : spaceBelow
      ),
    });
  }, []);

  // Handler klik trigger — hitung posisi dulu, baru buka
  const handleTriggerClick = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    // Panggil updatePosition SEBELUM setOpen(true) agar React batch
    // keduanya menjadi satu render — dropdown sudah punya posisi sejak render pertama.
    updatePosition();
    setQuery('');
    setHighlightIndex(0);
    setOpen(true);
  };

  // Focus ke search input setelah dropdown render, tanpa memicu scroll halaman
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Update posisi saat scroll / resize
  useEffect(() => {
    if (!open) return;

    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      updatePosition();
    };

    const handleResize = () => updatePosition();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updatePosition]);

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(String(opt.value));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlightIndex];
      if (opt && !opt.disabled) handleSelect(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Guard: jangan render dropdown kalau posisinya belum siap
  // (mencegah flash render di posisi default yang memicu scroll halaman)
  const dropdown =
    open && dropdownStyle
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="z-[900] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Search */}
            <div className="relative border-b border-slate-800 p-2 shrink-0">
              <Search
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Options */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 text-center">
                  {emptyMessage}
                </div>
              ) : (
                filtered.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = idx === highlightIndex;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      disabled={opt.disabled}
                      className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                        opt.disabled
                          ? 'text-slate-600 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : isHighlighted
                          ? 'bg-slate-800/80 text-slate-200'
                          : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.hint && (
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {opt.hint}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-indigo-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer count */}
            {filtered.length > 0 && (
              <div className="border-t border-slate-800 px-3 py-1.5 text-[10px] text-slate-500 bg-slate-950/50 shrink-0">
                {filtered.length} dari {options.length} opsi
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        className={`w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-950 border text-sm transition-colors flex items-center justify-between gap-2 ${
          disabled
            ? 'border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
            : open
            ? 'border-indigo-500 ring-2 ring-indigo-500/30 text-slate-100 cursor-pointer'
            : 'border-slate-800 text-slate-100 hover:border-slate-700 cursor-pointer'
        }`}
      >
        <span className={`truncate ${selected ? 'text-slate-100' : 'text-slate-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && selected && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              title="Hapus pilihan"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {dropdown}
    </div>
  );
}