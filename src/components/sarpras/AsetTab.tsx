// src/components/sarpras/AsetTab.tsx
// Tab utama: manajemen aset inventaris Sarpras + cetak label QR + regenerate QR token.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  X,
  Package,
  Pencil,
  Trash2,
  Settings,
  MapPin,
  LayoutGrid,
  List,
  AlertTriangle,
  CheckCircle2,
  Printer,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalAsetSarpras } from './ModalAsetSarpras';
import { KategoriManagerModal } from './KategoriManagerModal';
import { LokasiManagerModal } from './LokasiManagerModal';
import { CetakLabelModal } from './CetakLabelModal';
import {
  getKondisiBadge,
  getStatusAsetBadge,
  formatRupiah,
  formatRupiahShort,
  INPUT_CLASS,
} from './shared';
import type {
  InventarisSarprasWithRelations,
  InventarisLokasi,
  KategoriSarpras,
  Guru,
} from '@/types/database';

export function AsetTab() {
  const [asetList, setAsetList] = useState<InventarisSarprasWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriSarpras[]>([]);
  const [lokasiList, setLokasiList] = useState<InventarisLokasi[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterLokasi, setFilterLokasi] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Selection (untuk cetak label)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cetakModalOpen, setCetakModalOpen] = useState(false);

  // Modal
  const [modalAsetOpen, setModalAsetOpen] = useState(false);
  const [editingAset, setEditingAset] =
    useState<InventarisSarprasWithRelations | null>(null);
  const [modalKategoriOpen, setModalKategoriOpen] = useState(false);
  const [modalLokasiOpen, setModalLokasiOpen] = useState(false);

  // Modal delete
  const [deleteTarget, setDeleteTarget] =
    useState<InventarisSarprasWithRelations | null>(null);

  // Modal regenerate QR token
  const [regenerateTarget, setRegenerateTarget] =
    useState<InventarisSarprasWithRelations | null>(null);

  // ============================
  // FETCH
  // ============================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [asetRes, kategoriRes, lokasiRes, guruRes] = await Promise.all([
        supabase
          .from('inventaris_sarpras')
          .select(`
            *,
            kategori:kategori_id (id, nama),
            lokasi_detail:lokasi_id (id, nama, tipe),
            pic:pic_id (id, nama_lengkap)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('kategori_sarpras').select('*').order('nama'),
        supabase.from('inventaris_lokasi').select('*').order('nama'),
        supabase
          .from('gurus')
          .select('id, nip, nama_lengkap, email, role')
          .order('nama_lengkap'),
      ]);

      if (asetRes.error) throw asetRes.error;

      setAsetList((asetRes.data as unknown as InventarisSarprasWithRelations[]) || []);
      setKategoriList((kategoriRes.data as KategoriSarpras[]) || []);
      setLokasiList((lokasiRes.data as InventarisLokasi[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);

      // Reset selection supaya tidak ada ID hantu
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat data aset: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ============================
  // FILTERED
  // ============================
  const filteredList = useMemo(() => {
    return asetList.filter((a) => {
      if (filterKategori && a.kategori_id !== filterKategori) return false;
      if (filterLokasi && a.lokasi_id !== filterLokasi) return false;
      if (filterKondisi && a.kondisi !== filterKondisi) return false;
      if (filterStatus && a.status !== filterStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          a.nama_aset.toLowerCase().includes(q) ||
          a.kode_aset.toLowerCase().includes(q) ||
          (a.merek ?? '').toLowerCase().includes(q) ||
          (a.nomor_seri ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [asetList, filterKategori, filterLokasi, filterKondisi, filterStatus, search]);

  // ============================
  // STATS
  // ============================
  const stats = useMemo(() => {
    const total = asetList.length;
    const nilaiTotal = asetList.reduce(
      (sum, a) => sum + Number(a.harga_perolehan ?? 0) * (a.jumlah ?? 0),
      0
    );
    const baik = asetList.filter((a) => a.kondisi === 'Baik').length;
    const rusak = asetList.filter(
      (a) => a.kondisi === 'Rusak Ringan' || a.kondisi === 'Rusak Berat'
    ).length;
    const dipinjam = asetList.filter((a) => a.status === 'Dipinjam').length;
    return { total, nilaiTotal, baik, rusak, dipinjam };
  }, [asetList]);

  // ============================
  // SELECTION HANDLERS
  // ============================
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allFilteredIds = filteredList.map((a) => a.id);
    const allSelected =
      allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedAssets = useMemo(
    () => asetList.filter((a) => selectedIds.has(a.id)),
    [asetList, selectedIds]
  );

  const isAllFilteredSelected =
    filteredList.length > 0 &&
    filteredList.every((a) => selectedIds.has(a.id));

  // ============================
  // HANDLERS
  // ============================
  const handleOpenCreate = () => {
    setEditingAset(null);
    setModalAsetOpen(true);
  };

  const handleOpenEdit = (aset: InventarisSarprasWithRelations) => {
    setEditingAset(aset);
    setModalAsetOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('inventaris_sarpras')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus aset: ${deleteTarget.nama_aset} (${deleteTarget.kode_aset})`,
      });

      showToast('success', 'Aset berhasil dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // Regenerate QR token (anti-forgery)
  const handleRegenerateToken = async () => {
    if (!regenerateTarget) return;
    try {
      const { error } = await supabase.rpc('regenerate_qr_token', {
        p_aset_id: regenerateTarget.id,
      });
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: regenerateTarget.id,
        deskripsi: `Regenerate QR token: ${regenerateTarget.nama_aset} (${regenerateTarget.kode_aset})`,
      });

      showToast(
        'success',
        'QR token baru dibuat. Label lama tidak lagi valid — silakan cetak ulang label.'
      );
      setRegenerateTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal regenerate: ' + (err.message || 'Error'));
    }
  };

  const resetFilter = () => {
    setSearch('');
    setFilterKategori('');
    setFilterLokasi('');
    setFilterKondisi('');
    setFilterStatus('');
  };

  const hasFilter =
    search || filterKategori || filterLokasi || filterKondisi || filterStatus;

  // ============================
  // EXPORT
  // ============================
  const exportHeaders = [
    'Kode',
    'Nama Aset',
    'Kategori',
    'Lokasi',
    'Jumlah',
    'Satuan',
    'Kondisi',
    'Status',
    'Merek',
    'Harga Perolehan',
    'Tgl. Perolehan',
  ];
  const exportRows = filteredList.map((a) => [
    a.kode_aset,
    a.nama_aset,
    a.kategori?.nama ?? '-',
    a.lokasi_detail?.nama ?? '-',
    a.jumlah,
    a.satuan,
    a.kondisi,
    a.status,
    a.merek ?? '-',
    a.harga_perolehan ?? 0,
    a.tanggal_perolehan ?? '-',
  ]);

  // ============================
  // RENDER
  // ============================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Package className="text-indigo-400" size={20} />
            Daftar Aset Inventaris
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filteredList.length} dari {asetList.length} aset ditampilkan
            {selectedIds.size > 0 && (
              <span className="text-indigo-400 font-bold"> · {selectedIds.size} dipilih</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
              title="Batal pilih"
            >
              <X size={14} /> Batal Pilih
            </button>
          )}

          <button
            onClick={() => setModalKategoriOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <Settings size={14} /> Kelola Kategori
          </button>

          <button
            onClick={() => setModalLokasiOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <MapPin size={14} /> Kelola Lokasi
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Tambah Aset
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Total Aset</p>
            <p className="text-base font-extrabold text-slate-100">{stats.total}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Kondisi Baik</p>
            <p className="text-base font-extrabold text-emerald-400">{stats.baik}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Perlu Perhatian</p>
            <p className="text-base font-extrabold text-rose-400">{stats.rusak}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Dipinjam</p>
            <p className="text-base font-extrabold text-amber-400">{stats.dipinjam}</p>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Nilai Total</p>
            <p className="text-sm font-extrabold text-teal-400 truncate">
              {formatRupiahShort(stats.nilaiTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, nama, merek, nomor seri..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Kategori</option>
              {kategoriList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>

            <select
              value={filterLokasi}
              onChange={(e) => setFilterLokasi(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Lokasi</option>
              {lokasiList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nama}
                </option>
              ))}
            </select>

            <select
              value={filterKondisi}
              onChange={(e) => setFilterKondisi(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Kondisi</option>
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Dipinjam">Dipinjam</option>
              <option value="Perbaikan">Perbaikan</option>
              <option value="Hilang">Hilang</option>
              <option value="Dihapus">Dihapus</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilan Tabel"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilan Grid"
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            {hasFilter && (
              <button
                onClick={resetFilter}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                title="Reset filter"
              >
                <X size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR AKSI MASSAL + EXPORT */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <button
                onClick={() => setCetakModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
              >
                <Printer size={14} /> Cetak Label ({selectedIds.size})
              </button>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                Pilih aset dengan checkbox untuk mencetak label QR
              </p>
            )}
          </div>

          <ExportImportButtons
            filename={`inventaris_sarpras_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Inventaris Sarpras"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Memuat data aset...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Package size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada aset yang cocok' : 'Belum ada aset terdaftar'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter
              ? 'Coba reset filter atau ubah kata kunci.'
              : 'Mulai dengan menambahkan aset baru.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        // ==================== TABLE VIEW ====================
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                      title={isAllFilteredSelected ? 'Batal pilih semua' : 'Pilih semua'}
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare size={16} className="text-indigo-400" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">Aset</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-left px-4 py-3">Lokasi</th>
                  <th className="text-left px-4 py-3">Kondisi</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Harga</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredList.map((a) => {
                  const isSelected = selectedIds.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-slate-800/30 transition-colors group ${
                        isSelected ? 'bg-indigo-500/[0.06]' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleSelect(a.id)}
                          className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-indigo-400" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {a.foto_url ? (
                              <img
                                src={a.foto_url}
                                alt={a.nama_aset}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package size={16} className="text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 truncate max-w-[200px]">
                              {a.nama_aset}
                            </p>
                            <p className="text-[11px] font-mono text-indigo-400">
                              {a.kode_aset}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-300">
                          {a.kategori?.nama ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-300">
                          {a.lokasi_detail?.nama ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getKondisiBadge(
                            a.kondisi
                          )}`}
                        >
                          {a.kondisi}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusAsetBadge(
                            a.status
                          )}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-slate-300 font-mono">
                          {a.harga_perolehan ? formatRupiah(a.harga_perolehan) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setRegenerateTarget(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Regenerate QR Token (label lama akan invalid)"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ==================== GRID VIEW ====================
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((a) => {
            const isSelected = selectedIds.has(a.id);
            return (
              <div
                key={a.id}
                className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all group ${
                  isSelected
                    ? 'border-indigo-500/60 ring-1 ring-indigo-500/40'
                    : 'border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                <div className="aspect-video bg-slate-950 flex items-center justify-center overflow-hidden relative">
                  {a.foto_url ? (
                    <img
                      src={a.foto_url}
                      alt={a.nama_aset}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Package size={40} className="text-slate-700" />
                  )}

                  {/* Checkbox overlay */}
                  <button
                    onClick={() => toggleSelect(a.id)}
                    className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-md transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900/70 hover:bg-slate-900 text-slate-300 border border-slate-700'
                    }`}
                    title={isSelected ? 'Batal pilih' : 'Pilih untuk cetak'}
                  >
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>

                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur ${getKondisiBadge(
                        a.kondisi
                      )}`}
                    >
                      {a.kondisi}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-mono text-indigo-400">{a.kode_aset}</p>
                    <h3 className="font-bold text-slate-100 text-sm leading-tight mt-0.5 line-clamp-2">
                      {a.nama_aset}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {a.kategori && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                        {a.kategori.nama}
                      </span>
                    )}
                    {a.lokasi_detail && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                        📍 {a.lokasi_detail.nama}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md border ${getStatusAsetBadge(
                        a.status
                      )}`}
                    >
                      {a.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Jumlah
                      </p>
                      <p className="text-xs font-bold text-slate-300">
                        {a.jumlah} {a.satuan}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Harga
                      </p>
                      <p className="text-xs font-bold text-teal-400 font-mono">
                        {a.harga_perolehan
                          ? formatRupiahShort(a.harga_perolehan)
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(a)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => setRegenerateTarget(a)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 border border-slate-700 transition-colors cursor-pointer"
                      title="Regenerate QR Token"
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(a)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      <ModalAsetSarpras
        open={modalAsetOpen}
        onClose={() => {
          setModalAsetOpen(false);
          setEditingAset(null);
        }}
        aset={editingAset}
        kategoriList={kategoriList}
        lokasiList={lokasiList}
        guruList={guruList}
        onSaved={fetchAll}
      />

      <KategoriManagerModal
        open={modalKategoriOpen}
        onClose={() => setModalKategoriOpen(false)}
        kategoriList={kategoriList}
        onChanged={fetchAll}
      />

      <LokasiManagerModal
        open={modalLokasiOpen}
        onClose={() => setModalLokasiOpen(false)}
        lokasiList={lokasiList}
        onChanged={fetchAll}
      />

      <CetakLabelModal
        open={cetakModalOpen}
        onClose={() => setCetakModalOpen(false)}
        asetList={selectedAssets}
      />

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Aset"
        message={`Yakin hapus aset "${deleteTarget?.nama_aset}" (${deleteTarget?.kode_aset})? Semua riwayat peminjaman dan pemeliharaan terkait akan ikut terhapus.`}
      />

      {/* CONFIRM REGENERATE QR TOKEN */}
      <ConfirmModal
        open={!!regenerateTarget}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={handleRegenerateToken}
        title="Regenerate QR Token"
        message={`Regenerate token QR untuk "${regenerateTarget?.nama_aset}" (${regenerateTarget?.kode_aset})? Semua label yang sudah dicetak sebelumnya akan menjadi INVALID — Anda perlu cetak ulang label. Gunakan fitur ini jika label aset hilang / bocor / dicuri.`}
        confirmLabel="Ya, Regenerate"
        variant="warning"
      />
    </div>
  );
}