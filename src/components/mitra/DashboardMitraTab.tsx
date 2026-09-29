import { BarChart3 } from 'lucide-react';

export function DashboardMitraTab() {
  return (
    <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
      <BarChart3 size={44} className="mx-auto text-slate-600 mb-3" />
      <p className="text-sm font-bold text-slate-300">Tab Dashboard Mitra</p>
      <p className="text-xs text-slate-500 mt-1">Akan tersedia di Batch 8F</p>
    </div>
  );
}