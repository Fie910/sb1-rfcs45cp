// src/components/SyncDetailModal.tsx
import { Modal } from '@/components/Modal';
import { 
  CloudUpload, CheckCircle2, RefreshCw, Database, 
  Clock, AlertTriangle, WifiOff 
} from 'lucide-react';
import { flushQueue } from '@/lib/offline/syncQueue';
import { showToast } from '@/components/Toast';
import type { PendingOp } from '@/lib/offline/db';

type Props = {
  open: boolean;
  onClose: () => void;
  online: boolean;
  pending: number;
  pendingOps: PendingOp[];
  flushing: boolean;
};

export function SyncDetailModal({ open, onClose, online, pending, pendingOps, flushing }: Props) {
  const handleSyncNow = async () => {
    if (!online) {
      showToast('error', 'Tidak dapat sinkronisasi saat offline.');
      return;
    }
    try {
      const res = await flushQueue();
      if (res.ok > 0) showToast('success', `${res.ok} data berhasil disinkronisasi`);
      if (res.fail > 0) showToast('error', `${res.fail} data gagal disinkronisasi`);
    } catch {
      showToast('error', 'Gagal sinkronisasi.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Status Sinkronisasi Data" size="md">
      <div className="space-y-4">
        {/* STATUS HEADER */}
        <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
          !online ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
          flushing ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
          pending > 0 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {!online ? <WifiOff size={26} /> :
           flushing ? <RefreshCw size={26} className="animate-spin" /> :
           pending > 0 ? <CloudUpload size={26} /> :
           <CheckCircle2 size={26} />}
          
          <div>
            <p className="font-extrabold text-sm">
              {!online ? 'Anda Sedang Offline' :
               flushing ? 'Menyinkronkan Data...' :
               pending > 0 ? `Menunggu Sinkronisasi` :
               'Semua Data Tersinkronisasi'}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
              {!online ? 'Data baru akan disimpan di perangkat dan dikirim saat koneksi kembali.' :
               pending > 0 ? `Ada ${pending} data di antrean. Jangan tutup aplikasi agar tidak hilang.` :
               'Tidak ada data yang tertunda. Aplikasi siap digunakan.'}
            </p>
          </div>
        </div>

        {/* PENDING LIST */}
        {pendingOps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Antrean Data</h4>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {pendingOps.map((op, idx) => (
                <div key={op.op_id ?? idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3 items-start shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <Database size={14} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {op.label ?? 'Data tanpa label'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {op.action.toUpperCase()}
                      </span>
                      <span className="font-mono text-slate-400 truncate">{op.table}</span>
                    </p>
                    {op.retries > 0 && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertTriangle size={10} /> {op.retries}x percobaan gagal
                      </p>
                    )}
                    {op.lastError && (
                      <p className="text-[9px] text-rose-400/70 mt-1 truncate" title={op.lastError}>
                        {op.lastError}
                      </p>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                    <Clock size={10} />
                    {new Date(op.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs transition cursor-pointer">
            Tutup
          </button>
          {pending > 0 && (
            <button 
              onClick={handleSyncNow} 
              disabled={!online || flushing}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 transition cursor-pointer"
            >
              {flushing ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
              {flushing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}