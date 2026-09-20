import { useEffect, useState, useCallback, useMemo, ChangeEvent } from 'react';
import {
  Package,
  Loader2,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Eye,
  X,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings,
  TrendingUp,
  DollarSign,
  Hash,
  MapPin,
  Calendar,
  Tag,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import type {
  InventarisSarprasWithRelations,
  KategoriSarpras,
  KondisiAset,
} from '@/types/database';
import { KONDISI_ASET } from '@/types/database';

// =============================================================================
// KONSTANTA
// =============================================================================

const MANAGER_ROLES = ['admin', 'kepala', 'wakil_kepala', 'sarpras'];

const SATUAN_OPTIONS = ['unit', 'buah', 'set', 'lusin', 'meter', 'kg', 'liter', 'paket'];

const SUMBER_DANA_OPTIONS = [
  'BOS',
  'Komite',
  'Hibah',
  'Yayasan',
  'Pemerintah Daerah',
  'CSR',
  'Lainnya',
];

// =============================================================================
// HELPER — KONDISI
// =============================================================================

function getKondisiBadge(kondisi: string): string {
  switch (kondisi) {
    case 'Baik':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Rusak Ringan':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Rusak Berat':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getKondisiIcon(kondisi: string) {
  switch (kondisi) {
    case 'Baik':
      return CheckCircle2;
    case 'Rusak Ringan':
      return AlertTriangle;
    case 'Rusak Berat':
      return XCircle;
    default:
      return Package;
  }
}

// =============================================================================
// HELPER — FORMAT
// =============================================================================

/** Format angka ke Rupiah tanpa desimal. */
function formatRupiah(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format angka ringkas (Rp 1,2 jt / Rp 12,5 M). */
function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// STATE INIT — FORM ASET
// =============================================================================

const emptyForm = {
  kode_aset: '',
  nama_aset: '',
  kategori_id: '',
  lokasi: '',
  jumlah: 1,
  satuan: 'unit',
  kondisi: 'Baik' as KondisiAset,
  tanggal_perolehan: '',
  sumber_dana: '',
  harga_perolehan: '',
  keterangan: '',
  foto_url: '',
};

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function InventarisSarprasPage() {
  const { guru } = useAuth();

  // Cek akses manager
  const isManager = useMemo(() => {
    if (!guru?.role) return false;
    return MANAGER_ROLES.includes(guru.role.toLowerCase());
  }, [guru?.role]);

  // =========================================================================
  // STATE — DATA
  // =========================================================================
  const [list, setList] = useState<InventarisSarprasWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriSarpras[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // =========================================================================
  // STATE — FILTER
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');
  const [filterLokasi, setFilterLokasi] = useState('');

  // =========================================================================
  // STATE — MODAL ASET
  // =========================================================================
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // =========================================================================
  // STATE — MODAL KATEGORI
  // =========================================================================
  const [kategoriModalOpen, setKategoriModalOpen] = useState(false);

  // =========================================================================
  // STATE — DETAIL & DELETE
  // =========================================================================
  const [detailItem, setDetailItem] = useState<InventarisSarprasWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventarisSarprasWithRelations | null>(null);

  // =========================================================================
  // FETCH DATA
  // =========================================================================
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [invRes, katRes] = await Promise.all([
        supabase
          .from('inventaris_sarpras')
          .select(`
            *,
            kategori:kategori_id (id, nama, icon)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('kategori_sarpras').select('*').order('nama'),
      ]);

      if (invRes.error) throw invRes.error;
      if (katRes.error) throw katRes.error;

      setList((invRes.data as InventarisSarprasWithRelations[]) || []);
      setKategoriList((katRes.data as KategoriSarpras[]) || []);
    } catch (err) {
      console.error('Gagal fetch inventaris:', err);
      showToast('error', 'Gagal memuat data inventaris');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka halaman Inventaris Sarpras',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================================
  // DERIVED — LIST UNIK LOKASI (untuk filter)
  // =========================================================================
  const lokasiOptions = useMemo(() => {
    const set = new Set<string>();
    list.forEach((item) => {
      if (item.lokasi) set.add(item.lokasi);
    });
    return Array.from(set).sort();
  }, [list]);

  // =========================================================================
  // DERIVED — FILTERED LIST
  // =========================================================================
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      // Filter kategori
      if (filterKategori && item.kategori_id !== filterKategori) return false;
      // Filter kondisi
      if (filterKondisi && item.kondisi !== filterKondisi) return false;
      // Filter lokasi
      if (filterLokasi && (item.lokasi || '') !== filterLokasi) return false;

      // Search
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.kode_aset.toLowerCase().includes(q) ||
        item.nama_aset.toLowerCase().includes(q) ||
        (item.lokasi || '').toLowerCase().includes(q) ||
        (item.kategori?.nama || '').toLowerCase().includes(q)
      );
    });
  }, [list, filterKategori, filterKondisi, filterLokasi, searchQuery]);

  // =========================================================================
  // DERIVED — KPI STATS
  // =========================================================================
  const stats = useMemo(() => {
    const totalAset = filteredList.length;
    const totalUnit = filteredList.reduce((sum, i) => sum + i.jumlah, 0);
    const baik = filteredList.filter((i) => i.kondisi === 'Baik').length;
    const rusakRingan = filteredList.filter((i) => i.kondisi === 'Rusak Ringan').length;
    const rusakBerat = filteredList.filter((i) => i.kondisi === 'Rusak Berat').length;
    const totalNilai = filteredList.reduce(
      (sum, i) => sum + (i.harga_perolehan || 0) * (i.jumlah || 0),
      0
    );

    return { totalAset, totalUnit, baik, rusakRingan, rusakBerat, totalNilai };
  }, [filteredList]);

  // =========================================================================
  // HANDLER — AUTO GENERATE KODE
  // =========================================================================
  const generateKodeAset = useCallback(() => {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const existingNumbers = list
      .map((i) => i.kode_aset)
      .filter((k) => k.startsWith(prefix))
      .map((k) => parseInt(k.replace(prefix, ''), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }, [list]);

  // =========================================================================
  // OPEN MODAL — CREATE / EDIT
  // =========================================================================
  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      kode_aset: generateKodeAset(),
      kategori_id: kategoriList[0]?.id || '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: InventarisSarprasWithRelations) => {
    setEditingId(item.id);
    setForm({
      kode_aset: item.kode_aset,
      nama_aset: item.nama_aset,
      kategori_id: item.kategori_id || '',
      lokasi: item.lokasi || '',
      jumlah: item.jumlah,
      satuan: item.satuan,
      kondisi: item.kondisi,
      tanggal_perolehan: item.tanggal_perolehan || '',
      sumber_dana: item.sumber_dana || '',
      harga_perolehan: item.harga_perolehan !== null ? String(item.harga_perolehan) : '',
      keterangan: item.keterangan || '',
      foto_url: item.foto_url || '',
    });
    setModalOpen(true);
  };

  // =========================================================================
  // HANDLER — SUBMIT ASET
  // =========================================================================
  const handleSave = async () => {
    // Validasi
    if (!form.kode_aset.trim()) {
      showToast('error', 'Kode aset wajib diisi');
      return;
    }
    if (!form.nama_aset.trim()) {
      showToast('error', 'Nama aset wajib diisi');
      return;
    }
    if (!form.kategori_id) {
      showToast('error', 'Kategori wajib dipilih');
      return;
    }
    if (form.jumlah < 0) {
      showToast('error', 'Jumlah tidak boleh negatif');
      return;
    }

    setSaving(true);

    const payload = {
      kode_aset: form.kode_aset.trim().toUpperCase(),
      nama_aset: form.nama_aset.trim(),
      kategori_id: form.kategori_id,
      lokasi: form.lokasi.trim() || null,
      jumlah: Number(form.jumlah),
      satuan: form.satuan,
      kondisi: form.kondisi,
      tanggal_perolehan: form.tanggal_perolehan || null,
      sumber_dana: form.sumber_dana.trim() || null,
      harga_perolehan: form.harga_perolehan ? Number(form.harga_perolehan) : null,
      keterangan: form.keterangan.trim() || null,
      foto_url: form.foto_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('inventaris_sarpras')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;

        showToast('success', 'Aset berhasil diperbarui');
        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.SARPRAS,
          targetId: editingId,
          deskripsi: `Update aset [${payload.kode_aset}] ${payload.nama_aset}`,
          metadata: { kondisi: payload.kondisi, jumlah: payload.jumlah },
        });
      } else {
        const { data: created, error } = await supabase
          .from('inventaris_sarpras')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;

        showToast('success', 'Aset berhasil ditambahkan');
        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.SARPRAS,
          targetId: created?.id,
          deskripsi: `Tambah aset [${payload.kode_aset}] ${payload.nama_aset}`,
          metadata: { kondisi: payload.kondisi, jumlah: payload.jumlah },
        });
      }

      setModalOpen(false);
      fetchData(false);
    } catch (err: any) {
      console.error('Gagal simpan aset:', err);
      if (err.message?.includes('unique') || err.code === '23505') {
        showToast('error', 'Kode aset sudah digunakan');
      } else {
        showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error tidak diketahui'));
      }
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // HANDLER — DELETE
  // =========================================================================
  const handleDelete = async () => {
    if (!deleteTarget) return;

    const infoAset = {
      id: deleteTarget.id,
      kode: deleteTarget.kode_aset,
      nama: deleteTarget.nama_aset,
    };

    try {
      const { error } = await supabase
        .from('inventaris_sarpras')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      showToast('success', 'Aset berhasil dihapus');
      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: infoAset.id,
        deskripsi: `Hapus aset [${infoAset.kode}] ${infoAset.nama}`,
      });

      fetchData(false);
    } catch (err: any) {
      console.error('Gagal hapus aset:', err);
      showToast('error', 'Gagal menghapus: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setDeleteTarget(null);
    }
  };

  // =========================================================================
  // EXPORT — EXCEL
  // =========================================================================
  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      showToast('error', 'Tidak ada data untuk diekspor');
      return;
    }

    const dataToExport = filteredList.map((item, idx) => ({
      No: idx + 1,
      'Kode Aset': item.kode_aset,
      'Nama Aset': item.nama_aset,
      Kategori: item.kategori?.nama || '-',
      Lokasi: item.lokasi || '-',
      Jumlah: item.jumlah,
      Satuan: item.satuan,
      Kondisi: item.kondisi,
      'Tanggal Perolehan': item.tanggal_perolehan || '-',
      'Sumber Dana': item.sumber_dana || '-',
      'Harga Satuan': item.harga_perolehan || 0,
      'Total Nilai': (item.harga_perolehan || 0) * item.jumlah,
      Keterangan: item.keterangan || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventaris');
    XLSX.writeFile(workbook, `Inventaris_Sarpras_${new Date().toISOString().slice(0, 10)}.xlsx`);

    showToast('success', 'File Excel berhasil diunduh');
    logActivity({
      aksi: 'EXPORT',
      modul: AUDIT_MODUL.SARPRAS,
      deskripsi: `Ekspor inventaris ke Excel (${filteredList.length} aset)`,
    });
  };

  // =========================================================================
  // EXPORT — PDF
  // =========================================================================
  const handleExportPDF = () => {
    if (filteredList.length === 0) {
      showToast('error', 'Tidak ada data untuk diekspor');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text('Laporan Inventaris Sarana & Prasarana', 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Aset: ${stats.totalAset} | Total Unit: ${stats.totalUnit}`, 14, 22);
    doc.text(
      `Nilai Total: ${formatRupiah(stats.totalNilai)} | Dicetak: ${new Date().toLocaleString('id-ID')}`,
      14,
      27
    );

    const tableColumn = [
      'No',
      'Kode',
      'Nama Aset',
      'Kategori',
      'Lokasi',
      'Jml',
      'Kondisi',
      'Tgl Perolehan',
      'Harga Satuan',
      'Total',
    ];

    const tableRows = filteredList.map((item, idx) => [
      idx + 1,
      item.kode_aset,
      item.nama_aset,
      item.kategori?.nama || '-',
      item.lokasi || '-',
      item.jumlah,
      item.kondisi,
      item.tanggal_perolehan || '-',
      formatRupiah(item.harga_perolehan),
      formatRupiah((item.harga_perolehan || 0) * item.jumlah),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 33,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Inventaris_Sarpras_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('success', 'File PDF berhasil diunduh');
    logActivity({
      aksi: 'EXPORT',
      modul: AUDIT_MODUL.SARPRAS,
      deskripsi: `Ekspor inventaris ke PDF (${filteredList.length} aset)`,
    });
  };

  // =========================================================================
  // RESET FILTER
  // =========================================================================
  const resetFilter = () => {
    setSearchQuery('');
    setFilterKategori('');
    setFilterKondisi('');
    setFilterLokasi('');
  };

  const hasActiveFilter =
    !!searchQuery.trim() || !!filterKategori || !!filterKondisi || !!filterLokasi;

  // =========================================================================
  // RENDER — LOADING
  // =========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={40} />
        <p className="text-slate-400 text-xs font-medium">Memuat data inventaris...</p>
      </div>
    );
  }

  // =========================================================================
  // RENDER — MAIN
  // =========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Package size={26} />
            </div>
            Inventaris Sarana & Prasarana
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Daftar aset sekolah — pencatatan, kondisi, dan nilai inventaris
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredList.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet size={15} /> Excel
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredList.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-600/20"
          >
            <FileText size={15} /> PDF
          </button>

          {isManager && (
            <>
              <button
                onClick={() => setKategoriModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 font-bold text-xs transition-all cursor-pointer"
              >
                <Settings size={15} /> Kategori
              </button>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Plus size={15} /> Tambah Aset
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Jenis Aset
            </span>
          </div>
          <p className="text-2xl font-black text-indigo-400">{stats.totalAset}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{stats.totalUnit} unit total</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kondisi Baik
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400">{stats.baik}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Siap pakai</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Rusak Ringan
            </span>
          </div>
          <p className="text-2xl font-black text-amber-400">{stats.rusakRingan}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Perlu perbaikan</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={14} className="text-rose-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Rusak Berat
            </span>
          </div>
          <p className="text-2xl font-black text-rose-400">{stats.rusakBerat}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Perlu penggantian</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-teal-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Nilai Total
            </span>
          </div>
          <p className="text-xl font-black text-teal-400">{formatRupiahShort(stats.totalNilai)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{formatRupiah(stats.totalNilai)}</p>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" />
            Filter & Pencarian
          </div>
          {hasActiveFilter && (
            <button
              onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode / nama / lokasi..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <SearchableSelect
            options={[
              { value: '', label: 'Semua Kategori' },
              ...kategoriList.map((k) => ({ value: k.id, label: k.nama })),
            ]}
            value={filterKategori}
            onChange={setFilterKategori}
            placeholder="Semua Kategori"
            searchPlaceholder="Cari kategori..."
            emptyMessage="Kategori tidak ditemukan"
          />

          <select
            value={filterKondisi}
            onChange={(e) => setFilterKondisi(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            <option value="">Semua Kondisi</option>
            {KONDISI_ASET.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <select
            value={filterLokasi}
            onChange={(e) => setFilterLokasi(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            <option value="">Semua Lokasi</option>
            {lokasiOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Menampilkan <span className="text-indigo-400 font-bold">{filteredList.length}</span>{' '}
          dari {list.length} aset
        </div>
      </div>

      {/* TABEL ASET */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredList.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500">
            <Package size={44} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold text-slate-300 text-sm">
              {hasActiveFilter ? 'Tidak ada aset sesuai filter' : 'Belum ada aset terdaftar'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {isManager
                ? 'Klik "Tambah Aset" untuk mulai mencatat inventaris'
                : 'Hubungi Divisi Sarpras untuk menambahkan data aset'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Aset</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Lokasi</th>
                  <th className="py-3 px-4 text-center">Jumlah</th>
                  <th className="py-3 px-4 text-center">Kondisi</th>
                  <th className="py-3 px-4 text-right">Nilai Total</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredList.map((item) => {
                  const KondisiIcon = getKondisiIcon(item.kondisi);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-indigo-400 font-bold text-[11px]">
                        {item.kode_aset}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100 max-w-xs">
                        <div className="truncate" title={item.nama_aset}>
                          {item.nama_aset}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {item.kategori ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                            {item.kategori.nama}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] italic">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {item.lokasi || <span className="text-slate-600 italic">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">
                        {item.jumlah} <span className="text-slate-500 font-normal">{item.satuan}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getKondisiBadge(
                            item.kondisi
                          )}`}
                        >
                          <KondisiIcon size={10} />
                          {item.kondisi}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatRupiah((item.harga_perolehan || 0) * item.jumlah)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Lihat Detail"
                          >
                            <Eye size={14} />
                          </button>
                          {isManager && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL FORM ASET */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Aset Inventaris' : 'Tambah Aset Baru'}
        size="lg"
      >
        <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
          {/* Kode & Kategori */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Hash size={12} /> Kode Aset *
              </label>
              <input
                type="text"
                value={form.kode_aset}
                onChange={(e) => setForm({ ...form, kode_aset: e.target.value.toUpperCase() })}
                placeholder="INV-2026-001"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-indigo-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Tag size={12} /> Kategori *
              </label>
              <SearchableSelect
                options={kategoriList.map((k) => ({ value: k.id, label: k.nama }))}
                value={form.kategori_id}
                onChange={(v) => setForm({ ...form, kategori_id: v })}
                placeholder="Pilih kategori..."
                searchPlaceholder="Cari kategori..."
                emptyMessage="Kategori tidak ditemukan"
              />
            </div>
          </div>

          {/* Nama & Lokasi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Nama Aset *
              </label>
              <input
                type="text"
                value={form.nama_aset}
                onChange={(e) => setForm({ ...form, nama_aset: e.target.value })}
                placeholder="Contoh: Laptop ASUS X441"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <MapPin size={12} /> Lokasi
              </label>
              <input
                type="text"
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                placeholder="Contoh: Ruang Guru / Lab Komputer 1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Jumlah, Satuan, Kondisi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Jumlah *
              </label>
              <input
                type="number"
                min={0}
                value={form.jumlah}
                onChange={(e) => setForm({ ...form, jumlah: Number(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Satuan
              </label>
              <select
                value={form.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm cursor-pointer focus:outline-none focus:border-indigo-500"
              >
                {SATUAN_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Kondisi
              </label>
              <select
                value={form.kondisi}
                onChange={(e) =>
                  setForm({ ...form, kondisi: e.target.value as KondisiAset })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm cursor-pointer focus:outline-none focus:border-indigo-500"
              >
                {KONDISI_ASET.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tanggal Perolehan & Sumber Dana */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Calendar size={12} /> Tanggal Perolehan
              </label>
              <input
                type="date"
                value={form.tanggal_perolehan}
                onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm cursor-pointer focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Sumber Dana
              </label>
              <select
                value={form.sumber_dana}
                onChange={(e) => setForm({ ...form, sumber_dana: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm cursor-pointer focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Pilih Sumber Dana --</option>
                {SUMBER_DANA_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Harga */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <DollarSign size={12} /> Harga Satuan (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={form.harga_perolehan}
              onChange={(e) => setForm({ ...form, harga_perolehan: e.target.value })}
              placeholder="Contoh: 5000000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono"
            />
            {form.harga_perolehan && Number(form.harga_perolehan) > 0 && (
              <p className="text-[11px] text-teal-400 mt-1">
                Total: {formatRupiah(Number(form.harga_perolehan) * form.jumlah)} untuk {form.jumlah} {form.satuan}
              </p>
            )}
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Keterangan / Catatan
            </label>
            <textarea
              rows={3}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Catatan tambahan tentang aset ini (opsional)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Menyimpan...
                </>
              ) : editingId ? (
                'Simpan Perubahan'
              ) : (
                'Tambah Aset'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL DETAIL */}
      {detailItem && (
        <Modal
          open={!!detailItem}
          onClose={() => setDetailItem(null)}
          title="Detail Aset"
          size="md"
        >
          <div className="space-y-4 pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-indigo-400">
                    {detailItem.kode_aset}
                  </p>
                  <h3 className="font-bold text-slate-100 text-base">
                    {detailItem.nama_aset}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getKondisiBadge(
                    detailItem.kondisi
                  )}`}
                >
                  {detailItem.kondisi}
                </span>
                {detailItem.kategori && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                    {detailItem.kategori.nama}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Jumlah</p>
                <p className="font-bold text-slate-200">
                  {detailItem.jumlah} {detailItem.satuan}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Lokasi</p>
                <p className="font-bold text-slate-200">{detailItem.lokasi || '-'}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Tanggal Perolehan
                </p>
                <p className="font-bold text-slate-200">
                  {formatDate(detailItem.tanggal_perolehan)}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Sumber Dana
                </p>
                <p className="font-bold text-slate-200">{detailItem.sumber_dana || '-'}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Harga Satuan
                </p>
                <p className="font-bold text-slate-200">
                  {formatRupiah(detailItem.harga_perolehan)}
                </p>
              </div>
              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-emerald-500 mb-1">
                  Nilai Total
                </p>
                <p className="font-bold text-emerald-400">
                  {formatRupiah((detailItem.harga_perolehan || 0) * detailItem.jumlah)}
                </p>
              </div>
            </div>

            {detailItem.keterangan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Keterangan
                </p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {detailItem.keterangan}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL KATEGORI */}
      <KategoriManagerModal
        open={kategoriModalOpen}
        onClose={() => setKategoriModalOpen(false)}
        kategoriList={kategoriList}
        onChanged={() => fetchData(false)}
      />

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Aset"
        message={`Yakin ingin menghapus aset "${deleteTarget?.nama_aset}" (${deleteTarget?.kode_aset})? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN — KATEGORI MANAGER MODAL
// =============================================================================

type KategoriManagerProps = {
  open: boolean;
  onClose: () => void;
  kategoriList: KategoriSarpras[];
  onChanged: () => void;
};

function KategoriManagerModal({
  open,
  onClose,
  kategoriList,
  onChanged,
}: KategoriManagerProps) {
  const [newNama, setNewNama] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNama, setEditingNama] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<KategoriSarpras | null>(null);

  const handleAdd = async () => {
    if (!newNama.trim()) {
      showToast('error', 'Nama kategori wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('kategori_sarpras')
        .insert({ nama: newNama.trim() });
      if (error) throw error;

      showToast('success', 'Kategori ditambahkan');
      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.SARPRAS,
        deskripsi: `Tambah kategori sarpras: ${newNama.trim()}`,
      });

      setNewNama('');
      onChanged();
    } catch (err: any) {
      if (err.code === '23505') {
        showToast('error', 'Kategori ini sudah ada');
      } else {
        showToast('error', 'Gagal menambah: ' + (err.message || 'Error'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingNama.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('kategori_sarpras')
        .update({ nama: editingNama.trim() })
        .eq('id', id);
      if (error) throw error;

      showToast('success', 'Kategori diperbarui');
      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: id,
        deskripsi: `Update kategori sarpras: ${editingNama.trim()}`,
      });

      setEditingId(null);
      setEditingNama('');
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal update: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('kategori_sarpras')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      showToast('success', 'Kategori dihapus');
      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus kategori sarpras: ${deleteTarget.nama}`,
      });

      setDeleteTarget(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Kategori Sarpras" size="md">
        <div className="space-y-4 pt-1">
          {/* Form tambah */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tambah Kategori Baru
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Contoh: Alat Musik"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !newNama.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah
              </button>
            </div>
          </div>

          {/* List kategori */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Daftar Kategori ({kategoriList.length})
            </p>
            {kategoriList.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Belum ada kategori.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {kategoriList.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3"
                  >
                    {editingId === k.id ? (
                      <>
                        <input
                          type="text"
                          value={editingNama}
                          onChange={(e) => setEditingNama(e.target.value)}
                          autoFocus
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/50 text-slate-200 text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => handleUpdate(k.id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingNama('');
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium text-slate-200">
                          {k.nama}
                        </span>
                        <button
                          onClick={() => {
                            setEditingId(k.id);
                            setEditingNama(k.nama);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(k)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${deleteTarget?.nama}"? Aset dengan kategori ini akan menjadi tanpa kategori.`}
      />
    </>
  );
}