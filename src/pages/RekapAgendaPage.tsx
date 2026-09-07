import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Loader2, 
  NotebookPen, 
  Calendar, 
  Filter, 
  FileText, 
  BarChart3, 
  Users, 
  BookOpen,
  Search,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import type { AgendaGuruWithRelations, Guru } from '@/types/database';

interface RekapAgendaSummaryRow {
  key: string;
  guruNama: string;
  mapelNama?: string;
  totalJP: number;
  hadirJP: number;
  izinJP: number;
  sakitJP: number;
  alpaJP: number;
  terlambatJP: number;
  persentase: number;
}

const DETAIL_HEADERS = [
  'Nama Guru',
  'Mata Pelajaran',
  'Tanggal',
  'Kelas',
  'Catatan Materi',
  'Hadir (JP)',
  'Izin (JP)',
  'Sakit (JP)',
  'Alpa (JP)',
  'Terlambat (JP)',
];

// Helper: Konversi jam ke menit
const parseTimeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

// Helper Utama: Ambil tahun, bulan, dan tanggal berdasarkan zona waktu WIB (Asia/Jakarta)
const getWIBDateParts = (): { year: number; month: number; day: number } => {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  
  return { year, month, day };
};

// Helper: Tanggal 1 bulan berjalan (YYYY-MM-01) zona WIB
const getFirstDayOfMonth = (): string => {
  const { year, month } = getWIBDateParts();
  const monthStr = String(month).padStart(2, '0');
  return `${year}-${monthStr}-01`;
};

// Helper: Tanggal terakhir bulan berjalan (YYYY-MM-DD) zona WIB
const getLastDayOfMonth = (): string => {
  const { year, month } = getWIBDateParts();
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');
  const lastDayStr = String(lastDay).padStart(2, '0');
  return `${year}-${monthStr}-${lastDayStr}`;
};

