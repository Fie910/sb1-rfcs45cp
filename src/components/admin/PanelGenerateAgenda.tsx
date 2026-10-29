// src/components/admin/PanelGenerateAgenda.tsx
import { useState, useEffect, useCallback } from 'react';
import { Play, Calendar, RefreshCw, AlertCircle, CheckCircle2, Info, Clock, Power } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { getTodayDateWib } from '@/utils/date';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';

export function PanelGenerateAgenda() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [tanggal, setTanggal] = useState(getTodayDateWib());
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; time: string } | null>(null);
  
  // State untuk Toggle Cron
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronSchedule, setCronSchedule] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  // ==========================================================================
  // 1. Fetch Status Cron saat halaman dibuka
  // ==========================================================================
  const fetchCronStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase.rpc('get_auto_generate_status');
      if (error) throw error;
      
      if (data) {
        setCronEnabled(data.enabled);
        setCronSchedule(data.schedule);
      }
    } catch (err: any) {
      console.warn('[cron-status]', err);
      // Jangan tampilkan toast error agar tidak mengganggu UX
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchCronStatus();
  }, [fetchCronStatus]);

  // ==========================================================================
  // 2. Handler Toggle Cron
  // ==========================================================================
  const handleToggleCron = async () => {
    const newState = !cronEnabled;
    
    const ok = await confirm({
      title: newState ? 'Aktifkan Auto-Generate?' : 'Matikan Auto-Generate?',
      message: newState 
        ? 'Fungsi akan berjalan otomatis setiap Senin–Sabtu pukul 13:30 WIB untuk menandai guru yang tidak mengisi presensi.'
        : 'Fungsi cron akan dihentikan. Guru yang tidak mengisi presensi TIDAK akan otomatis ditandai Alpa sampai Anda mengaktifkannya kembali.',
      variant: newState ? 'default' : 'warning',
      confirmLabel: newState ? 'Ya, Aktifkan' : 'Ya, Matikan',
    });
    if (!ok) return;

    setToggling(true);
    try {
      const { data, error } = await supabase.rpc('toggle_auto_generate_agenda', {
        p_enabled: newState,
      });
      if (error) throw error;

      setCronEnabled(data.enabled);
      showToast('success', data.message);
      
      await logActivity({
        aksi: 'UPDATE',
        modul: 'presensi',
        deskripsi: `${newState ? 'Mengaktifkan' : 'Mematikan'} cron auto-generate agenda`,
      });
      
      fetchCronStatus(); // Refresh schedule info
    } catch (err: any) {
      console.error('[toggle-cron]', err);
      showToast('error', err.message || 'Gagal mengubah status');
    } finally {
      setToggling(false);
    }
  };

  // ==========================================================================
  // 3. Handler Generate Manual (sama seperti sebelumnya)
  // ==========================================================================
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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
      
      {/* ==================== HEADER ==================== */}
      <div className="flex items-center gap-3 border-b border-slate-800 p-5 bg-slate-950/30">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
          <Clock size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">Generate Agenda Alpa Otomatis</h3>
          <p className="text-xs text-slate-400 mt-0.5">Kelola fungsi <code>generate_daily_alpa_agenda</code></p>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ==================== TOGGLE CRON ==================== */}
        <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
          cronEnabled 
            ? 'bg-emerald-500/5 border-emerald-500/30' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw size={14} className="animate-spin" /> Memeriksa status cron...
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  cronEnabled 
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  <Power size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-100">Jadwal Otomatis</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      cronEnabled 
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}>
                      {cronEnabled ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {cronEnabled 
                      ? `Berjalan otomatis Senin–Sabtu pukul 13:30 WIB`
                      : 'Cron job dihentikan. Guru tidak di-alpa otomatis.'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleToggleCron}
                disabled={toggling}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300 cursor-pointer disabled:opacity-50 ${
                  cronEnabled 
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' 
                    : 'bg-slate-700'
                }`}
                title={cronEnabled ? 'Matikan auto-generate' : 'Aktifkan auto-generate'}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                  cronEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
                {toggling && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw size={12} className="animate-spin text-white" />
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ==================== INFO ==================== */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-2.5">
          <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Matikan fitur ini saat <b>libur panjang</b> atau <b>akhir tahun ajaran</b> agar sistem tidak menandai guru sebagai Alpa. 
            Anda tetap bisa menjalankan generate manual di bawah ini kapan saja.
          </p>
        </div>

        {/* ==================== MANUAL GENERATE ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* ==================== LAST RESULT ==================== */}
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
    </div>
  );
}