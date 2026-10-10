//src/components/SyncStatusBadge.tsx

import { WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function SyncStatusBadge() {
  const { online, pending, flushing } = useSyncStatus();

  if (online && pending === 0 && !flushing) return null;

  let cls = 'bg-slate-900 border-slate-700 text-slate-200';
  let icon = <CloudOff size={14} />;
  let text = '';

  if (!online) {
    cls = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    icon = <WifiOff size={14} />;
    text = pending > 0 ? `Offline • ${pending} data menunggu` : 'Offline';
  } else if (flushing) {
    cls = 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300';
    icon = <RefreshCw size={14} className="animate-spin" />;
    text = `Mengirim ${pending} data...`;
  } else if (pending > 0) {
    cls = 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300';
    icon = <CloudOff size={14} />;
    text = `${pending} data menunggu dikirim`;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-bold ${cls}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}