export function RekapAgendaPage() {
  const [activeTab, setActiveTab] = useState<'detail' | 'rekap'>('detail');
  const [rekapGroupBy, setRekapGroupBy] = useState<'guru' | 'guru_mapel'>('guru');

  const [list, setList] = useState<AgendaGuruWithRelations[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [filterGuru, setFilterGuru] = useState('');
  const [filterMapel, setFilterMapel] = useState('');

  // Default tanggal otomatis terisi bulan berjalan (WIB)
  const [startDate, setStartDate] = useState(getFirstDayOfMonth);
  const [endDate, setEndDate] = useState(getLastDayOfMonth);

  // Ambil daftar guru saat komponen pertama kali di-mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gurus')
        .select('*')
        .order('nama_lengkap', { ascending: true });
      setGurus((data as Guru[]) || []);
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      let query = supabase
        .from('agenda_gurus')
        .select(`
          *,
          gurus (id, nama_lengkap),
          jadwal_kbms (
            id,
            waktu_mulai,
            waktu_selesai,
            kelas (id, nama_kelas),
            mata_pelajarans (id, nama_mapel)
          )
        `);

      if (startDate) {
        query = query.gte('tanggal', startDate);
      }
      if (endDate) {
        query = query.lte('tanggal', endDate);
      }
      if (filterGuru) {
        query = query.eq('guru_id', filterGuru);
      }

      query = query.order('tanggal', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching agenda:', error);
        setErrorMessage(error.message);
        setList([]);
      } else {
        let filtered = (data as unknown as AgendaGuruWithRelations[]) || [];
        
        if (filterMapel.trim() !== '') {
          filtered = filtered.filter((a) => {
            const mapelNama = a.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '';
            return mapelNama.toLowerCase().includes(filterMapel.toLowerCase());
          });
        }
        
        setList(filtered);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterGuru, filterMapel, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const guruMap = useMemo(() => new Map(gurus.map((g) => [g.id, g.nama_lengkap])), [gurus]);

  const calculateAgendaJP = (item: AgendaGuruWithRelations) => {
    const kbm = item.jadwal_kbms;
    
    let totalMenit = 0;
    if (kbm?.waktu_mulai && kbm?.waktu_selesai) {
      const startMin = parseTimeToMinutes(kbm.waktu_mulai);
      const endMin = parseTimeToMinutes(kbm.waktu_selesai);
      totalMenit = Math.max(0, endMin - startMin);
    }

    if (totalMenit <= 0) totalMenit = 30;

    const status = (item.status_kehadiran || '').toLowerCase();
    const menitTerlambat = item.menit_terlambat || 0;
    const baseAlpaJP = item.alpa_jam_pelajaran || 0;

    let hadirJP = 0;
    let izinJP = 0;
    let sakitJP = 0;
    let alpaJP = 0;
    
    // Penghitungan JP Terlambat dari total menit keterlambatan (1 JP = 30 menit)
    const terlambatJP = Math.round(menitTerlambat / 30);

    if (status.includes('izin')) {
      izinJP = Math.round(totalMenit / 30);
    } else if (status.includes('sakit')) {
      sakitJP = Math.round(totalMenit / 30);
    } else if (status === 'alpa') {
      alpaJP = baseAlpaJP > 0 ? baseAlpaJP : Math.round(totalMenit / 30);
    } else {
      const sisaMenit = Math.max(0, totalMenit - menitTerlambat);
      hadirJP = Math.ceil(sisaMenit / 30);
      // Alpa hanya mengambil nilai murni alpa_jam_pelajaran tanpa akumulasi keterlambatan
      alpaJP = baseAlpaJP; 
    }

    const totalJPCalculated = hadirJP + izinJP + sakitJP + alpaJP;

    return {
      totalMenit,
      totalJP: totalJPCalculated > 0 ? totalJPCalculated : Math.round(totalMenit / 30),
      hadirJP,
      izinJP,
      sakitJP,
      alpaJP,
      terlambatJP,
    };
  };

  const detailRows = list.map((a) => {
    const guruNama = a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
    const mapelNama = a.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-';
    const kelasNama = a.jadwal_kbms?.kelas?.nama_kelas ?? '-';
    const jpStats = calculateAgendaJP(a);

    return [
      guruNama,
      mapelNama,
      a.tanggal,
      kelasNama,
      a.catatan_materi ?? '-',
      jpStats.hadirJP,
      jpStats.izinJP,
      jpStats.sakitJP,
      jpStats.alpaJP,
      jpStats.terlambatJP,
    ];
  });

  const rekapSummary = useMemo(() => {
    const map = new Map<string, RekapAgendaSummaryRow>();

    list.forEach((item) => {
      const guruNama = item.gurus?.nama_lengkap ?? guruMap.get(item.guru_id) ?? 'Guru Tanpa Nama';
      const mapelNama = item.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? 'Tanpa Mapel';

      const key = rekapGroupBy === 'guru' ? item.guru_id : `${item.guru_id}_${mapelNama}`;
      const jpStats = calculateAgendaJP(item);

      if (!map.has(key)) {
        map.set(key, {
          key,
          guruNama,
          mapelNama: rekapGroupBy === 'guru_mapel' ? mapelNama : undefined,
          totalJP: 0,
          hadirJP: 0,
          izinJP: 0,
          sakitJP: 0,
          alpaJP: 0,
          terlambatJP: 0,
          persentase: 0,
        });
      }

      const row = map.get(key)!;
      row.totalJP += jpStats.totalJP;
      row.hadirJP += jpStats.hadirJP;
      row.izinJP += jpStats.izinJP;
      row.sakitJP += jpStats.sakitJP;
      row.alpaJP += jpStats.alpaJP;
      row.terlambatJP += jpStats.terlambatJP;
    });

    const results = Array.from(map.values()).map((row) => {
      row.persentase = row.totalJP > 0 ? Math.round((row.hadirJP / row.totalJP) * 100) : 0;
      return row;
    });

    return results.sort((a, b) => a.guruNama.localeCompare(b.guruNama));
  }, [list, rekapGroupBy, guruMap]);

  const rekapHeaders = rekapGroupBy === 'guru_mapel'
    ? ['Nama Guru', 'Mata Pelajaran', 'Total JP', 'Hadir (JP)', 'Izin (JP)', 'Sakit (JP)', 'Alpa (JP)', 'Terlambat (JP)', '% Kehadiran']
    : ['Nama Guru', 'Total JP', 'Hadir (JP)', 'Izin (JP)', 'Sakit (JP)', 'Alpa (JP)', 'Terlambat (JP)', '% Kehadiran'];

  const rekapRows = rekapSummary.map((r) => [
    r.guruNama,
    ...(rekapGroupBy === 'guru_mapel' ? [r.mapelNama ?? '-'] : []),
    r.totalJP,
    r.hadirJP,
    r.izinJP,
    r.sakitJP,
    r.alpaJP,
    r.terlambatJP,
    `${r.persentase}%`,
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          <NotebookPen className="text-indigo-400" size={28} />
          Rekap Agenda Guru
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Rekapitulasi agenda, catatan materi, dan kalkulasi JP jam pelajaran kehadiran guru
        </p>
      </div>

      {/* Pesan Error jika Query Supabase Gagal */}
      {errorMessage && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-300 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="text-rose-400 shrink-0" />
          <div>
            <p className="font-bold">Gagal mengambil data dari server:</p>
            <p className="text-xs text-rose-400/80">{errorMessage}</p>
          </div>
        </div>
      )}

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

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search size={14} className="text-indigo-400" /> Mata Pelajaran
            </label>
            <input
              type="text"
              value={filterMapel}
              onChange={(e) => setFilterMapel(e.target.value)}
              placeholder="Cari mata pelajaran..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium"
            />
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
          Rekapitulasi Kehadiran
        </button>
      </div>

      {/* Tab 1: Detail Record */}
      {activeTab === 'detail' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText size={20} className="text-indigo-400" />
              Data Agenda ({list.length} Record)
            </h2>
            <ExportImportButtons
              filename="rekap_agenda_guru"
              title="Rekap Agenda Guru"
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
                          : idx >= 5
                          ? 'text-center'
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
                      <span className="text-xs text-slate-400">Memuat data agenda guru...</span>
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={DETAIL_HEADERS.length} className="text-center py-16 text-slate-500">
                      <NotebookPen size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                      <p className="font-semibold text-slate-400">Tidak ada data agenda guru ditemukan.</p>
                      <p className="text-xs text-slate-500 mt-1">Coba hapus filter tanggal atau sesuaikan pencarian.</p>
                    </td>
                  </tr>
                ) : (
                  list.map((a) => {
                    const guruNama = a.gurus?.nama_lengkap ?? guruMap.get(a.guru_id) ?? '-';
                    const mapelNama = a.jadwal_kbms?.mata_pelajarans?.nama_mapel ?? '-';
                    const kelasNama = a.jadwal_kbms?.kelas?.nama_kelas ?? '-';
                    const jpStats = calculateAgendaJP(a);

                    return (
                      <tr key={a.id} className="group hover:bg-slate-800/30 transition-colors text-slate-200">
                        <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                          {guruNama}
                        </td>
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">{mapelNama}</td>
                        <td className="p-4 whitespace-nowrap font-medium text-slate-300">{a.tanggal}</td>
                        <td className="p-4 whitespace-nowrap text-slate-300">{kelasNama}</td>
                        <td className="p-4 text-slate-400 text-xs max-w-xs truncate" title={a.catatan_materi ?? ''}>
                          {a.catatan_materi ?? '-'}
                        </td>
                        <td className="p-4 whitespace-nowrap text-center font-bold text-emerald-400">{jpStats.hadirJP}</td>
                        <td className="p-4 whitespace-nowrap text-center font-semibold text-amber-400">{jpStats.izinJP}</td>
                        <td className="p-4 whitespace-nowrap text-center font-semibold text-blue-400">{jpStats.sakitJP}</td>
                        <td className="p-4 whitespace-nowrap text-center font-semibold text-rose-400">{jpStats.alpaJP}</td>
                        <td className="p-4 whitespace-nowrap text-center font-semibold text-orange-400">{jpStats.terlambatJP}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Rekapitulasi Kehadiran */}
      {activeTab === 'rekap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-wrap gap-4 bg-slate-950/40">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-400" />
                Statistik Kehadiran (Jam Pelajaran)
              </h2>

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
              filename={`rekap_agenda_persentase_${rekapGroupBy}`}
              title="Rekapitulasi Kehadiran Agenda Guru"
              headers={rekapHeaders}
              rows={rekapRows}
              showImport={false}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4 whitespace-nowrap sticky left-0 z-20 bg-slate-950 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    Nama Guru
                  </th>
                  {rekapGroupBy === 'guru_mapel' && <th className="p-4 whitespace-nowrap">Mata Pelajaran</th>}
                  <th className="p-4 whitespace-nowrap text-center">Total JP</th>
                  <th className="p-4 whitespace-nowrap text-center text-emerald-400">Hadir (JP)</th>
                  <th className="p-4 whitespace-nowrap text-center text-amber-400">Izin (JP)</th>
                  <th className="p-4 whitespace-nowrap text-center text-blue-400">Sakit (JP)</th>
                  <th className="p-4 whitespace-nowrap text-center text-rose-400">Alpa (JP)</th>
                  <th className="p-4 whitespace-nowrap text-center text-orange-400">Terlambat (JP)</th>
                  <th className="p-4 whitespace-nowrap text-center">% Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={rekapHeaders.length} className="text-center py-16">
                      <Loader2 className="animate-spin text-indigo-400 mx-auto mb-2" size={28} />
                      <span className="text-xs text-slate-400">Mengalkulasi rekapitulasi agenda...</span>
                    </td>
                  </tr>
                ) : rekapSummary.length === 0 ? (
                  <tr>
                    <td colSpan={rekapHeaders.length} className="text-center py-16 text-slate-500">
                      <BarChart3 size={40} className="mx-auto mb-2 opacity-40 text-slate-600" />
                      <p className="font-semibold text-slate-400">Tidak ada data rekapitulasi tersedia.</p>
                      <p className="text-xs text-slate-500 mt-1">Coba sesuaikan filter atau rentang tanggal pencarian.</p>
                    </td>
                  </tr>
                ) : (
                  rekapSummary.map((r) => (
                    <tr key={r.key} className="group hover:bg-slate-800/30 transition-colors text-slate-200">
                      <td className="p-4 whitespace-nowrap font-bold text-slate-100 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                        {r.guruNama}
                      </td>
                      {rekapGroupBy === 'guru_mapel' && (
                        <td className="p-4 whitespace-nowrap text-indigo-300 font-semibold">{r.mapelNama ?? '-'}</td>
                      )}
                      <td className="p-4 whitespace-nowrap text-center font-semibold text-slate-300">{r.totalJP}</td>
                      <td className="p-4 whitespace-nowrap text-center font-bold text-emerald-400">{r.hadirJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-amber-400 font-semibold">{r.izinJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-blue-400 font-semibold">{r.sakitJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-rose-400 font-semibold">{r.alpaJP}</td>
                      <td className="p-4 whitespace-nowrap text-center text-orange-400 font-semibold">{r.terlambatJP}</td>
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