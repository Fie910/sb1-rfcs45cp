// src/components/Skeleton.tsx
// Skeleton loader untuk premium loading experience.

/** Satu baris skeleton dengan lebar acak agar terasa natural */
export function SkeletonLine({ width = '100%', className = '' }: {
  width?: string;
  className?: string;
}) {
  return (
    <div
      className={`h-3 bg-slate-800/80 rounded-full animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

/** Kartu skeleton (untuk list/carousel) */
export function SkeletonCard({ lines = 3, className = '' }: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800/80 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="70%" />
          <SkeletonLine width="40%" />
        </div>
      </div>
      <div className="space-y-2 pt-1">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? '60%' : '100%'}
          />
        ))}
      </div>
    </div>
  );
}

/** Stat card skeleton (untuk KPI boxes) */
export function SkeletonStatCard() {
  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-800/80 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine width="60%" />
        <SkeletonLine width="30%" />
      </div>
    </div>
  );
}

/** Baris tabel skeleton */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <SkeletonLine width={`${60 + (i * 13) % 30}%`} />
        </td>
      ))}
    </tr>
  );
}

/** Grid skeleton untuk 4 stat cards */
export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}