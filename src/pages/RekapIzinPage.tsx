import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Loader2,
  FileText,
  Calendar,
  User,
  Filter,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';

interface GuruOption {
  id: string;
  nama_lengkap: string;
}

interface IzinGuruJoined {
  id: number;
  tanggal_izin: string;
  kategori_izin: 'Izin' | 'Sakit';
  keterangan_izin: string | null;
  titipan_tugas: string;
  status_penyampaian: string;
  waktu_penyampaian: string | null;
  status_penanganan: string;
  guru_izin: {
    id: string;
    nama_lengkap: string;
  } | null;
  guru_piket: {
    id: string;
    nama_lengkap: string;
  } | null;
  kelas: {
    id: number;
    nama_kelas: string;
  } | null;
  mata_pelajaran: {
    id: number;
    nama_mapel: string;
  } | null;
}

const HEADERS = [
  'Tanggal Izin',
  'Guru Izin',
  'Kategori',
  'Keterangan',
  'Kelas',
  'Mata Pelajaran',
  'Titipan Tugas',
  'Status Penyampaian',
  'Waktu Penyampaian',
];

// Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD (Zona WIB)
const getTodayWIB = (): string => {
  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper untuk mendapatkan tanggal 1 awal bulan berjalan (Zona WIB)
const getStartOfMonthWIB = (): string => {
  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

export function RekapIzinPage() {
  const [list, setList] = useState<IzinGuruJoined[]>([]);
  const [gurus, setGurus] = useState<GuruOption[]>([]);
  const [loading, setLoading] = useState(true);

  // State Tanggal Default: Awal Bulan Berjalan s.d. Hari Ini
  const [tanggalMulai, setTanggalMulai] = useState<string>(getStartOfMonthWIB());
  const [tanggalSelesai, setTanggalSelesai] = useState<string>(getTodayWIB());
  const [filterGuru, setFilterGuru] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch daftar guru untuk filter
  useEffect(() => {
    const fetchGurus = async () => {
      const { data } = await supabase
        .from('gurus')
        .select('id, nama_lengkap')
        .order('nama_lengkap', { ascending: true });
      if (data) setGurus(data as GuruOption[]);
    };
    fetchGurus();
  }, []);

  // Fetch data rekap izin dengan filter rentang tanggal (gte & lte)
  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('izin_guru_pikets')
      .select(`
        *,
        guru_izin:gurus!izin_guru_pikets_guru_izin_id_fkey(id, nama_lengkap),
        guru_piket:gurus!izin_guru_pikets_guru_piket_id_fkey(id, nama_lengkap),
        kelas:kelas_id(id, nama_kelas),
        mata_pelajaran:mata_pelajarans!izin_guru_pikets_mapel_id_fkey(id, nama_mapel)
      `)
      .order('tanggal_izin', { ascending: false });

    if (tanggalMulai) {
      query = query.gte('tanggal_izin', tanggalMulai);
    }
    if (tanggalSelesai) {
      query = query.lte('tanggal_izin', tanggalSelesai);
    }
    if (filterGuru) {
      query = query.eq('guru_izin_id', filterGuru);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching rekap izin:', error.message);
      setList([]);
    } else {
      setList((data as unknown as IzinGuruJoined[]) || []);
    }
    setLoading(false);
  }, [tanggalMulai, tanggalSelesai, filterGuru]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter pencarian teks
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((item) => {
      const namaGuru = item.guru_izin?.nama_lengkap?.toLowerCase() || '';
      const kelas = item.kelas?.nama_kelas?.toLowerCase() || '';
      const mapel = item.mata_pelajaran?.nama_mapel?.toLowerCase() || '';
      const tugas = item.titipan_tugas?.toLowerCase() || '';
      return (
        namaGuru.includes(q) ||
        kelas.includes(q) ||
        mapel.includes(q) ||
        tugas.includes(q)
      );
    });
  }, [list, searchQuery]);

  // Rows untuk Ekspor Excel/PDF
  const rows = useMemo(() => {
    return filteredList.map((i) => [
      i.tanggal_izin,
      i.guru_izin?.nama_lengkap ?? '-',
      i.kategori_izin ?? '-',
      i.keterangan_izin ?? '-',
      i.kelas?.nama_kelas ?? '-',
      i.mata_pelajaran?.nama_mapel ?? '-',
      i.titipan_tugas ?? '-',
      i.status_penyampaian ?? '-',
      i.waktu_penyampaian
        ? new Date(i.waktu_penyampaian).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
          })
        : '-',
    ]);
  }, [filteredList]);

  // Ringkasan Statistik
  const totalIzin = filteredList.length;
  const totalSakit = filteredList.filter((i) => i.kategori_izin === 'Sakit').length;
  const totalSudahDisampaikan = filteredList.filter(
    (i) => i.status_penyampaian === 'Sudah Disampaikan'
  ).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 min-h-screen text-slate-100">
      {/* Title Header */}
      <div className="border-b border-slate-800/80 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3 text-white">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <FileText size={26} />
            </div>
            Rekap Izin Guru & Titipan Tugas
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Laporan riwayat izin guru, piket, dan status penyampaian titipan tugas ke kelas
          </p>
        </div>

        <ExportImportButtons
          filename="rekap_izin_guru"
          title="Rekap Izin Guru & Titipan Tugas"
          headers={HEADERS}
          rows={rows}
          showImport={false}
        />
      </div>

      {/* Ringkasan Statistik Glassmorphic */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Permohonan</p>
            <p className="text-xl font-black text-slate-100">{totalIzin}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Kategori Sakit</p>
            <p className="text-xl font-black text-slate-100">{totalSakit}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Tugas Tersampaikan</p>
            <p className="text-xl font-black text-slate-100">{totalSudahDisampaikan}</p>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-2xl shadow-black/40 space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
          <Filter size={15} className="text-indigo-400" />
          Filter Data Izin
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} /> Tanggal Mulai
            </label>
            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer backdrop-blur-md"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} /> Tanggal Selesai
            </label>
            <input
              type="date"
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer backdrop-blur-md"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User size={13} /> Filter Guru
            </label>
            <select
              value={filterGuru}
              onChange={(e) => setFilterGuru(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer backdrop-blur-md"
            >
              <option value="">Semua Guru</option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Search size={13} /> Cari Kata Kunci
            </label>
            <input
              type="text"
              placeholder="Cari Guru / Kelas / Tugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      {/* Main Content Table (Freeze Header & Freeze Kolom Guru) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="max-h-[600px] overflow-auto relative">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider backdrop-blur-md">
                {/* Frozen Column Header 1: Tanggal */}
                <th className="py-4 px-5 sticky top-0 left-0 z-30 bg-slate-950/95 min-w-[120px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  Tanggal
                </th>
                {/* Frozen Column Header 2: Guru Izin */}
                <th className="py-4 px-5 sticky top-0 left-[120px] z-30 bg-slate-950/95 min-w-[180px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  Guru Izin
                </th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Kategori</th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Keterangan</th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Kelas</th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Mata Pelajaran</th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Titipan Tugas</th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Status Penyampaian</th>
                <th className="py-4 px-5 sticky top-0 z-20 bg-slate-950/95">Waktu Penyampaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={HEADERS.length} className="text-center py-20 text-slate-400">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto" size={28} />
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length} className="text-center py-16 text-slate-400">
                    <FileText size={36} className="mx-auto mb-2 text-slate-600" />
                    <p className="font-bold text-slate-200 text-xs">Tidak ada data izin guru.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sesuaikan rentang tanggal atau filter guru Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Frozen Column Body 1: Tanggal */}
                    <td className="py-3.5 px-5 font-medium text-slate-300 sticky left-0 z-10 bg-slate-900/95 backdrop-blur-md shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      {i.tanggal_izin}
                    </td>

                    {/* Frozen Column Body 2: Guru Izin */}
                    <td className="py-3.5 px-5 font-bold text-slate-100 sticky left-[120px] z-10 bg-slate-900/95 backdrop-blur-md shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      {i.guru_izin?.nama_lengkap ?? '-'}
                    </td>

                    {/* Kolom Biasa */}
                    <td className="py-3.5 px-5">
                      {i.kategori_izin && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            i.kategori_izin === 'Sakit'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-violet-500/10 text-violet-400 border-violet-500/30'
                          }`}
                        >
                          {i.kategori_izin}
                        </span>
                      )}
                    </td>

                    <td
                      className="py-3.5 px-5 text-slate-400 max-w-xs truncate"
                      title={i.keterangan_izin ?? ''}
                    >
                      {i.keterangan_izin || '-'}
                    </td>

                    <td className="py-3.5 px-5 font-medium text-slate-300">
                      {i.kelas?.nama_kelas ?? '-'}
                    </td>

                    <td className="py-3.5 px-5 text-slate-300">
                      {i.mata_pelajaran?.nama_mapel ?? '-'}
                    </td>

                    <td
                      className="py-3.5 px-5 text-slate-400 max-w-xs truncate font-mono text-[11px]"
                      title={i.titipan_tugas}
                    >
                      {i.titipan_tugas || '-'}
                    </td>

                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                          i.status_penyampaian === 'Sudah Disampaikan'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {i.status_penyampaian === 'Sudah Disampaikan' ? (
                          <CheckCircle size={11} />
                        ) : (
                          <Clock size={11} />
                        )}
                        {i.status_penyampaian || 'Belum Disampaikan'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-slate-400 whitespace-nowrap text-[11px]">
                      {i.waktu_penyampaian
                        ? new Date(i.waktu_penyampaian).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                          })
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}