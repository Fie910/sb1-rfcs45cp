import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { akademikService } from '../services/akademikService';
import { Siswa, TahunAjaran } from '../types/database';
import { Search, X, ChevronDown, UserCheck } from 'lucide-react';

export const MutasiSiswa: React.FC = () => {
  const [tahunAjaran, setTahunAjaran] = useState<TahunAjaran | null>(null);
  const [daftarSiswa, setDaftarSiswa] = useState<Siswa[]>([]);
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('');
  const [statusBaru, setStatusBaru] = useState<'MUTASI_KELUAR' | 'DROP_OUT'>('MUTASI_KELUAR');
  const [alasan, setAlasan] = useState('');
  
  // State untuk Fitur Cari Siswa
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    initData();
  }, []);

  // Tutup dropdown saat klik di luar area komponen
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initData = async () => {
    try {
      const ta = await akademikService.getTahunAjaranAktif();
      setTahunAjaran(ta);

      // Hanya ambil siswa aktif
      const { data } = await supabase
        .from('siswas')
        .select('*')
        .eq('status', 'AKTIF')
        .order('nama_lengkap');

      if (data) setDaftarSiswa(data);
    } catch (err: any) {
      console.error('Gagal memuat data:', err);
    }
  };

  // Filter daftar siswa berdasarkan nama atau NISN
  const filteredSiswa = daftarSiswa.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      s.nama_lengkap.toLowerCase().includes(q) ||
      (s.nisn && s.nisn.toLowerCase().includes(q))
    );
  });

  const handleSelectSiswa = (siswa: Siswa) => {
    setSelectedSiswaId(siswa.id);
    setSearchQuery(`${siswa.nama_lengkap} (${siswa.nisn || '-'})`);
    setIsDropdownOpen(false);
  };

  const handleClearSiswa = () => {
    setSelectedSiswaId('');
    setSearchQuery('');
    setIsDropdownOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tahunAjaran || !selectedSiswaId) return;

    const siswaTerpilih = daftarSiswa.find((s) => s.id === selectedSiswaId);
    if (!siswaTerpilih) return;

    if (!confirm(`Konfirmasi: Siswa ${siswaTerpilih.nama_lengkap} akan diubah statusnya menjadi ${statusBaru}?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await akademikService.prosesSiswaKeluar(
        siswaTerpilih.id,
        siswaTerpilih.kelas_id || '',
        tahunAjaran.id,
        statusBaru,
        alasan
      );

      setMessage(`Berhasil memproses mutasi siswa: ${siswaTerpilih.nama_lengkap}`);
      setSelectedSiswaId('');
      setSearchQuery('');
      setAlasan('');
      initData(); // Refresh list siswa aktif
    } catch (err: any) {
      setMessage(`Gagal memproses mutasi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/80 text-slate-100">
      <h2 className="text-2xl font-bold text-white mb-1 tracking-wide">Pengolahan Mutasi / Siswa Keluar</h2>
      <p className="text-sm text-slate-400 mb-6">Pencatatan siswa pindah sekolah (Mutasi) atau Drop Out</p>

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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Fitur Pencarian Siswa */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-slate-300 mb-2">Cari & Pilih Siswa Aktif</label>
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedSiswaId('');
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Ketik Nama atau NISN Siswa..."
              className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none backdrop-blur-md"
            />
            {selectedSiswaId || searchQuery ? (
              <button
                type="button"
                onClick={handleClearSiswa}
                className="absolute right-3 p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <ChevronDown className="absolute right-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            )}
          </div>

          {/* Dropdown Hasil Pencarian */}
          {isDropdownOpen && (
            <div className="absolute z-50 w-full mt-2 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl max-h-60 overflow-y-auto backdrop-blur-xl divide-y divide-slate-800/60">
              {filteredSiswa.length > 0 ? (
                filteredSiswa.map((siswa) => (
                  <button
                    key={siswa.id}
                    type="button"
                    onClick={() => handleSelectSiswa(siswa)}
                    className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors ${
                      selectedSiswaId === siswa.id ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{siswa.nama_lengkap}</div>
                      <div className="text-xs text-slate-400 font-mono">NISN: {siswa.nisn || '-'}</div>
                    </div>
                    {selectedSiswaId === siswa.id && <UserCheck className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">
                  Siswa tidak ditemukan atau tidak aktif
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Jenis Keluar</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatusBaru('MUTASI_KELUAR')}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                statusBaru === 'MUTASI_KELUAR'
                  ? 'bg-rose-600/30 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
              }`}
            >
              Mutasi / Pindah Sekolah
            </button>
            <button
              type="button"
              onClick={() => setStatusBaru('DROP_OUT')}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                statusBaru === 'DROP_OUT'
                  ? 'bg-red-700/40 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
              }`}
            >
              Drop Out (DO)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Alasan / Catatan</label>
          <textarea
            rows={3}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Ketikkan alasan pindah sekolah atau catatan khusus..."
            className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none backdrop-blur-md"
            required
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading || !selectedSiswaId}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-rose-950/50 border border-rose-500/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Simpan Mutasi'}
          </button>
        </div>
      </form>
    </div>
  );
};