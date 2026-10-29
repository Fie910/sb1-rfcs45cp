// src/components/admin/PanelGenerateAgenda.tsx
import { useState } from 'react';
import { Play, Calendar, RefreshCw, AlertCircle, CheckCircle2, Info, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { getTodayDateWib } from '@/utils/date';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';

export function PanelGenerateAgenda() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [tanggal, setTanggal] = useState(getTodayDateWib());
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; time: string } | null>(null);

  const handleGenerate = async (useDate: boolean) => {
    const ok = await confirm({
      title: 'Konfirmasi Generate',
      message: `Jalankan fungsi generate agenda untuk ${useDate ? `tanggal ${tanggal}` : 'hari ini'}? Pastikan tanggal tersebut bukan hari libur.`,
      variant: 'warning',
      confirmLabel: 'Ya, Generate',
    });
    if (!ok) return;

    setLoading(true);
    setLastResult(null);

    try {
      // ✅ Panggil RPC Supabase
      // Jika useDate=false, kirim payload kosong agar PG menggunakan DEFAULT CURRENT_DATE
      const payload = useDate ? { target_date: tanggal } : {};
      const { error } = await supabase.rpc('generate_daily_alpa_agenda', payload);
      
      if (error) throw error;

      const now = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
      setLastResult({
        success: true,
        message: useDate ? `Generate berhasil untuk tanggal ${tanggal}` : 'Generate berhasil untuk hari ini',
        time: now,
      });
      
      showToast('success', 'Fungsi generate agenda berhasil dijalankan');
      
      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.PRESENSI ?? 'presensi',
        deskripsi: `Generate manual agenda alpa ${useDate ? `untuk tanggal ${tanggal}` : 'untuk hari ini'}`,
      });
    } catch (err: any) {
      console.error('[generate-agenda]', err);
      setLastResult({
        success: false,
        message: err.message || 'Gagal menjalankan fungsi',
        time: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
      });
      showToast('error', 'Gagal: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
          <Clock size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">Generate Agenda Alpa Otomatis</h3>
          <p className="text-xs text-slate-400 mt-0.5">Jalankan fungsi <code>generate_daily_alpa_agenda</code> secara manual</p>
        </div>
      </div>

      {/* Info Cron */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-2.5">
        <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Cron job berjalan otomatis setiap <b>Senin–Sabtu pukul 13:21 WIB</b>. 
          Gunakan tombol di bawah ini jika Anda perlu menjalankan fungsi secara manual (misal: generate ulang untuk tanggal yang terlewat).
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option 1: Hari Ini */}
        <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-200">Generate Hari Ini</p>
          <p className="text-[11px] text-slate-400">Menjalankan fungsi dengan parameter <code>DEFAULT CURRENT_DATE</code>.</p>
          <button
            onClick={() => handleGenerate(false)}
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            Generate Hari Ini
          </button>
        </div>

        {/* Option 2: Tanggal Spesifik */}
        <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-200">Generate Tanggal Spesifik</p>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-500" />
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => handleGenerate(true)}
            disabled={loading || !tanggal}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            Generate Tanggal Ini
          </button>
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
          lastResult.success 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          {lastResult.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
          <div>
            <p className="text-xs font-bold">{lastResult.message}</p>
            <p className="text-[10px] opacity-70 mt-0.5">Dieksekusi pukul {lastResult.time} WIB</p>
          </div>
        </div>
      )}
    </div>
  );
}