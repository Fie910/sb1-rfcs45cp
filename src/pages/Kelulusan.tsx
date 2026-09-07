import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { akademikService } from '../services/akademikService';
import { Kelas, Siswa, TahunAjaran } from '../types/database';

export const Kelulusan: React.FC = () => {
  const [tahunAjaran, setTahunAjaran] = useState<TahunAjaran | null>(null);
  const [daftarKelas, setDaftarKelas] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<string>('');
  
  const [daftarSiswa, setDaftarSiswa] = useState<Siswa[]>([]);
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    if (kelasId) {
      loadSiswaByKelas(kelasId);
    } else {
      setDaftarSiswa([]);
      setSelectedSiswaIds([]);
    }
  }, [kelasId]);

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

  const loadSiswaByKelas = async (kId: string) => {
    const { data } = await supabase
      .from('siswas')
      .select('*')
      .eq('kelas_id', kId)
      .eq('status', 'AKTIF')
      .order('nama_lengkap');

    if (data) {
      setDaftarSiswa(data);
      // Default pilih semua siswa saat kelas dimuat
      setSelectedSiswaIds(data.map((s) => s.id));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSiswaIds(daftarSiswa.map((s) => s.id));
    } else {
      setSelectedSiswaIds([]);
    }
  };

  const handleToggleSiswa = (siswaId: string) => {
    setSelectedSiswaIds((prev) =>
      prev.includes(siswaId) ? prev.filter((id) => id !== siswaId) : [...prev, siswaId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tahunAjaran || !kelasId || selectedSiswaIds.length === 0) return;

    if (!confirm(`Yakin ingin meluluskan ${selectedSiswaIds.length} siswa terpilih? Status mereka akan berubah menjadi ALUMNI.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await akademikService.prosesKelulusan(tahunAjaran.id, selectedSiswaIds, kelasId);
      setMessage(`Berhasil meluluskan ${selectedSiswaIds.length} siswa menjadi Alumni!`);
      setKelasId('');
      setDaftarSiswa([]);
      setSelectedSiswaIds([]);
    } catch (err: any) {
      setMessage(`Gagal memproses kelulusan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/80 text-slate-100">
      <h2 className="text-2xl font-bold text-white mb-1 tracking-wide">Penetapan Kelulusan & Alumni</h2>
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
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Pilih Kelas Tingkat Akhir</label>
          <select
            value={kelasId}
            onChange={(e) => setKelasId(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none backdrop-blur-md"
            required
          >
            <option value="" className="bg-slate-900 text-slate-300">
              -- Pilih Kelas --
            </option>
            {daftarKelas.map((k) => (
              <option key={k.id} value={k.id} className="bg-slate-900 text-slate-200">
                {k.nama_kelas}
              </option>
            ))}
          </select>
        </div>

        {daftarSiswa.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-slate-200">
                Daftar Calon Lulusan ({selectedSiswaIds.length} / {daftarSiswa.length} Dipilih)
              </h3>
            </div>

            <div className="overflow-x-auto border border-slate-800/80 rounded-xl backdrop-blur-md bg-slate-950/20">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedSiswaIds.length === daftarSiswa.length && daftarSiswa.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
                      />
                    </th>
                    <th className="px-4 py-3.5">NISN</th>
                    <th className="px-4 py-3.5">Nama Lengkap</th>
                    <th className="px-4 py-3.5 text-center">Status Kelulusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {daftarSiswa.map((siswa) => {
                    const isSelected = selectedSiswaIds.includes(siswa.id);
                    return (
                      <tr key={siswa.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSiswa(siswa.id)}
                            className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-400">{siswa.nisn}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-100">{siswa.nama_lengkap}</td>
                        <td className="px-4 py-3.5 text-center">
                          {isSelected ? (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              LULUS (ALUMNI)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              DITANGGUHKAN
                            </span>
                          )}
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
              disabled={loading || selectedSiswaIds.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-950/50 border border-emerald-500/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Memproses...' : `Proses Kelulusan (${selectedSiswaIds.length} Siswa)`}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};