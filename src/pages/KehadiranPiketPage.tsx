import { useEffect, useState, useCallback } from 'react';
import {
  Save,
  Calendar,
  Loader2,
  ShieldAlert,
  Users,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCanAccess } from '@/hooks/useCanAccess';

type RowPiketHarian = {
  guru_id: string;
  nama_lengkap: string;
  nip: string;
  jadwal_piket_id: number;
  status: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa' | null;
  catatan: string;
};

const STATUS_OPTIONS: ('Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa')[] = [
  'Hadir',
  'Terlambat',
  'Izin',
  'Sakit',
  'Alpa',
];

export function KehadiranPiketPage() {
  const canAccess = useCanAccess('piket');
  const [tanggal, setTanggal] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<RowPiketHarian[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchFormPresensiPiket = useCallback(async () => {
    setLoading(true);
    const dayName = new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long' });

    const { data: jadwalData } = await supabase
      .from('jadwal_pikets')
      .select('id, guru_id, gurus(nama_lengkap, nip)')
      .eq('hari_piket', dayName);

    if (!jadwalData || jadwalData.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: presensiExist } = await supabase
      .from('kehadiran_pikets')
      .select('guru_id, status, catatan')
      .eq('tanggal', tanggal);

    const existMap = new Map((presensiExist ?? []).map((p) => [p.guru_id, p]));

    const mergedRows: RowPiketHarian[] = jadwalData.map((j: any) => {
      const existing = existMap.get(j.guru_id);
      return {
        guru_id: j.guru_id,
        nama_lengkap: j.gurus?.nama_lengkap ?? '-',
        nip: j.gurus?.nip ?? '-',
        jadwal_piket_id: j.id,
        // Default ke null jika belum ada record presensi tersimpan
        status: existing?.status ?? null,
        catatan: existing?.catatan ?? '',
      };
    });

    setRows(mergedRows);
    setLoading(false);
  }, [tanggal]);

  useEffect(() => {
    if (canAccess) fetchFormPresensiPiket();
  }, [canAccess, fetchFormPresensiPiket]);

  const handleStatusChange = (index: number, status: RowPiketHarian['status']) => {
    const updated = [...rows];
    updated[index].status = status;
    setRows(updated);
  };

  const handleCatatanChange = (index: number, catatan: string) => {
    const updated = [...rows];
    updated[index].catatan = catatan;
    setRows(updated);
  };

  const handleSetAllStatus = (status: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa') => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        status,
      }))
    );
  };

  const handleSaveAll = async () => {
    // Validasi: pastikan tidak ada guru yang statusnya masih null
    const unselected = rows.filter((r) => r.status === null);
    if (unselected.length > 0) {
      alert(`Masih ada ${unselected.length} guru piket yang belum diisi status kehadirannya!`);
      return;
    }

    setSaving(true);
    const nowISO = new Date().toISOString();

    const payload = rows.map((r) => ({
      guru_id: r.guru_id,
      jadwal_piket_id: r.jadwal_piket_id,
      tanggal: tanggal,
      status: r.status,
      catatan: r.catatan,
      waktu_absen: nowISO,
    }));

    const { error } = await supabase
      .from('kehadiran_pikets')
      .upsert(payload, { onConflict: 'guru_id,tanggal' });

    if (error) {
      alert(`Gagal menyimpan: ${error.message}`);
    } else {
      alert('Presensi piket KBM berhasil disimpan!');
      fetchFormPresensiPiket();
    }
    setSaving(false);
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="text-rose-400 mb-3" size={40} />
        <h2 className="text-xl font-bold text-slate-100">Akses Ditolak</h2>
      </div>
    );
  }

  // Menghitung statistik pengisian presensi
  const filledCount = rows.filter((r) => r.status !== null).length;
  const unselectedCount = rows.length - filledCount;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Presensi Guru Piket KBM</h1>
          <p className="text-slate-400 text-sm">Pencatatan kehadiran guru piket KBM</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <Calendar size={16} className="text-indigo-400 ml-1" />
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <Loader2 className="animate-spin mx-auto mb-2 text-indigo-400" size={32} />
          <p className="text-xs">Memuat daftar piket KBM...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
          Tidak ada jadwal piket KBM untuk tanggal ini.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Action & Summary Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 font-semibold flex-wrap">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Users size={16} className="text-indigo-400" /> Total Guru: {rows.length}
              </span>
              <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <CheckCircle2 size={13} /> Diabsen: {filledCount}
              </span>
              {unselectedCount > 0 && (
                <span className="text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 font-bold animate-pulse">
                  <AlertCircle size={13} /> Belum: {unselectedCount}
                </span>
              )}
            </div>

            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1.5 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 w-full sm:w-auto">
                Set Semua:
              </span>
              <div className="grid grid-cols-5 gap-1 w-full sm:w-auto">
                {STATUS_OPTIONS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleSetAllStatus(st)}
                    className="px-2 py-1 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-all cursor-pointer text-center"
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TAMPILAN MOBILE: Card Stack Layout */}
          <div className="block md:hidden space-y-3">
            {rows.map((row, idx) => {
              const isUnset = row.status === null;

              return (
                <div
                  key={row.guru_id}
                  className={`border rounded-2xl p-4 space-y-3 shadow-lg transition-colors ${
                    isUnset
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div>
                      <p className="font-bold text-slate-100 text-sm">{row.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">NIP: {row.nip}</p>
                    </div>
                    {isUnset && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
                        <AlertCircle size={10} /> Belum Diabsen
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      Status Kehadiran
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {STATUS_OPTIONS.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(idx, st)}
                          className={`px-2 py-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer text-center ${
                            row.status === st
                              ? st === 'Hadir'
                                ? 'bg-emerald-600 text-white'
                                : st === 'Terlambat'
                                ? 'bg-amber-600 text-white'
                                : st === 'Alpa'
                                ? 'bg-rose-600 text-white'
                                : 'bg-violet-600 text-white'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Catatan
                    </span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Keterangan (opsional)"
                        value={row.catatan}
                        onChange={(e) => handleCatatanChange(idx, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 outline-none focus:border-indigo-500"
                      />
                      <FileText size={14} className="absolute left-2.5 top-2.5 text-slate-600" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TAMPILAN DESKTOP: Tabel Matrix */}
          <div className="hidden md:block bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">Guru Piket</th>
                  <th className="p-4">Status Kehadiran</th>
                  <th className="p-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row, idx) => {
                  const isUnset = row.status === null;

                  return (
                    <tr
                      key={row.guru_id}
                      className={`transition-colors ${
                        isUnset ? 'bg-rose-950/10 hover:bg-rose-950/20' : 'hover:bg-slate-950/40'
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-slate-200">{row.nama_lengkap}</p>
                            <p className="text-[11px] text-slate-500">NIP: {row.nip}</p>
                          </div>
                          {isUnset && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                              <AlertCircle size={10} /> Belum
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(idx, st)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                row.status === st
                                  ? st === 'Hadir'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'Terlambat'
                                    ? 'bg-amber-600 text-white'
                                    : st === 'Alpa'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-violet-600 text-white'
                                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Keterangan (opsional)"
                            value={row.catatan}
                            onChange={(e) => handleCatatanChange(idx, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-indigo-500"
                          />
                          <FileText size={13} className="absolute left-2.5 top-2 text-slate-600" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Simpan Presensi Piket</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}