import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Filter,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  School,
  History,
  Percent,
  Search,
  Users,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';

interface PresensiJoined {
  id: number;
  tanggal: string;
  status_kehadiran: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  keterangan: string | null;
  created_at: string;
  siswas: {
    nama_lengkap: string;
    jenis_kelamin: 'L' | 'P';
    nisn: string;
    kelas: {
      id: number;
      nama_kelas: string;
    } | null;
  } | null;
}

interface KelasOption {
  id: number;
  nama_kelas: string;
}

interface RekapSiswa {
  nisn: string;
  nama_lengkap: string;
  kelas: string;
  jenis_kelamin: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  total: number;
  persentaseHadir: number;
}

const getTodayWIB = (): string => {
  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfMonthWIB = (): string => {
  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const formatDateWIB = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
};

export function RekapPresensiKesiswaanPage() {
  const [activeTab, setActiveTab] = useState<'riwayat' | 'persentase'>('riwayat');
  const [tanggalMulai, setTanggalMulai] = useState<string>(getStartOfMonthWIB());
  const [tanggalSelesai, setTanggalSelesai] = useState<string>(getTodayWIB());
  const [kelasFilter, setKelasFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [list, setList] = useState<PresensiJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PresensiJoined | null>(null);

  useEffect(() => {
    const fetchKelas = async () => {
      const { data } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas');
      if (data) setKelasList(data);
    };
    fetchKelas();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('presensi_siswa_kesiswaans')
      .select('*, siswas!inner(nama_lengkap, jenis_kelamin, nisn, kelas:kelas_id(id, nama_kelas))')
      .order('tanggal', { ascending: false });

    if (tanggalMulai) {
      query = query.gte('tanggal', tanggalMulai);
    }

    if (tanggalSelesai) {
      query = query.lte('tanggal', tanggalSelesai);
    }

    if (kelasFilter) {
      query = query.eq('siswas.kelas_id', kelasFilter);
    }

    if (statusFilter && activeTab === 'riwayat') {
      query = query.eq('status_kehadiran', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      showToast('error', 'Gagal memuat rekapitulasi: ' + error.message);
    } else {
      setList(data as unknown as PresensiJoined[]);
    }
    setLoading(false);
  }, [tanggalMulai, tanggalSelesai, kelasFilter, statusFilter, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('presensi_siswa_kesiswaans')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      showToast('error', 'Gagal menghapus data: ' + error.message);
    } else {
      showToast('success', 'Catatan presensi berhasil dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  const totalRecords = list.length;
  const totalHadir = list.filter((i) => i.status_kehadiran === 'Hadir').length;
  const totalSakit = list.filter((i) => i.status_kehadiran === 'Sakit').length;
  const totalIzin = list.filter((i) => i.status_kehadiran === 'Izin').length;
  const totalAlpa = list.filter((i) => i.status_kehadiran === 'Alpa').length;

  const rataRataHadir = totalRecords > 0 ? Math.round((totalHadir / totalRecords) * 100) : 0;

  const rekapPerSiswa = useMemo(() => {
    const map = new Map<string, RekapSiswa>();

    list.forEach((item) => {
      if (!item.siswas) return;
      const key = item.siswas.nisn || item.siswas.nama_lengkap;
      const existing = map.get(key) || {
        nisn: item.siswas.nisn || '-',
        nama_lengkap: item.siswas.nama_lengkap,
        kelas: item.siswas.kelas?.nama_kelas || '-',
        jenis_kelamin: item.siswas.jenis_kelamin || '-',
        hadir: 0,
        sakit: 0,
        izin: 0,
        alpa: 0,
        total: 0,
        persentaseHadir: 0,
      };

      if (item.status_kehadiran === 'Hadir') existing.hadir += 1;
      else if (item.status_kehadiran === 'Sakit') existing.sakit += 1;
      else if (item.status_kehadiran === 'Izin') existing.izin += 1;
      else if (item.status_kehadiran === 'Alpa') existing.alpa += 1;

      existing.total += 1;
      existing.persentaseHadir = Math.round((existing.hadir / existing.total) * 100);
      map.set(key, existing);
    });

    let result = Array.from(map.values());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.nama_lengkap.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q) ||
          s.kelas.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
  }, [list, searchQuery]);

  const filteredRiwayatList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.siswas?.nama_lengkap.toLowerCase().includes(q) ||
        item.siswas?.nisn.toLowerCase().includes(q) ||
        item.siswas?.kelas?.nama_kelas.toLowerCase().includes(q)
    );
  }, [list, searchQuery]);

  // Fungsi Ekspor Excel (.xlsx)
  const exportToExcel = () => {
    if (activeTab === 'riwayat') {
      if (filteredRiwayatList.length === 0) {
        showToast('error', 'Tidak ada data riwayat untuk diekspor.');
        return;
      }
      const dataToExport = filteredRiwayatList.map((item) => ({
        'Tanggal (WIB)': item.tanggal,
        'NISN': item.siswas?.nisn || '-',
        'Nama Siswa': item.siswas?.nama_lengkap || '-',
        'Kelas': item.siswas?.kelas?.nama_kelas || '-',
        'L/P': item.siswas?.jenis_kelamin || '-',
        'Status Kehadiran': item.status_kehadiran,
        'Keterangan': item.keterangan || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Presensi');
      XLSX.writeFile(workbook, `Rekap_Riwayat_Presensi_${tanggalMulai}_sd_${tanggalSelesai}.xlsx`);
    } else {
      if (rekapPerSiswa.length === 0) {
        showToast('error', 'Tidak ada data rekap persentase untuk diekspor.');
        return;
      }
      const dataToExport = rekapPerSiswa.map((s, idx) => ({
        'No': idx + 1,
        'NISN': s.nisn,
        'Nama Siswa': s.nama_lengkap,
        'Kelas': s.kelas,
        'L/P': s.jenis_kelamin,
        'Hadir': s.hadir,
        'Sakit': s.sakit,
        'Izin': s.izin,
        'Alpa': s.alpa,
        'Total Hari': s.total,
        '% Kehadiran': `${s.persentaseHadir}%`,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Persentase');
      XLSX.writeFile(workbook, `Rekap_Persentase_Presensi_${tanggalMulai}_sd_${tanggalSelesai}.xlsx`);
    }
    showToast('success', 'File Excel berhasil diunduh');
  };

  // Fungsi Ekspor PDF (.pdf)
  const exportToPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    if (activeTab === 'riwayat') {
      if (filteredRiwayatList.length === 0) {
        showToast('error', 'Tidak ada data riwayat untuk diekspor.');
        return;
      }

      doc.setFontSize(14);
      doc.text('Laporan Riwayat Presensi Siswa', 14, 15);
      doc.setFontSize(10);
      doc.text(`Periode: ${tanggalMulai} s.d. ${tanggalSelesai}`, 14, 22);

      const tableColumn = ['Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'L/P', 'Status', 'Keterangan'];
      const tableRows = filteredRiwayatList.map((item) => [
        item.tanggal,
        item.siswas?.nisn || '-',
        item.siswas?.nama_lengkap || '-',
        item.siswas?.kelas?.nama_kelas || '-',
        item.siswas?.jenis_kelamin || '-',
        item.status_kehadiran,
        item.keterangan || '-',
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`Rekap_Riwayat_Presensi_${tanggalMulai}_sd_${tanggalSelesai}.pdf`);
    } else {
      if (rekapPerSiswa.length === 0) {
        showToast('error', 'Tidak ada data rekap persentase untuk diekspor.');
        return;
      }

      doc.setFontSize(14);
      doc.text('Laporan Rekap Persentase Kehadiran Siswa', 14, 15);
      doc.setFontSize(10);
      doc.text(`Periode: ${tanggalMulai} s.d. ${tanggalSelesai}`, 14, 22);

      const tableColumn = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'L/P', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total', '% Hadir'];
      const tableRows = rekapPerSiswa.map((s, idx) => [
        idx + 1,
        s.nisn,
        s.nama_lengkap,
        s.kelas,
        s.jenis_kelamin,
        s.hadir,
        s.sakit,
        s.izin,
        s.alpa,
        s.total,
        `${s.persentaseHadir}%`,
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`Rekap_Persentase_Presensi_${tanggalMulai}_sd_${tanggalSelesai}.pdf`);
    }
    showToast('success', 'File PDF berhasil diunduh');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 min-h-screen text-slate-100">
      {/* Title Header */}
      <div className="border-b border-slate-800/80 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3 text-white">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
            <FileSpreadsheet size={26} />
          </div>
          Rekapitulasi Presensi Siswa (Kesiswaan)
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Laporan rekapitulasi harian dan persentase tingkat kehadiran siswa
        </p>
      </div>

      {/* Tab Navigasi & Tombol Ekspor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <History size={16} />
            Riwayat Kehadiran
          </button>
          <button
            onClick={() => setActiveTab('persentase')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'persentase'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Percent size={16} />
            Rekap Persentase Kehadiran
          </button>
        </div>

        {/* Grup Tombol Ekspor Excel & PDF */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            Ekspor Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
          >
            <FileText size={15} />
            Ekspor PDF
          </button>
        </div>
      </div>

      {/* Glassmorphic Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Hadir</p>
            <p className="text-xl font-black text-slate-100">{totalHadir}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Sakit</p>
            <p className="text-xl font-black text-slate-100">{totalSakit}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Izin</p>
            <p className="text-xl font-black text-slate-100">{totalIzin}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
            <XCircle size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Alpa</p>
            <p className="text-xl font-black text-slate-100">{totalAlpa}</p>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl shadow-black/20 flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <Percent size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Rata-Rata Hadir</p>
            <p className="text-xl font-black text-indigo-300">{rataRataHadir}%</p>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-2xl shadow-black/40 space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
          <Filter size={15} className="text-indigo-400" />
          Filter Data Presensi
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <School size={13} /> Filter Kelas
            </label>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer backdrop-blur-md"
            >
              <option value="">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'riwayat' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Filter size={13} /> Filter Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer backdrop-blur-md"
              >
                <option value="">Semua Status</option>
                <option value="Hadir">Hadir</option>
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Alpa">Alpa</option>
              </select>
            </div>
          ) : (
            <div className="opacity-50">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                Status Filter
              </label>
              <input
                disabled
                value="Persentase Kumulatif"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950/40 border border-slate-800/40 text-slate-500 text-xs cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Search size={13} /> Cari Siswa
            </label>
            <input
              type="text"
              placeholder="Cari Nama / NISN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/40">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        ) : activeTab === 'riwayat' ? (
          /* TAB 1: RIWAYAT KEHADIRAN */
          filteredRiwayatList.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-400">
              <Calendar size={36} className="mx-auto mb-2 text-slate-600" />
              <p className="font-bold text-slate-200 text-xs">Tidak ada data presensi.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Sesuaikan kriteria filter tanggal, kelas, atau nama siswa Anda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">Tanggal (WIB)</th>
                    <th className="py-4 px-5">NISN</th>
                    <th className="py-4 px-5">Nama Siswa</th>
                    <th className="py-4 px-5">Kelas</th>
                    <th className="py-4 px-5">L/P</th>
                    <th className="py-4 px-5">Status</th>
                    <th className="py-4 px-5">Keterangan</th>
                    <th className="py-4 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                  {filteredRiwayatList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-slate-300">
                        {formatDateWIB(item.tanggal)}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">
                        {item.siswas?.nisn || '-'}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-100">
                        {item.siswas?.nama_lengkap || '-'}
                      </td>
                      <td className="py-3.5 px-5">{item.siswas?.kelas?.nama_kelas || '-'}</td>
                      <td className="py-3.5 px-5">{item.siswas?.jenis_kelamin || '-'}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                            item.status_kehadiran === 'Hadir'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : item.status_kehadiran === 'Sakit'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : item.status_kehadiran === 'Izin'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {item.status_kehadiran}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">{item.keterangan || '-'}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                          title="Hapus Record"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: REKAP PERSENTASE PER SISWA */
          rekapPerSiswa.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-400">
              <Users size={36} className="mx-auto mb-2 text-slate-600" />
              <p className="font-bold text-slate-200 text-xs">Data ringkasan tidak ditemukan.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Belum ada data presensi yang sesuai dengan rentang tanggal atau filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">No</th>
                    <th className="py-4 px-5">NISN</th>
                    <th className="py-4 px-5">Nama Siswa</th>
                    <th className="py-4 px-5">Kelas</th>
                    <th className="py-4 px-5">L/P</th>
                    <th className="py-4 px-5 text-center text-emerald-400">Hadir</th>
                    <th className="py-4 px-5 text-center text-amber-400">Sakit</th>
                    <th className="py-4 px-5 text-center text-blue-400">Izin</th>
                    <th className="py-4 px-5 text-center text-rose-400">Alpa</th>
                    <th className="py-4 px-5 text-center">Total Hari</th>
                    <th className="py-4 px-5 text-right">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                  {rekapPerSiswa.map((s, idx) => {
                    const pct = s.persentaseHadir;
                    let badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                    if (pct < 75) {
                      badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                    } else if (pct < 85) {
                      badgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                    }

                    return (
                      <tr key={s.nisn + idx} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-5 text-slate-500">{idx + 1}</td>
                        <td className="py-3.5 px-5 font-mono text-slate-400">{s.nisn}</td>
                        <td className="py-3.5 px-5 font-bold text-slate-100">{s.nama_lengkap}</td>
                        <td className="py-3.5 px-5">{s.kelas}</td>
                        <td className="py-3.5 px-5">{s.jenis_kelamin}</td>
                        <td className="py-3.5 px-5 text-center font-bold text-emerald-400">
                          {s.hadir}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-amber-400">
                          {s.sakit}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-blue-400">
                          {s.izin}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-rose-400">
                          {s.alpa}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-slate-300">
                          {s.total}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${badgeBg}`}
                          >
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Presensi"
        message={`Hapus catatan presensi untuk "${deleteTarget?.siswas?.nama_lengkap}"?`}
      />
    </div>
  );
}