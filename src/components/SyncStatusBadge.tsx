// src/components/SyncStatusBadge.tsx
import { useState } from 'react';
import { WifiOff, RefreshCw, CloudUpload } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { SyncDetailModal } from './SyncDetailModal';

export function SyncStatusBadge() {
  const { online, pending, pendingOps, flushing } = useSyncStatus();
  const [modalOpen, setModalOpen] = useState(false);

  // Sembunyikan badge jika semua data sudah sinkron dan tidak ada proses
  if (online && pending === 0 && !flushing) return null;

  let cls = 'bg-slate-900/90 border-slate-700 text-slate-200';
  let icon = <CloudUpload size={16} />;
  let text = '';

  if (!online) {
    cls = 'bg-amber-950/90 border-amber-500/50 text-amber-400 shadow-amber-900/20';
    icon = <WifiOff size={16} />;
    text = pending > 0 ? `Offline • ${pending} antrean` : 'Mode Offline';
  } else if (flushing) {
    cls = 'bg-indigo-950/90 border-indigo-500/50 text-indigo-400 shadow-indigo-900/20';
    icon = <RefreshCw size={16} className="animate-spin" />;
    text = `Mengirim ${pending} data...`;
  } else if (pending > 0) {
    cls = 'bg-indigo-950/90 border-indigo-500/50 text-indigo-400 shadow-indigo-900/20';
    icon = <CloudUpload size={16} className="animate-pulse" />;
    text = `${pending} data menunggu`;
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-2xl backdrop-blur-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${cls}`}
      >
        {icon}
        <span>{text}</span>
      </button>

      <SyncDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        online={online}
        pending={pending}
        pendingOps={pendingOps}
        flushing={flushing}
      />
    </>
  );
}