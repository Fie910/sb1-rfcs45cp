import { useEffect, useState, useMemo } from 'react';
import {
  Loader2,
  CalendarCheck,
  Users,
  ListFilter,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import type { PresensiWithSiswa, Kelas } from '@/types/database';

const SUMMARY_HEADERS = ['NISN', 'Nama Siswa', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total Pertemuan', '% Kehadiran'];
const LOG_HEADERS = ['Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'Status', 'Keterangan'];

interface StudentSummary {
  siswaId: string;
  nisn: string;
  nama: string;
  kelas: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  total: number;
  persentase: number;
}

export function RekapPresensiSiswaPage() {
  const { guru, isAdmin } = useAuth();

  // Data State
  const [list, setList] = useState<PresensiWithSiswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab & View Mode ('summary' | 'detail')
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

  // Filter States
  const [filterKelas, setFilterKelas] = useState('');
  const [filterJadwal, setFilterJadwal] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 1. Fetch Option Filters (Kelas & Jadwal KBM)
  useEffect(() => {
    const fetchFilters = async () => {
      // Fetch Kelas
      const { data: dataKelas, error: errKelas } = await supabase
        .from('kelas')
        .select('*')
        .order('nama_kelas');

      if (errKelas) console.error('Error fetching kelas:', errKelas);
      setKelasList((dataKelas as Kelas[]) || []);

      // Fetch Jadwal KBM
      let queryJadwal = supabase
        .from('jadwal_kbms')
        .select(`
          id,
          hari,
          guru_id,
          mata_pelajarans ( id, nama_mapel ),
          kelas ( id, nama_kelas )
        `);

      if (!isAdmin && guru?.id) {
        queryJadwal = queryJadwal.eq('guru_id', guru.id);
      }

      const { data: dataJadwal, error: errJadwal } = await queryJadwal;

      if (errJadwal) {
        console.error('Error fetching jadwal_kbms:', errJadwal);
        setJadwalList([]);
      } else {
        setJadwalList(dataJadwal || []);
      }
    };

    fetchFilters();
  }, [guru, isAdmin]);

  // 2. Fetch Data Presensi Berdasarkan Filter
  const fetchData = async () => {
    setLoading(true);

    let query = supabase
      .from('presensis')
      .select('*, siswas(id, nama_lengkap, nisn, kelas(id, nama_kelas)), gurus(id, nama_lengkap)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    if (!isAdmin && guru?.id) {
      query = query.eq('guru_id', guru.id);
    }

    if (filterJadwal) {
      query = query.eq('jadwal_kbm_id', filterJadwal);
    }

    if (filterKelas) {
      const { data: siswaIds } = await supabase
        .from('siswas')
        .select('id')
        .eq('kelas_id', filterKelas);

      if (siswaIds && siswaIds.length > 0) {
        query = query.in('siswa_id', siswaIds.map((s) => s.id));
      } else {
        setList([]);
        setLoading(false);
        return;
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching presensis:', error);
      setList([]);
    } else {
      setList((data as PresensiWithSiswa[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, filterKelas, filterJadwal, guru, isAdmin]);

  // 3. Kalkulasi Ringkasan Akumulasi Per Siswa
  const studentSummaries: StudentSummary[] = useMemo(() => {
    const summaryMap = new Map<string, StudentSummary>();

    list.forEach((p) => {
      const siswaId = p.siswa_id;
      if (!summaryMap.has(siswaId)) {
        summaryMap.set(siswaId, {
          siswaId,
          nisn: p.siswas?.nisn ?? '-',
          nama: p.siswas?.nama_lengkap ?? 'Siswa Tidak Ditemukan',
          kelas: p.siswas?.kelas?.nama_kelas ?? '-',
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
          total: 0,
          persentase: 0,
        });
      }

      const item = summaryMap.get(siswaId)!;
      if (p.status === 'Hadir') item.hadir++;
      else if (p.status === 'Sakit') item.sakit++;
      else if (p.status === 'Izin') item.izin++;
      else if (p.status === 'Alpa') item.alpa++;

      item.total++;
      item.persentase = Math.round((item.hadir / item.total) * 100);
    });

    return Array.from(summaryMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [list]);

  // 4. Data Rows untuk Export
  const exportRowsSummary = studentSummaries.map((s) => [
    s.nisn,
    s.nama,
    s.kelas,
    s.hadir,
    s.sakit,
    s.izin,
    s.alpa,
    s.total,
    `${s.persentase}%`,
  ]);

  const exportRowsLog = list.map((p) => [
    p.tanggal,
    p.siswas?.nisn ?? '-',
    p.siswas?.nama_lengkap ?? '-',
    p.siswas?.kelas?.nama_kelas ?? '-',
    p.status,
    p.keterangan ?? '-',
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER PAGE */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          <FileSpreadsheet className="text-indigo-400" size={28} />
          Rekap Presensi Siswa
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {isAdmin
            ? 'Rekapitulasi akumulasi dan jurnal presensi seluruh siswa'
            : 'Rekapitulasi kehadiran siswa berdasarkan jadwal KBM yang Anda ampu'}
        </p>
      </div>

      {/* FILTER CARD */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800/80 p-5 md:p-6 backdrop-blur-xl shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter Jadwal KBM */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" />
              Jadwal KBM
            </label>
            <select
              value={filterJadwal}
              onChange={(e) => setFilterJadwal(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-400">
                Semua Jadwal KBM {jadwalList.length > 0 ? `(${jadwalList.length})` : ''}
              </option>
              {jadwalList.map((j) => {
                const mapelName = j.mata_pelajarans?.nama_mapel ?? 'Mata Pelajaran';
                const kelasName = j.kelas?.nama_kelas ? ` - ${j.kelas.nama_kelas}` : '';
                const hariInfo = j.hari ? ` (${j.hari})` : '';

                return (
                  <option key={j.id} value={j.id} className="bg-slate-900 text-slate-100">
                    {`${mapelName}${kelasName}${hariInfo}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter Kelas */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Kelas
            </label>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-400">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id} className="bg-slate-900 text-slate-100">
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm font-mono [color-scheme:dark]"
            />
          </div>

          {/* Tanggal Selesai */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm font-mono [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* MAIN TABLE CONTAINER */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800/80 overflow-hidden backdrop-blur-xl shadow-xl">
        {/* TAB & EXPORT CONTROLS */}
        <div className="p-4 md:p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800/80">
            <button
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'summary'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Users size={16} />
              Ringkasan Per Siswa ({studentSummaries.length})
            </button>
            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'detail'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <ListFilter size={16} />
              Jurnal Log Presensi ({list.length})
            </button>
          </div>

          <ExportImportButtons
            filename={viewMode === 'summary' ? 'rekap_akumulasi_siswa' : 'jurnal_presensi_siswa'}
            title={viewMode === 'summary' ? 'Rekap Akumulasi Presensi Siswa' : 'Jurnal Log Presensi Siswa'}
            headers={viewMode === 'summary' ? SUMMARY_HEADERS : LOG_HEADERS}
            rows={viewMode === 'summary' ? exportRowsSummary : exportRowsLog}
            showImport={false}
          />
        </div>

        {/* TABEL CONTENT */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="animate-spin text-indigo-400" size={36} />
            </div>
          ) : viewMode === 'summary' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/80">
                <tr>
                  <th className="px-5 py-4">NISN</th>
                  <th className="px-5 py-4">Nama Siswa</th>
                  <th className="px-5 py-4">Kelas</th>
                  <th className="text-center px-3 py-4 text-emerald-400 bg-emerald-500/5">Hadir</th>
                  <th className="text-center px-3 py-4 text-amber-400 bg-amber-500/5">Sakit</th>
                  <th className="text-center px-3 py-4 text-blue-400 bg-blue-500/5">Izin</th>
                  <th className="text-center px-3 py-4 text-rose-400 bg-rose-500/5">Alpa</th>
                  <th className="text-center px-3 py-4">Total KBM</th>
                  <th className="text-center px-5 py-4">% Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {studentSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-500">
                      <CalendarCheck size={40} className="mx-auto mb-3 opacity-40 text-slate-400" />
                      <p className="text-base font-medium">Tidak ada data rekapitulasi presensi.</p>
                    </td>
                  </tr>
                ) : (
                  studentSummaries.map((s) => {
                    let badgeStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                    if (s.persentase < 75) badgeStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                    else if (s.persentase < 85) badgeStyle = 'bg-amber-500/15 text-amber-400 border-amber-500/30';

                    return (
                      <tr key={s.siswaId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 text-slate-400 font-mono text-xs">{s.nisn}</td>
                        <td className="px-5 py-4 font-bold text-slate-100">{s.nama}</td>
                        <td className="px-5 py-4 text-slate-300 font-medium">{s.kelas}</td>
                        <td className="px-3 py-4 text-center font-extrabold text-emerald-400 bg-emerald-500/5">
                          {s.hadir}
                        </td>
                        <td className="px-3 py-4 text-center font-extrabold text-amber-400 bg-amber-500/5">
                          {s.sakit}
                        </td>
                        <td className="px-3 py-4 text-center font-extrabold text-blue-400 bg-blue-500/5">
                          {s.izin}
                        </td>
                        <td className="px-3 py-4 text-center font-extrabold text-rose-400 bg-rose-500/5">
                          {s.alpa}
                        </td>
                        <td className="px-3 py-4 text-center font-bold text-slate-200">
                          {s.total}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${badgeStyle}`}>
                            {s.persentase}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/80">
                <tr>
                  {LOG_HEADERS.map((h) => (
                    <th key={h} className="px-5 py-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={LOG_HEADERS.length} className="text-center py-16 text-slate-500">
                      <CalendarCheck size={40} className="mx-auto mb-3 opacity-40 text-slate-400" />
                      <p className="text-base font-medium">Tidak ada log presensi.</p>
                    </td>
                  </tr>
                ) : (
                  list.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 text-slate-300 font-mono text-xs">{p.tanggal}</td>
                      <td className="px-5 py-4 text-slate-400 font-mono text-xs">{p.siswas?.nisn ?? '-'}</td>
                      <td className="px-5 py-4 font-bold text-slate-100">{p.siswas?.nama_lengkap ?? '-'}</td>
                      <td className="px-5 py-4 text-slate-300 font-medium">{p.siswas?.kelas?.nama_kelas ?? '-'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            p.status === 'Hadir'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : p.status === 'Sakit'
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : p.status === 'Izin'
                              ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                              : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400">{p.keterangan ?? '-'}</td>
                    </tr>
                   ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}