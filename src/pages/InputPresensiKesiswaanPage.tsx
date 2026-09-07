import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import {
  UserCheck,
  Save,
  Loader2,
  Calendar,
  School,
  FileText,
  Users,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

interface KelasItem {
  id: number;
  nama_kelas: string;
}

interface SiswaItem {
  id: number;
  nama_lengkap: string;
  jenis_kelamin: 'L' | 'P';
  nisn: string;
}

interface FormState {
  [siswaId: number]: {
    status_kehadiran: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa' | null;
    keterangan: string;
  };
}

const getTodayWIB = (): string => {
  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function InputPresensiKesiswaanPage() {
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [selectedKelasId, setSelectedKelasId] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>(getTodayWIB());
  const [siswas, setSiswas] = useState<SiswaItem[]>([]);
  const [formData, setFormData] = useState<FormState>({});
  const [loadingKelas, setLoadingKelas] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load daftar kelas
  useEffect(() => {
    const fetchKelas = async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama_kelas')
        .order('nama_kelas', { ascending: true });

      if (error) {
        showToast('error', 'Gagal memuat data kelas: ' + error.message);
      } else if (data) {
        setKelasList(data);
        if (data.length > 0) setSelectedKelasId(String(data[0].id));
      }
      setLoadingKelas(false);
    };
    fetchKelas();
  }, []);

  // Load siswa & data presensi yang sudah tersimpan di tanggal ini
  const fetchSiswasAndPresensi = useCallback(async () => {
    if (!selectedKelasId) return;
    setLoadingSiswa(true);

    // Fetch siswa di kelas terpilih
    const { data: dataSiswa, error: errorSiswa } = await supabase
      .from('siswas')
      .select('id, nama_lengkap, jenis_kelamin, nisn')
      .eq('kelas_id', selectedKelasId)
      .order('nama_lengkap', { ascending: true });

    if (errorSiswa) {
      showToast('error', 'Gagal memuat siswa: ' + errorSiswa.message);
      setLoadingSiswa(false);
      return;
    }

    if (dataSiswa) {
      setSiswas(dataSiswa);
      const siswaIds = dataSiswa.map((s) => s.id);

      // Fetch presensi yang mungkin sudah diinput pada tanggal terpilih
      const { data: dataPresensi } = await supabase
        .from('presensi_siswa_kesiswaans')
        .select('siswa_id, status_kehadiran, keterangan')
        .eq('tanggal', tanggal)
        .in('siswa_id', siswaIds.length > 0 ? siswaIds : [-1]);

      const presensiMap = new Map(
        dataPresensi?.map((p) => [p.siswa_id, p])
      );

      const initialForm: FormState = {};
      dataSiswa.forEach((s) => {
        const existing = presensiMap.get(s.id);
        initialForm[s.id] = {
          // Default ke null jika belum ada record presensi
          status_kehadiran: existing?.status_kehadiran || null,
          keterangan: existing?.keterangan || '',
        };
      });
      setFormData(initialForm);
    }
    setLoadingSiswa(false);
  }, [selectedKelasId, tanggal]);

  useEffect(() => {
    fetchSiswasAndPresensi();
  }, [fetchSiswasAndPresensi]);

  const handleStatusChange = (siswaId: number, status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa') => {
    setFormData((prev) => ({
      ...prev,
      [siswaId]: { ...prev[siswaId], status_kehadiran: status },
    }));
  };

  const handleKeteranganChange = (siswaId: number, ket: string) => {
    setFormData((prev) => ({
      ...prev,
      [siswaId]: { ...prev[siswaId], keterangan: ket },
    }));
  };

  const handleSetAllStatus = (status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa') => {
    setFormData((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[Number(id)].status_kehadiran = status;
      });
      return updated;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (siswas.length === 0) {
      showToast('error', 'Tidak ada siswa untuk disimpan');
      return;
    }

    // Validasi: pastikan tidak ada siswa dengan status null (terlewat)
    const unselectedSiswa = siswas.filter(
      (s) => !formData[s.id] || formData[s.id].status_kehadiran === null
    );

    if (unselectedSiswa.length > 0) {
      showToast(
        'error',
        `Masih ada ${unselectedSiswa.length} siswa yang belum diisi status kehadirannya!`
      );
      return;
    }

    setSaving(true);
    const payload = siswas.map((s) => ({
      siswa_id: s.id,
      tanggal,
      status_kehadiran: formData[s.id].status_kehadiran,
      keterangan: formData[s.id]?.keterangan.trim() || null,
    }));

    const { error } = await supabase
      .from('presensi_siswa_kesiswaans')
      .upsert(payload, { onConflict: 'siswa_id,tanggal' });

    if (error) {
      showToast('error', 'Gagal menyimpan presensi: ' + error.message);
    } else {
      showToast('success', `Presensi ${siswas.length} siswa berhasil disimpan`);
    }
    setSaving(false);
  };

  // Menghitung statistik pengisian presensi
  const filledCount = siswas.filter(
    (s) => formData[s.id]?.status_kehadiran !== null && formData[s.id]?.status_kehadiran !== undefined
  ).length;
  const unselectedCount = siswas.length - filledCount;

  return (
    <div className="p-3 sm:p-5 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 min-h-screen text-slate-100">
      {/* Title Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800/80 pb-4 sm:pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2.5 sm:gap-3 text-white">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            Pencatatan Presensi Siswa (Kesiswaan)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Input dan perbarui kehadiran siswa harian berbasis kelas
          </p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-2xl shadow-black/40 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
            <School size={15} className="text-indigo-400" /> Pilih Kelas
          </label>
          <select
            value={selectedKelasId}
            onChange={(e) => setSelectedKelasId(e.target.value)}
            disabled={loadingKelas}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md transition-all cursor-pointer"
          >
            {loadingKelas ? (
              <option>Memuat kelas...</option>
            ) : (
              kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
            <Calendar size={15} className="text-indigo-400" /> Tanggal Presensi (WIB)
          </label>
          <input
            type="date"
            value={tanggal}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTanggal(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md transition-all cursor-pointer"
          />
        </div>
      </div>

      {/* Quick Action & Student List Form */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 font-semibold flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-200">
              <Users size={16} className="text-indigo-400" /> Total: {siswas.length}
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
            <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto">
              {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleSetAllStatus(st)}
                  className="px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50 backdrop-blur-md transition-all cursor-pointer text-center"
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/40 p-3 sm:p-0">
          {loadingSiswa ? (
            <div className="flex items-center justify-center py-16 sm:py-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin text-indigo-400" size={24} />
              <span className="text-xs sm:text-sm">Memuat data siswa & presensi...</span>
            </div>
          ) : siswas.length === 0 ? (
            <div className="text-center py-12 sm:py-16 text-slate-500 text-xs sm:text-sm">
              Tidak ada siswa terdaftar di kelas ini.
            </div>
          ) : (
            <>
              {/* TAMPILAN HP (MOBILE CARD VIEW) */}
              <div className="block md:hidden space-y-3.5">
                {siswas.map((s, idx) => {
                  const currentStatus = formData[s.id]?.status_kehadiran;
                  const isUnset = currentStatus === null || currentStatus === undefined;

                  return (
                    <div
                      key={s.id}
                      className={`border rounded-xl p-3.5 space-y-3 transition-colors ${
                        isUnset
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-slate-950/70 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-mono text-slate-400">{s.nisn}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isUnset && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                              <AlertCircle size={10} /> Belum Diabsen
                            </span>
                          )}
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50">
                            {s.jenis_kelamin === 'L' ? 'Laki-Laki' : 'Perempuan'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-100 text-sm">{s.nama_lengkap}</h3>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Status Kehadiran
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map((statusOption) => {
                            const isSelected = currentStatus === statusOption;
                            return (
                              <button
                                key={statusOption}
                                type="button"
                                onClick={() => handleStatusChange(s.id, statusOption)}
                                className={`py-2 px-1 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? statusOption === 'Hadir'
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/30'
                                      : statusOption === 'Sakit'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30'
                                      : statusOption === 'Izin'
                                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/20 ring-1 ring-blue-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20 ring-1 ring-rose-500/30'
                                    : 'bg-slate-900/80 text-slate-400 border-slate-800/80 hover:bg-slate-800/50'
                                }`}
                              >
                                {statusOption}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-1">
                        <div className="relative">
                          <input
                            type="text"
                            value={formData[s.id]?.keterangan || ''}
                            onChange={(e) => handleKeteranganChange(s.id, e.target.value)}
                            placeholder="Tambah catatan/keterangan..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500/80 transition-all"
                          />
                          <FileText size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TAMPILAN DESKTOP/TABLET (TABLE VIEW) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-5">No</th>
                      <th className="py-4 px-5">NISN</th>
                      <th className="py-4 px-5">Nama Siswa</th>
                      <th className="py-4 px-5">L/P</th>
                      <th className="py-4 px-5">Status Kehadiran</th>
                      <th className="py-4 px-5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                    {siswas.map((s, idx) => {
                      const currentStatus = formData[s.id]?.status_kehadiran;
                      const isUnset = currentStatus === null || currentStatus === undefined;

                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${
                            isUnset ? 'bg-rose-950/10 hover:bg-rose-950/20' : 'hover:bg-slate-800/20'
                          }`}
                        >
                          <td className="py-3.5 px-5 text-slate-500">{idx + 1}</td>
                          <td className="py-3.5 px-5 font-mono text-slate-400">{s.nisn}</td>
                          <td className="py-3.5 px-5 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              {s.nama_lengkap}
                              {isUnset && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                  <AlertCircle size={10} /> Belum
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-5">{s.jenis_kelamin}</td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-1.5">
                              {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map((statusOption) => {
                                const isSelected = currentStatus === statusOption;
                                return (
                                  <button
                                    key={statusOption}
                                    type="button"
                                    onClick={() => handleStatusChange(s.id, statusOption)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                      isSelected
                                        ? statusOption === 'Hadir'
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                                          : statusOption === 'Sakit'
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                                          : statusOption === 'Izin'
                                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/20'
                                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                                        : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:bg-slate-800/50'
                                    }`}
                                  >
                                    {statusOption}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="relative">
                              <input
                                type="text"
                                value={formData[s.id]?.keterangan || ''}
                                onChange={(e) => handleKeteranganChange(s.id, e.target.value)}
                                placeholder="Catatan..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500/80 transition-all"
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
            </>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2 pb-6">
          <button
            type="submit"
            disabled={saving || loadingSiswa || siswas.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600/90 hover:bg-indigo-500/90 text-white font-bold px-7 py-3.5 sm:py-3 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 border border-indigo-400/30 cursor-pointer text-sm sm:text-xs disabled:opacity-50 backdrop-blur-md"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Menyimpan Presensi...' : 'Simpan Presensi Kelas Ini'}
          </button>
        </div>
      </form>
    </div>
  );
}