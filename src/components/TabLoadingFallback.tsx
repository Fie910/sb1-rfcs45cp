// src/components/TabLoadingFallback.tsx
// Reusable skeleton untuk Suspense fallback di semua page dengan tab.
// Kompatibel dengan signature lama (label + minHeight).

import { motion } from 'motion/react';

type Variant = 'list' | 'grid' | 'table';

type Props = {
  label?: string;
  minHeight?: string;
  variant?: Variant;
};

/**
 * Skeleton compact untuk tab internal.
 * Tidak punya padding / max-width sendiri — mengikuti container induk.
 */
export function TabLoadingFallback({
  label = 'Memuat...',
  minHeight = '400px',
  variant = 'list',
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      style={{ minHeight }}
      aria-label={label}
      aria-busy="true"
      role="status"
    >
      {variant === 'list' && <ListSkeleton />}
      {variant === 'grid' && <GridSkeleton />}
      {variant === 'table' && <TableSkeleton />}
    </motion.div>
  );
}

// ============================================================
// LIST — card rows (default, paling umum)
// ============================================================
function ListSkeleton() {
  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-xl skeleton-block" />
          ))}
        </div>
      </div>

      {/* Card rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl skeleton-block shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3 w-2/3 skeleton-block rounded" />
            <div className="h-2 w-1/3 skeleton-block rounded" />
          </div>
          <div className="hidden md:block h-3 w-20 skeleton-block rounded" />
          <div className="h-8 w-16 skeleton-block rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// GRID — card grid
// ============================================================
function GridSkeleton() {
  return (
    <div className="space-y-3">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-xl skeleton-block" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
          >
            <div className="aspect-[3/4] skeleton-block" />
            <div className="p-3 space-y-2">
              <div className="h-2 w-16 skeleton-block rounded" />
              <div className="h-3 w-full skeleton-block rounded" />
              <div className="h-3 w-2/3 skeleton-block rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TABLE — header + rows
// ============================================================
function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-xl skeleton-block" />
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="bg-slate-950/60 h-10" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-t border-slate-800/60"
          >
            <div className="w-9 h-9 rounded-lg skeleton-block shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-3 w-2/3 skeleton-block rounded" />
              <div className="h-2 w-1/3 skeleton-block rounded" />
            </div>
            <div className="hidden md:block h-3 w-20 skeleton-block rounded" />
            <div className="h-7 w-16 skeleton-block rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}