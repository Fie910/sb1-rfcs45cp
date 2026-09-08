// StatCard.tsx
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  ring: string;
  accent: string;
}

export function StatCard({ label, value, icon: Icon, color, bg, ring, accent }: StatCardProps) {
  return (
    <div className={`relative overflow-hidden ${bg} rounded-2xl p-3.5 border border-slate-800/80 shadow-sm flex items-center gap-3`}>
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${accent}`} />
      <div className={`w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 ring-1 ${ring}`}>
        <Icon className={color} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm sm:text-base font-black ${color} truncate`}>{value}</p>
        <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}
