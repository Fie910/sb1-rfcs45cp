import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ScrollText,
  Loader2,
  Filter,
  Search,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  FileText,
  Calendar,
  User,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { getTodayDateWib } from '@/utils/date';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import type { AuditLog } from '@/types/database';

const PAGE_SIZE = 50;

// Kategori aksi untuk badge warna
const AKSI_OPTIONS = [
  { value: '', label: 'Semua Aksi' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGOUT', label: 'LOGOUT' },
  { value: 'EXPORT', label: 'EXPORT' },
  { value: 'VIEW', label: 'VIEW' },
];

// Label modul untuk dropdown (subset yang sering dipakai)
const MODUL_OPTIONS = [
  { value: '', label: 'Semua Modul' },
  { value: AUDIT_MODUL.AUTH, label: 'Auth' },
  { value: AUDIT_MODUL.SURAT, label: 'Surat' },
  { value: AUDIT_MODUL.DISPOSISI, label: 'Disposisi' },
  { value: AUDIT_MODUL.IZIN, label: 'Izin' },
  { value: AUDIT_MODUL.TODO, label: 'Todo / SOP' },
  { value: AUDIT_MODUL.BUKU_TAMU, label: 'Buku Tamu' },
  { value: AUDIT_MODUL.PENGUMUMAN, label: 'Pengumuman' },
  { value: AUDIT_MODUL.KEGIATAN, label: 'Kegiatan' },
  { value: AUDIT_MODUL.GURU, label: 'Guru' },
  { value: AUDIT_MODUL.SISWA, label: 'Siswa' },
  { value: AUDIT_MODUL.KELAS, label: 'Kelas' },
  { value: AUDIT_MODUL.HAK_AKSES, label: 'Hak Akses' },
  { value: AUDIT_MODUL.HARI_LIBUR, label: 'Hari Libur' },
];

// Helper warna badge per aksi
function getAksiBadgeStyle(aksi: string): string {
  switch (aksi) {
    case 'CREATE':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'UPDATE':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'LOGIN':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'LOGOUT':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    case 'EXPORT':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'VIEW':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// Helper format datetime WIB
function formatDateTimeWib(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Helper: tanggal 30 hari lalu (WIB)
function getDefaultStartDate(): string {
  const today = getTodayDateWib();
  const date = new Date(`${today}T00:00:00+07:00`);
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export function AuditLogPage() {
  const { guru } = useAuth();

  // Data state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filter state
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate);
  const [endDate, setEndDate] = useState<string>(getTodayDateWib());
  const [filterUser, setFilterUser] = useState('');
  const [filterModul, setFilterModul] = useState('');
  const [filterAksi, setFilterAksi] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // List guru untuk dropdown filter
  const [guruOptions, setGuruOptions] = useState<{ id: string; nama_lengkap: string }[]>([]);

  // Detail modal
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  // Export loading
  const [exporting, setExporting] = useState(false);

  // =========================================================================
  // Fetch daftar guru (sekali)
  // =========================================================================
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gurus')
        .select('id, nama_lengkap')
        .order('nama_lengkap');
      setGuruOptions(data ?? []);
    })();
  }, []);

  // =========================================================================
  // Fetch logs — dengan filter + pagination
  // =========================================================================
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00+07:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59+07:00`);
      }
      if (filterUser) {
        query = query.eq('user_id', filterUser);
      }
      if (filterModul) {
        query = query.eq('modul', filterModul);
      }
      if (filterAksi) {
        query = query.eq('aksi', filterAksi);
      }
      if (searchQuery.trim()) {
        query = query.ilike('deskripsi', `%${searchQuery.trim()}%`);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs((data as AuditLog[]) || []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Gagal fetch audit logs:', err);
      showToast('error', 'Gagal memuat audit log');
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterUser, filterModul, filterAksi, searchQuery, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset halaman ke 1 saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, filterUser, filterModul, filterAksi, searchQuery]);

  // =========================================================================
  // Log VIEW saat membuka halaman (audit-ception!)
  // =========================================================================
  useEffect(() => {
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka halaman Audit Log',
    });
  }, []);

  // =========================================================================
  // Pagination derived
  // =========================================================================
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  // =========================================================================
  // Export — fetch SEMUA data dengan filter aktif (bukan per halaman)
  // =========================================================================
  const fetchAllForExport = async (): Promise<AuditLog[]> => {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00+07:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59+07:00`);
    if (filterUser) query = query.eq('user_id', filterUser);
    if (filterModul) query = query.eq('modul', filterModul);
    if (filterAksi) query = query.eq('aksi', filterAksi);
    if (searchQuery.trim()) query = query.ilike('deskripsi', `%${searchQuery.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data as AuditLog[]) || [];
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const allLogs = await fetchAllForExport();
      if (allLogs.length === 0) {
        showToast('error', 'Tidak ada data untuk diekspor');
        return;
      }

      const dataToExport = allLogs.map((log, index) => ({
        No: index + 1,
        Waktu: formatDateTimeWib(log.created_at),
        User: log.user_nama || '-',
        Role: log.user_role || '-',
        Aksi: log.aksi,
        Modul: log.modul,
        'Target ID': log.target_id || '-',
        Deskripsi: log.deskripsi,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Log');
      XLSX.writeFile(workbook, `Audit_Log_${startDate}_sd_${endDate}.xlsx`);

      await logActivity({
        aksi: 'EXPORT',
        modul: AUDIT_MODUL.AUTH,
        deskripsi: `Ekspor Audit Log ke Excel (${allLogs.length} baris)`,
      });

      showToast('success', 'File Excel berhasil diunduh');
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal mengekspor Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const allLogs = await fetchAllForExport();
      if (allLogs.length === 0) {
        showToast('error', 'Tidak ada data untuk diekspor');
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.text('Laporan Audit Log', 14, 15);
      doc.setFontSize(10);
      doc.text(`Periode: ${startDate} s.d. ${endDate}`, 14, 22);
      doc.text(`Total: ${allLogs.length} entri`, 14, 27);
      doc.text(`Dicetak: ${formatDateTimeWib(new Date().toISOString())} WIB`, 14, 32);

      const tableColumn = ['No', 'Waktu', 'User', 'Aksi', 'Modul', 'Deskripsi'];
      const tableRows = allLogs.map((log, index) => [
        index + 1,
        formatDateTimeWib(log.created_at),
        log.user_nama || '-',
        log.aksi,
        log.modul,
        log.deskripsi.length > 60 ? log.deskripsi.slice(0, 60) + '...' : log.deskripsi,
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 38,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
        },
      });

      doc.save(`Audit_Log_${startDate}_sd_${endDate}.pdf`);

      await logActivity({
        aksi: 'EXPORT',
        modul: AUDIT_MODUL.AUTH,
        deskripsi: `Ekspor Audit Log ke PDF (${allLogs.length} baris)`,
      });

      showToast('success', 'File PDF berhasil diunduh');
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal mengekspor PDF');
    } finally {
      setExporting(false);
    }
  };

  // =========================================================================
  // Reset filter
  // =========================================================================
  const resetFilter = () => {
    setStartDate(getDefaultStartDate());
    setEndDate(getTodayDateWib());
    setFilterUser('');
    setFilterModul('');
    setFilterAksi('');
    setSearchQuery('');
  };

  const hasActiveFilter =
    !!filterUser || !!filterModul || !!filterAksi || !!searchQuery.trim();

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 min-h-screen text-slate-100">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3 text-white">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <ScrollText size={26} />
            </div>
            Audit Log
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Rekam jejak aktivitas pengguna — untuk transparansi dan akuntabilitas tata kelola
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-600/20"
          >
            <FileText size={15} />
            PDF
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={15} className="text-indigo-400" />
            Filter Audit Log
          </div>
          {hasActiveFilter && (
            <button
              onClick={resetFilter}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <X size={13} />
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} /> Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} /> Tanggal Selesai
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User size={13} /> Filter User
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'Semua User' },
                ...guruOptions.map((g) => ({ value: g.id, label: g.nama_lengkap })),
              ]}
              value={filterUser}
              onChange={setFilterUser}
              placeholder="Semua User"
              searchPlaceholder="Cari nama guru..."
              emptyMessage="User tidak ditemukan"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Activity size={13} /> Filter Aksi
            </label>
            <select
              value={filterAksi}
              onChange={(e) => setFilterAksi(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer"
            >
              {AKSI_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Filter size={13} /> Filter Modul
            </label>
            <select
              value={filterModul}
              onChange={(e) => setFilterModul(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80 cursor-pointer"
            >
              {MODUL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Search size={13} /> Cari Deskripsi
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kata kunci dalam deskripsi log..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs focus:outline-none focus:border-indigo-500/80"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total: <span className="text-indigo-400 font-bold">{totalCount}</span> entri
          {hasActiveFilter && ' (terfilter)'}
        </div>
      </div>

      {/* TABEL LOG */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-400">
            <AlertCircle size={36} className="mx-auto mb-2 text-slate-600" />
            <p className="font-bold text-slate-200 text-sm">Tidak ada data audit log</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Coba ubah rentang tanggal atau reset filter.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 whitespace-nowrap">Waktu</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">User</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Aksi</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Modul</th>
                    <th className="py-3.5 px-4">Deskripsi</th>
                    <th className="py-3.5 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                        {formatDateTimeWib(log.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">{log.user_nama || '-'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {log.user_role || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getAksiBadgeStyle(
                            log.aksi
                          )}`}
                        >
                          {log.aksi}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                          {log.modul}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-slate-300 line-clamp-2 leading-relaxed">
                          {log.deskripsi}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setDetailLog(log)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-950/40">
                <div className="text-xs text-slate-500">
                  Halaman <strong className="text-slate-300">{page}</strong> dari{' '}
                  <strong className="text-slate-300">{totalPages}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!canPrev}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!canNext}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Berikutnya
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DETAIL */}
      {detailLog && (
        <Modal
          open={!!detailLog}
          onClose={() => setDetailLog(null)}
          title="Detail Audit Log"
          size="lg"
        >
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Waktu
                </p>
                <p className="text-sm font-mono text-slate-200">
                  {formatDateTimeWib(detailLog.created_at)} WIB
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  User
                </p>
                <p className="text-sm font-semibold text-slate-200">
                  {detailLog.user_nama || '-'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Role: {detailLog.user_role || '-'}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Aksi
                </p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${getAksiBadgeStyle(
                    detailLog.aksi
                  )}`}
                >
                  {detailLog.aksi}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Modul
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
                  {detailLog.modul}
                </span>
              </div>
            </div>

            {detailLog.target_id && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Target ID
                </p>
                <p className="text-xs font-mono text-indigo-300 break-all">
                  {detailLog.target_id}
                </p>
              </div>
            )}

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Deskripsi
              </p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {detailLog.deskripsi}
              </p>
            </div>

            {detailLog.metadata && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Metadata
                </p>
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(detailLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDetailLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}