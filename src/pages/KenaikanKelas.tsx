import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { akademikService, SiswaProsesKenaikan } from '../services/akademikService';
import { Kelas, Siswa, TahunAjaran } from '../types/database';

export const KenaikanKelas: React.FC = () => {
  const [tahunAjaran, setTahunAjaran] = useState<TahunAjaran | null>(null);
  const [daftarKelas, setDaftarKelas] = useState<Kelas[]>([]);
  const [kelasAsalId, setKelasAsalId] = useState<string>('');
  const [kelasTujuanId, setKelasTujuanId] = useState<string>('');
  
  const [daftarSiswa, setDaftarSiswa] = useState<Siswa[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, { status: 'NAIK_KELAS' | 'TINGGAL_KELAS'; targetKelasId: string }>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    if (kelasAsalId) {
      loadSiswaByKelas(kelasAsalId);
    } else {
      setDaftarSiswa([]);
    }
  }, [kelasAsalId]);

  const initData = async () => {
    try {
      const ta = await akademikService.getTahunAjaranAktif();
      setTahunAjaran(ta);

      const { data: kelasData } = await supabase.from('kelas').select('*').order('nama_kelas');
      if (kelasData) setDaftarKelas(kelasData);
    } catch (err: any) {
      console.error('Gagal memuat data awal:', err);
    }
  };

  const loadSiswaByKelas = async (kelasId: string) => {
    const { data } = await supabase
      .from('siswas')
      .select('*')
      .eq('kelas_id', kelasId)
      .eq('status', 'AKTIF')
      .order('nama_lengkap');

    if (data) {
      setDaftarSiswa(data);
      const initialMap: Record<string, { status: 'NAIK_KELAS' | 'TINGGAL_KELAS'; targetKelasId: string }> = {};
      data.forEach((s) => {
        initialMap[s.id] = {
          status: 'NAIK_KELAS',
          targetKelasId: kelasTujuanId || '',
        };
      });
      setStatusMap(initialMap);
    }
  };

  const handleKelasTujuanChange = (targetId: string) => {
    setKelasTujuanId(targetId);
    setStatusMap((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        if (updated[id].status === 'NAIK_KELAS') {
          updated[id].targetKelasId = targetId;
        }
      });
      return updated;
    });
  };

  const handleToggleStatus = (siswaId: string, status: 'NAIK_KELAS' | 'TINGGAL_KELAS') => {
    setStatusMap((prev) => ({
      ...prev,
      [siswaId]: {
        status,
        targetKelasId: status === 'NAIK_KELAS' ? kelasTujuanId : kelasAsalId,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tahunAjaran || !kelasAsalId || daftarSiswa.length === 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const payload: SiswaProsesKenaikan[] = daftarSiswa.map((siswa) => ({
        siswa_id: siswa.id,
        kelas_tujuan_id: statusMap[siswa.id]?.targetKelasId || kelasAsalId,
        status_akhir: statusMap[siswa.id]?.status || 'NAIK_KELAS',
        catatan: statusMap[siswa.id]?.status === 'TINGGAL_KELAS' ? 'Tinggal di kelas asal' : 'Naik kelas',
      }));

      await akademikService.prosesKenaikanKelas(tahunAjaran.id, payload);
      setMessage('Proses kenaikan kelas berhasil disimpan!');
      setKelasAsalId('');
      setKelasTujuanId('');
      setDaftarSiswa([]);
    } catch (err: any) {
      setMessage(`Gagal memproses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/80 text-slate-100">
      <h2 className="text-2xl font-bold text-white mb-1 tracking-wide">Penetapan Kenaikan Kelas</h2>
      <p className="text-sm text-slate-400 mb-6">
        Tahun Ajaran Aktif:{' '}
        <span className="font-semibold text-emerald-400">
          {tahunAjaran ? `${tahunAjaran.tahun} (${tahunAjaran.semester})` : 'Memuat...'}
        </span>
      </p>

      {message && (
        <div
          className={`p-4 rounded-xl mb-6 text-sm backdrop-blur-md border ${
            message.includes('Gagal')
              ? 'bg-red-950/40 border-red-500/30 text-red-300'
              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Pilih Kelas Asal</label>
            <select
              value={kelasAsalId}
              onChange={(e) => setKelasAsalId(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none backdrop-blur-md"
              required
            >
              <option value="" className="bg-slate-900 text-slate-300">
                -- Pilih Kelas Asal --
              </option>
              {daftarKelas.map((k) => (
                <option key={k.id} value={k.id} className="bg-slate-900 text-slate-200">
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Pilih Kelas Tujuan (Default Naik)</label>
            <select
              value={kelasTujuanId}
              onChange={(e) => handleKelasTujuanChange(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none backdrop-blur-md"
              required
            >
              <option value="" className="bg-slate-900 text-slate-300">
                -- Pilih Kelas Tujuan --
              </option>
              {daftarKelas.map((k) => (
                <option key={k.id} value={k.id} className="bg-slate-900 text-slate-200">
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>
        </div>

        {daftarSiswa.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-semibold text-slate-200 mb-3">Daftar Siswa ({daftarSiswa.length} Orang)</h3>
            <div className="overflow-x-auto border border-slate-800/80 rounded-xl backdrop-blur-md bg-slate-950/20">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">NISN</th>
                    <th className="px-4 py-3.5">Nama Siswa</th>
                    <th className="px-4 py-3.5 text-center">Keputusan Kenaikan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {daftarSiswa.map((siswa) => {
                    const isNaik = statusMap[siswa.id]?.status === 'NAIK_KELAS';
                    return (
                      <tr key={siswa.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-slate-400">{siswa.nisn}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-100">{siswa.nama_lengkap}</td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex rounded-lg shadow-sm" role="group">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(siswa.id, 'NAIK_KELAS')}
                              className={`px-3.5 py-1.5 text-xs font-medium rounded-l-lg border transition-all ${
                                isNaik
                                  ? 'bg-emerald-600/80 text-white border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                  : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:bg-slate-700/50 hover:text-slate-200'
                              }`}
                            >
                              Naik Kelas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(siswa.id, 'TINGGAL_KELAS')}
                              className={`px-3.5 py-1.5 text-xs font-medium rounded-r-lg border-t border-b border-r transition-all ${
                                !isNaik
                                  ? 'bg-amber-600/80 text-white border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                  : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:bg-slate-700/50 hover:text-slate-200'
                              }`}
                            >
                              Tinggal Kelas
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {daftarSiswa.length > 0 && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-950/50 border border-emerald-500/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Simpan Kenaikan Kelas'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};