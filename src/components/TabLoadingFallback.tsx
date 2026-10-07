// src/components/TabLoadingFallback.tsx
// Reusable spinner untuk Suspense fallback di semua page dengan tab.

import { Loader2 } from 'lucide-react';

type Props = {
  label?: string;
  minHeight?: string;
};

export function TabLoadingFallback({
  label = 'Memuat...',
  minHeight = '400px',
}: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{ minHeight }}
    >
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

