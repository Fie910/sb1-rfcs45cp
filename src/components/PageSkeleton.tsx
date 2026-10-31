// src/components/PageSkeleton.tsx
// Skeleton loader yang menyerupai layout asli halaman.
// 4 varian: dashboard, list (default), grid, form.

import { motion } from 'motion/react';

type Variant = 'dashboard' | 'list' | 'grid' | 'form';

type Props = {
  variant?: Variant;
};

export function PageSkeleton({ variant = 'list' }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-5"
    >
      {/* ============= HEADER ============= */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl skeleton-block shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-6 w-48 max-w-full skeleton-block rounded-md" />
          <div className="h-3 w-64 max-w-full skeleton-block rounded" />
        </div>
      </div>

      {/* ============= DASHBOARD ============= */}
      {variant === 'dashboard' && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl skeleton-block shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-2 w-16 skeleton-block rounded" />
                  <div className="h-4 w-10 skeleton-block rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Grid shortcut */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-32 skeleton-block rounded" />
              <div className="h-7 w-16 skeleton-block rounded-lg" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-xl skeleton-block" />
                  <div className="h-2 w-12 skeleton-block rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Two panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="h-4 w-28 skeleton-block rounded" />
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg skeleton-block shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 skeleton-block rounded" />
                      <div className="h-2 w-1/2 skeleton-block rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============= LIST (default) ============= */}
      {variant === 'list' && (
        <>
          {/* Filter bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 skeleton-block rounded-xl" />
              ))}
            </div>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl skeleton-block shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="h-2 w-12 skeleton-block rounded" />
                  <div className="h-4 w-8 skeleton-block rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Table rows */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-slate-950/60 h-10" />
            {Array.from({ length: 7 }).map((_, i) => (
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
                <div className="hidden md:block h-3 w-16 skeleton-block rounded" />
                <div className="h-7 w-16 skeleton-block rounded-lg" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============= GRID ============= */}
      {variant === 'grid' && (
        <>
          {/* Tab bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex gap-1 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 h-10 skeleton-block rounded-xl min-w-[100px]"
              />
            ))}
          </div>

          {/* Grid cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
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
        </>
      )}

      {/* ============= FORM ============= */}
      {variant === 'form' && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 skeleton-block rounded" />
                <div className="h-11 w-full skeleton-block rounded-xl" />
              </div>
            ))}
            <div className="h-11 w-32 skeleton-block rounded-xl" />
          </div>
        </>
      )}
    </motion.div>
  );
}