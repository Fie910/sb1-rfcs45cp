import { useEffect, useState, useMemo } from 'react';
import { 
  Loader2, 
  UserCheck, 
  Calendar, 
  Filter, 
  FileText, 
  BarChart3, 
  Users, 
  BookOpen 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import type { Guru } from '@/types/database';

interface PresensiGuruPiketRekap {
  id: number;
  tanggal: string;
  guru_id: string;
  status: string;
  catatan: string | null;
  gurus?: {
    id: string;
    nama_lengkap: string;
  };
  jadwal_kbmjps?: {
    id: number;
    jam_ke: number;
    kelas?: {
      id: number;
      nama_kelas: string;
    };
    mata_pelajarans?: {
      id: number;
      nama_mapel: string;
    };
  };
}

interface RekapSummaryRow {
  key: string;
  guruNama: string;
  mapelNama?: string;
  total: number;
  hadir: number;
  sakitTugas: number;
  sakitTanpaTugas: number;
  izinTugas: number;
  izinTanpaTugas: number;
  dinasTugas: number;
  dinasTanpaTugas: number;
  alpa: number;
  persentase: number;
}

const DETAIL_HEADERS = [
  'Nama Guru',
  'Tanggal',
  'Mata Pelajaran',
  'Jam Ke',
  'Kelas',
  'Status Kehadiran',
  'Catatan',
];

export function RekapPresensiGuruPage() {
  const [activeTab, setActiveTab] = useState<'detail' | 'rekap'>('detail');
  const [rekapGroupBy, setRekapGroupBy] = useState<'guru' | 'guru_mapel'>('guru');

  const [list, setList] = useState<PresensiGuruPiketRekap[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGuru, setFilterGuru] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gurus')
        .select('*')
        .order('nama_lengkap', { ascending: true });
      setGurus((data as Guru[]) || []);
      fetchData();
    })();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('presensi_guru_piket')
      .select(`
        id,
        tanggal,
        status,
        catatan,
        guru_id,
        gurus:guru_id (id, nama_lengkap),
        jadwal_kbmjps:jadwal_kbmjp_id (
          id,
          jam_ke,
          kelas:kelas_id (id, nama_kelas),
          mata_pelajarans:mapel_id (id, nama_mapel)
        )
      `)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    if (filterGuru) {
      query = query.eq('guru_id', filterGuru);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching presensi piket rekap:', error);
      setList([]);
    } else {
      setList((data as unknown as PresensiGuruPiketRekap[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterGuru, startDate, endDate]);

  const guruMap = useMemo(() => new Map(gurus.map((g) => [g.id, g.nama_lengkap])), [gurus]);

  const formatStatus = (statusStr: string) => {
    if (!statusStr) return '-';
    return statusStr
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusBadge = (statusStr: string) => {
    const status = (statusStr || '').toLowerCase();
    if (status === 'hadir') {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (status.startsWith('sakit')) {
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
    if (status.startsWith('izin')) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    if (status.startsWith('dinas')) {
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
    if (status === 'alpa' || status === 'tanpa_keterangan') {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // Processing detail rows for export
  const detailRows = list.map((a) => [
    a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-',
    a.tanggal,
    a.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? '-',
    a.jadwal_kbmjps?.jam_ke ? `Jam Ke-${a.jadwal_kbmjps.jam_ke}` : '-',
    a.jadwal_kbmjps?.kelas?.nama_kelas ?? '-',
    formatStatus(a.status),
    a.catatan ?? '-',
  ]);

  // Aggregation for Tab Rekapitulasi
  const rekapSummary = useMemo(() => {
    const map = new Map<string, RekapSummaryRow>();

    list.forEach((item) => {
      const guruNama = item.gurus?.nama_lengkap ?? guruMap.get(item.guru_id) ?? 'Guru Tanpa Nama';
      const mapelNama = item.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? 'Mata Pelajaran Tidak Ada';

      const key = rekapGroupBy === 'guru' ? item.guru_id : `${item.guru_id}_${mapelNama}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          guruNama,
          mapelNama: rekapGroupBy === 'guru_mapel' ? mapelNama : undefined,
          total: 0,
          hadir: 0,
          sakitTugas: 0,
          sakitTanpaTugas: 0,
          izinTugas: 0,
          izinTanpaTugas: 0,
          dinasTugas: 0,
          dinasTanpaTugas: 0,
          alpa: 0,
          persentase: 0,
        });
      }

      const row = map.get(key)!;
      row.total += 1;

      const st = (item.status || '').toLowerCase();
      const cat = (item.catatan || '').toLowerCase();
      const hasTugas = cat.includes('tugas') && !cat.includes('tanpa tugas') && !cat.includes('tidak ada tugas');

      switch (st) {
        case 'hadir':
          row.hadir += 1;
          break;
        case 'sakit_tugas':
          row.sakitTugas += 1;
          break;
        case 'sakit_tanpa_tugas':
          row.sakitTanpaTugas += 1;
          break;
        case 'izin_tugas':
          row.izinTugas += 1;
          break;
        case 'izin_tanpa_tugas':
          row.izinTanpaTugas += 1;
          break;
        case 'dinas_tugas':
          row.dinasTugas += 1;
          break;
        case 'dinas_tanpa_tugas':
          row.dinasTanpaTugas += 1;
          break;
        case 'alpa':
        case 'tanpa_keterangan':
          row.alpa += 1;
          break;
        case 'sakit':
          if (hasTugas) row.sakitTugas += 1; else row.sakitTanpaTugas += 1;
          break;
        case 'izin':
          if (hasTugas) row.izinTugas += 1; else row.izinTanpaTugas += 1;
          break;
        case 'dinas':
        case 'dinas_luar':
          if (hasTugas) row.dinasTugas += 1; else row.dinasTanpaTugas += 1;
          break;
        default:
          break;
      }
    });

    const results = Array.from(map.values()).map((row) => {
      row.persentase = row.total > 0 ? Math.round((row.hadir / row.total) * 100) : 0;
      return row;
    });

    return results.sort((a, b) => a.guruNama.localeCompare(b.guruNama));
  }, [list, rekapGroupBy, guruMap]);

  const rekapHeaders = rekapGroupBy === 'guru_mapel' 
    ? ['Nama Guru', 'Mata Pelajaran', 'Total JP', 'Hadir', 'Sakit (+Tugas)', 'Sakit (-Tugas)', 'Izin (+Tugas)', 'Izin (-Tugas)', 'Dinas (+Tugas)', 'Dinas (-Tugas)', 'Alpa', '% Kehadiran']
    : ['Nama Guru', 'Total JP', 'Hadir', 'Sakit (+Tugas)', 'Sakit (-Tugas)', 'Izin (+Tugas)', 'Izin (-Tugas)', 'Dinas (+Tugas)', 'Dinas (-Tugas)', 'Alpa', '% Kehadiran'];

  const rekapRows = rekapSummary.map((r) => [
    r.guruNama,
    ...(rekapGroupBy === 'guru_mapel' ? [r.mapelNama ?? '-'] : []),
    r.total,
    r.hadir,
    r.sakitTugas,
    r.sakitTanpaTugas,
    r.izinTugas,
    r.izinTanpaTugas,
    r.dinasTugas,
    r.dinasTanpaTugas,
    r.alpa,
    `${r.persentase}%`,
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          <UserCheck className="text-indigo-400" size={28} />
          Rekap Presensi Guru (Piket)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Rekapitulasi riwayat & statistik kehadiran guru per jam pelajaran dari Guru Piket
        </p>
      </div>

      {/* Filter Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={14} className="text-indigo-400" /> Filter Guru
            </label>
            <select
              value={filterGuru}
              onChange={(e) => setFilterGuru(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-200">
                Semua Guru
              </option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900 text-slate-200">
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" /> Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium cursor-pointer"
            />
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" /> Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'detail'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText size={18} />
          Detail Record ({list.length})
        </button>
        <button
          onClick={() => setActiveTab('rekap')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'rekap'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 size={18} />
          Rekapitulasi Persentase
        </button>
      </div>

      {/* Tab 1: Detail Record */}
      {activeTab === 'detail' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText size={20} className="text-indigo-400" />
              Data Presensi Guru ({list.length} Record)
            </h2>
            <ExportImportButtons
              filename="rekap_presensi_guru_piket"
              title="Rekap Presensi Guru (Piket)"
              headers={DETAIL_HEADERS}
              rows={detailRows}
              showImport={false}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  {DETAIL_HEADERS.map((h, idx) => (
                    <th
                      key={h}
                      className={`p-4 whitespace-nowrap ${
                        idx === 0
                          ? 'sticky left-0 z-20 bg-slate-950 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]'
                          : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={DETAIL_HEADERS.length} className="text-center py-16">
                      <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                      <span className="text-xs text-slate-400">Memuat data rekap presensi...</span>
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={DETAIL_HEADERS.length} className="text-center py-16 text-slate-500">
                      <UserCheck size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                      <p className="font-semibold text-slate-400">Tidak ada data presensi guru piket ditemukan.</p>
                      <p className="text-xs text-slate-500 mt-1">Coba ubah filter nama guru atau rentang tanggal.</p>
                    </td>
                  </tr>
                ) : (
                  list.map((a) => {
                    const guruNama = a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
                    const mapelNama = a.jadwal_kbmjps?.mata_pelajarans?.nama_mapel ?? '-';
                    const jamKe = a.jadwal_kbmjps?.jam_ke ? `Jam Ke-${a.jadwal_kbmjps.jam_ke}` : '-';
                    const kelasNama = a.jadwal_kbmjps?.kelas?.nama_kelas ?? '-';

                    return (
                      <tr key={a.id} className="group hover:bg-slate-800/30 transition-colors text-slate-200">
                        {/* Frozen Column: Nama Guru */}
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                          {guruNama}
                        </td>
                        <td className="p-4 whitespace-nowrap font-medium text-slate-300">{a.tanggal}</td>
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">{mapelNama}</td>
                        <td className="p-4 whitespace-nowrap text-slate-400">{jamKe}</td>
                        <td className="p-4 whitespace-nowrap text-slate-300">{kelasNama}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(
                              a.status
                            )}`}
                          >
                            {formatStatus(a.status)}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs max-w-xs truncate">{a.catatan ?? '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Rekapitulasi Persentase */}
      {activeTab === 'rekap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-400" />
                Statistik Kehadiran Guru
              </h2>

              {/* Grouping Toggle */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
                <button
                  onClick={() => setRekapGroupBy('guru')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    rekapGroupBy === 'guru'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users size={13} />
                  Per Guru
                </button>
                <button
                  onClick={() => setRekapGroupBy('guru_mapel')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    rekapGroupBy === 'guru_mapel'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen size={13} />
                  Per Guru & Mapel
                </button>
              </div>
            </div>

            <ExportImportButtons
              filename={`rekap_persentase_kehadiran_${rekapGroupBy}`}
              title="Rekapitulasi Persentase Kehadiran Guru"
              headers={rekapHeaders}
              rows={rekapRows}
              showImport={false}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  {/* Frozen Header Column: Nama Guru */}
                  <th className="p-4 whitespace-nowrap sticky left-0 z-20 bg-slate-950 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    Nama Guru
                  </th>
                  {rekapGroupBy === 'guru_mapel' && <th className="p-4 whitespace-nowrap">Mata Pelajaran</th>}
                  <th className="p-4 whitespace-nowrap text-center">Total JP</th>
                  <th className="p-4 whitespace-nowrap text-center text-emerald-400">Hadir</th>
                  <th className="p-4 whitespace-nowrap text-center text-blue-400">Sakit (+Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-sky-400">Sakit (-Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-400">Izin (+Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-300">Izin (-Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-400">Dinas (+Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-purple-300">Dinas (-Tugas)</th>
                  <th className="p-4 whitespace-nowrap text-center text-rose-400">Alpa</th>
                  <th className="p-4 whitespace-nowrap text-center">% Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={rekapHeaders.length} className="text-center py-16">
                      <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                      <span className="text-xs text-slate-400">Mengalkulasi statistik kehadiran...</span>
                    </td>
                  </tr>
                ) : rekapSummary.length === 0 ? (
                  <tr>
                    <td colSpan={rekapHeaders.length} className="text-center py-16 text-slate-500">
                      <BarChart3 size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                      <p className="font-semibold text-slate-400">Tidak ada rekapitulasi data tersedia.</p>
                      <p className="text-xs text-slate-500 mt-1">Coba sesuaikan rentang tanggal pencarian.</p>
                    </td>
                  </tr>
                ) : (
                  rekapSummary.map((r) => (
                    <tr key={r.key} className="group hover:bg-slate-800/30 transition-colors text-slate-200">
                      {/* Frozen Column: Nama Guru */}
                      <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                        {r.guruNama}
                      </td>
                      {rekapGroupBy === 'guru_mapel' && (
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">{r.mapelNama ?? '-'}</td>
                      )}
                      <td className="p-4 whitespace-nowrap text-center font-semibold text-slate-300">{r.total}</td>
                      <td className="p-4 whitespace-nowrap text-center font-bold text-emerald-400">{r.hadir}</td>
                      <td className="p-4 whitespace-nowrap text-center text-blue-400 font-semibold">{r.sakitTugas}</td>
                      <td className="p-4 whitespace-nowrap text-center text-sky-400 font-semibold">{r.sakitTanpaTugas}</td>
                      <td className="p-4 whitespace-nowrap text-center text-amber-400 font-semibold">{r.izinTugas}</td>
                      <td className="p-4 whitespace-nowrap text-center text-amber-300 font-semibold">{r.izinTanpaTugas}</td>
                      <td className="p-4 whitespace-nowrap text-center text-purple-400 font-semibold">{r.dinasTugas}</td>
                      <td className="p-4 whitespace-nowrap text-center text-purple-300 font-semibold">{r.dinasTanpaTugas}</td>
                      <td className="p-4 whitespace-nowrap text-center text-rose-400 font-semibold">{r.alpa}</td>
                      <td className="p-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                r.persentase >= 85
                                  ? 'bg-emerald-500'
                                  : r.persentase >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${r.persentase}%` }}
                            />
                          </div>
                          <span
                            className={`font-extrabold text-xs ${
                              r.persentase >= 85
                                ? 'text-emerald-400'
                                : r.persentase >= 70
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {r.persentase}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}