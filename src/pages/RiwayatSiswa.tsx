import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { akademikService } from '../services/akademikService';
import { Siswa } from '../types/database';
import { Search, X, ChevronDown, UserCheck } from 'lucide-react';

interface RiwayatItem {
  id: string;
  status_akhir: string;
  catatan: string | null;
  created_at: string;
  kelas: { id: string; nama_kelas: string } | null;
  tahun_ajaran: { tahun: string; semester: string } | null;
}

export const RiwayatSiswa: React.FC = () => {
  const [daftarSiswa, setDaftarSiswa] = useState<Siswa[]>([]);
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('');
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]);
  const [loading, setLoading] = useState(false);

  // State untuk Fitur Cari Siswa
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDaftarSiswa();
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

  useEffect(() => {
    if (selectedSiswaId) {
      const siswa = daftarSiswa.find((s) => s.id === selectedSiswaId) || null;
      setSelectedSiswa(siswa);
      loadRiwayat(selectedSiswaId);
    } else {
      setSelectedSiswa(null);
      setRiwayat([]);
    }
  }, [selectedSiswaId]);

  const loadDaftarSiswa = async () => {
    const { data } = await supabase
      .from('siswas')
      .select('*')
      .order('nama_lengkap', { ascending: true });

    if (data) setDaftarSiswa(data);
  };

  const loadRiwayat = async (siswaId: string) => {
    setLoading(true);
    try {
      const data = await akademikService.getRiwayatSiswa(siswaId);
      setRiwayat(data as unknown as RiwayatItem[]);
    } catch (err) {
      console.error('Gagal memuat riwayat:', err);
    } finally {
      setLoading(false);
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
    setSelectedSiswa(null);
    setRiwayat([]);
    setIsDropdownOpen(true);
  };

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'NAIK_KELAS':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'TINGGAL_KELAS':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'LULUS':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'MUTASI':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'DROP_OUT':
        return 'bg-red-600/20 text-red-400 border-red-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/80 text-slate-100">
      <h2 className="text-2xl font-bold text-white mb-1 tracking-wide">Rekam Jejak & Riwayat Siswa</h2>
      <p className="text-sm text-slate-400 mb-6">Cari siswa untuk melihat histori perjalanan akademiknya</p>

      {/* Fitur Cari Siswa */}
      <div className="mb-8 relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-slate-300 mb-2">Cari / Pilih Siswa</label>
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
                Siswa tidak ditemukan
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSiswa && (
        <div className="mb-8 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 flex flex-wrap gap-4 justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">{selectedSiswa.nama_lengkap}</h3>
            <p className="text-xs text-slate-400 font-mono">NISN: {selectedSiswa.nisn || '-'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400 mr-2">Status Saat Ini:</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {selectedSiswa.status}
            </span>
          </div>
        </div>
      )}

      {/* Timeline Riwayat */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Memuat riwayat...</div>
      ) : riwayat.length > 0 ? (
        <div className="relative pl-6 border-l-2 border-slate-800 space-y-8 my-6">
          {riwayat.map((item) => (
            <div key={item.id} className="relative group">
              {/* Dot Indikator Timeline */}
              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-500 group-hover:scale-125 transition-transform" />

              <div className="bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400">
                    Tahun Ajaran: {item.tahun_ajaran?.tahun || '-'} ({item.tahun_ajaran?.semester || '-'})
                  </span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getBadgeStyle(item.status_akhir)}`}>
                    {item.status_akhir.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-200">
                  Kelas: <span className="text-emerald-400">{item.kelas?.nama_kelas || 'Non-Kelas'}</span>
                </p>

                {item.catatan && (
                  <p className="text-xs text-slate-400 mt-2 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                    <span className="font-semibold text-slate-300">Catatan:</span> {item.catatan}
                  </p>
                )}

                <p className="text-[10px] text-slate-500 mt-2 text-right">
                  Dicatat pada: {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        selectedSiswaId && <div className="text-center py-8 text-slate-500 text-sm">Belum ada rekam jejak riwayat kelas.</div>
      )}
    </div>
  );
};