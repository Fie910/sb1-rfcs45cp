// src/components/sarpras/PeminjamanTab.tsx
// Tab Peminjaman Aset — request, list, pengembalian.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Loader2,
  Send,
  Package,
  RotateCcw,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  getStatusPeminjamanBadge,
  formatDateShort,
  formatDateTime,
  INPUT_CLASS,
  LABEL_CLASS,
} from './shared';
import type {
  InventarisPeminjamanWithRelations,
  InventarisSarpras,
} from '@/types/database';

// =============================================================================
// HELPERS
// =============================================================================

/** True jika melewati tanggal rencana kembali & belum dikembalikan */
function isOverdue(p: InventarisPeminjamanWithRelations): boolean {
  if (p.status !== 'Dipinjam') return false;
  if (!p.tanggal_rencana_kembali) return false;
  const due = new Date(p.tanggal_rencana_kembali).getTime();
  return Date.now() > due;
}

/** Hitung hari terlambat (>= 0) */
function daysOverdue(p: InventarisPeminjamanWithRelations): number {
  if (!p.tanggal_rencana_kembali) return 0;
  const due = new Date(p.tanggal_rencana_kembali).getTime();
  const diff = Date.now() - due;
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function PeminjamanTab() {
  const { guru, isAdmin } = useAuth();

  const [list, setList] = useState<InventarisPeminjamanWithRelations[]>([]);
  const [asetList, setAsetList] = useState<InventarisSarpras[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal
  const [modalPinjamOpen, setModalPinjamOpen] = useState(false);
  const [returnTarget, setReturnTarget] =
    useState<InventarisPeminjamanWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<InventarisPeminjamanWithRelations | null>(null);

  // Form state untuk modal pinjam
  const [form, setForm] = useState({
    aset_id: '',
    jumlah_dipinjam: '1',
    tanggal_rencana_kembali: '',
    keperluan: '',
    kondisi_saat_pinjam: 'Baik',
    catatan: '',
  });
  const [saving, setSaving] = useState(false);

  // Form state untuk return
  const [returnForm, setReturnForm] = useState({
    kondisi_saat_kembali: 'Baik',
    catatan: '',
  });
  const [returning, setReturning] = useState(false);

  // ============================
  // FETCH
  // ============================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [peminjamanRes, asetRes] = await Promise.all([
        supabase
          .from('inventaris_peminjaman')
          .select(`
            *,
            aset:aset_id (id, kode_aset, nama_aset, satuan, foto_url),
            peminjam:peminjam_id (id, nama_lengkap),
            approver:approver_id (id, nama_lengkap)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('inventaris_sarpras')
          .select('*')
          .eq('status', 'Aktif')
          .order('nama_aset'),
      ]);

      if (peminjamanRes.error) throw peminjamanRes.error;

      setList(
        (peminjamanRes.data as unknown as InventarisPeminjamanWithRelations[]) || []
      );
      setAsetList((asetRes.data as InventarisSarpras[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat peminjaman: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ============================
  // FILTER + STATS
  // ============================
  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (p.aset?.nama_aset ?? '').toLowerCase().includes(q) ||
          (p.aset?.kode_aset ?? '').toLowerCase().includes(q) ||
          (p.peminjam?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (p.keperluan ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterStatus, search]);

  const stats = useMemo(() => {
    const aktif = list.filter((p) => p.status === 'Dipinjam').length;
    const terlambat = list.filter((p) => isOverdue(p)).length;
    const bulanIni = new Date().getMonth();
    const tahunIni = new Date().getFullYear();
    const kembaliBulanIni = list.filter((p) => {
      if (p.status !== 'Dikembalikan' || !p.tanggal_kembali) return false;
      const d = new Date(p.tanggal_kembali);
      return d.getMonth() === bulanIni && d.getFullYear() === tahunIni;
    }).length;
    const hilang = list.filter((p) => p.status === 'Hilang').length;
    return { aktif, terlambat, kembaliBulanIni, hilang };
  }, [list]);

  // ============================
  // HANDLERS — CREATE
  // ============================
  const handleOpenCreate = () => {
    setForm({
      aset_id: '',
      jumlah_dipinjam: '1',
      tanggal_rencana_kembali: '',
      keperluan: '',
      kondisi_saat_pinjam: 'Baik',
      catatan: '',
    });
    setModalPinjamOpen(true);
  };

  const selectedAset = asetList.find((a) => a.id === form.aset_id);
  const maxJumlah = selectedAset?.jumlah ?? 1;

  const handleSubmitPinjam = async () => {
    if (!guru?.id) {
      showToast('error', 'Sesi login tidak ditemukan');
      return;
    }
    if (!form.aset_id) {
      showToast('error', 'Pilih aset yang akan dipinjam');
      return;
    }
    if (!form.keperluan.trim()) {
      showToast('error', 'Keperluan peminjaman wajib diisi');
      return;
    }
    const jml = Number(form.jumlah_dipinjam);
    if (!jml || jml < 1) {
      showToast('error', 'Jumlah peminjaman minimal 1');
      return;
    }
    if (jml > maxJumlah) {
      showToast(
        'error',
        `Stok tersedia hanya ${maxJumlah} ${selectedAset?.satuan ?? 'unit'}`
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Insert peminjaman
      const { data, error } = await supabase
        .from('inventaris_peminjaman')
        .insert({
          aset_id: form.aset_id,
          peminjam_id: guru.id,
          jumlah_dipinjam: jml,
          tanggal_rencana_kembali: form.tanggal_rencana_kembali || null,
          keperluan: form.keperluan.trim(),
          kondisi_saat_pinjam: form.kondisi_saat_pinjam,
          catatan: form.catatan.trim() || null,
          status: 'Dipinjam',
        })
        .select()
        .single();
      if (error) throw error;

      // 2. Update status aset → Dipinjam (jika peminjaman full stock)
      await supabase
        .from('inventaris_sarpras')
        .update({ status: 'Dipinjam' })
        .eq('id', form.aset_id);

      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: data?.id,
        deskripsi: `Peminjaman aset: ${selectedAset?.nama_aset} (${jml} ${selectedAset?.satuan})`,
      });

      showToast('success', 'Peminjaman berhasil dicatat');
      setModalPinjamOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ============================
  // HANDLERS — RETURN
  // ============================
  const handleOpenReturn = (p: InventarisPeminjamanWithRelations) => {
    setReturnForm({
      kondisi_saat_kembali: 'Baik',
      catatan: '',
    });
    setReturnTarget(p);
  };

  const handleConfirmReturn = async () => {
    if (!returnTarget) return;

    setReturning(true);
    try {
      // 1. Update peminjaman
      const { error } = await supabase
        .from('inventaris_peminjaman')
        .update({
          status: 'Dikembalikan',
          tanggal_kembali: new Date().toISOString(),
          kondisi_saat_kembali: returnForm.kondisi_saat_kembali,
          catatan: returnForm.catatan.trim() || null,
        })
        .eq('id', returnTarget.id);
      if (error) throw error;

      // 2. Kembalikan aset → Aktif jika kondisi kembali Baik
      if (returnForm.kondisi_saat_kembali === 'Baik') {
        await supabase
          .from('inventaris_sarpras')
          .update({ status: 'Aktif' })
          .eq('id', returnTarget.aset_id);
      } else {
        // Rusak → status Perbaikan
        await supabase
          .from('inventaris_sarpras')
          .update({
            status: 'Perbaikan',
            kondisi: returnForm.kondisi_saat_kembali,
          })
          .eq('id', returnTarget.aset_id);
      }

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: returnTarget.id,
        deskripsi: `Pengembalian aset: ${returnTarget.aset?.nama_aset} — kondisi ${returnForm.kondisi_saat_kembali}`,
      });

      showToast('success', 'Pengembalian berhasil dicatat');
      setReturnTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setReturning(false);
    }
  };

  // ============================
  // HANDLERS — DELETE
  // ============================
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('inventaris_peminjaman')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus peminjaman: ${deleteTarget.aset?.nama_aset}`,
      });

      showToast('success', 'Catatan peminjaman dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // ============================
  // EXPORT
  // ============================
  const exportHeaders = [
    'Aset',
    'Kode',
    'Peminjam',
    'Jumlah',
    'Tgl. Pinjam',
    'Rencana Kembali',
    'Tgl. Kembali',
    'Status',
    'Keperluan',
  ];
  const exportRows = filtered.map((p) => [
    p.aset?.nama_aset ?? '-',
    p.aset?.kode_aset ?? '-',
    p.peminjam?.nama_lengkap ?? '-',
    `${p.jumlah_dipinjam} ${p.aset?.satuan ?? ''}`.trim(),
    formatDateShort(p.tanggal_pinjam),
    p.tanggal_rencana_kembali ? formatDateShort(p.tanggal_rencana_kembali) : '-',
    p.tanggal_kembali ? formatDateShort(p.tanggal_kembali) : '-',
    p.status,
    p.keperluan,
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
            <Send className="text-indigo-400" size={20} />
            Peminjaman Aset
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} catatan ditampilkan
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Ajukan Peminjaman
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Sedang Dipinjam
            </p>
            <p className="text-base font-extrabold text-slate-100">{stats.aktif}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Terlambat
            </p>
            <p className="text-base font-extrabold text-amber-400">
              {stats.terlambat}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Kembali Bulan Ini
            </p>
            <p className="text-base font-extrabold text-emerald-400">
              {stats.kembaliBulanIni}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Hilang
            </p>
            <p className="text-base font-extrabold text-rose-400">{stats.hilang}</p>
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
              placeholder="Cari aset, peminjam, atau keperluan..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs w-full lg:w-48`}
          >
            <option value="">Semua Status</option>
            <option value="Dipinjam">Dipinjam</option>
            <option value="Dikembalikan">Dikembalikan</option>
            <option value="Terlambat">Terlambat</option>
            <option value="Hilang">Hilang</option>
          </select>
        </div>

        <div className="flex justify-end">
          <ExportImportButtons
            filename={`peminjaman_sarpras_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Peminjaman Aset"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Memuat data peminjaman...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Send size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {search || filterStatus
              ? 'Tidak ada peminjaman yang cocok'
              : 'Belum ada peminjaman'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {search || filterStatus
              ? 'Coba reset filter atau ubah kata kunci.'
              : 'Klik "Ajukan Peminjaman" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Aset</th>
                  <th className="text-left px-4 py-3">Peminjam</th>
                  <th className="text-right px-4 py-3">Jumlah</th>
                  <th className="text-left px-4 py-3">Tgl. Pinjam</th>
                  <th className="text-left px-4 py-3">Rencana Kembali</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((p) => {
                  const overdue = isOverdue(p);
                  const overdueDays = daysOverdue(p);
                  const canReturn =
                    p.status === 'Dipinjam' || p.status === 'Terlambat';
                  const canDelete = isAdmin || p.peminjam_id === guru?.id;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {p.aset?.foto_url ? (
                              <img
                                src={p.aset.foto_url}
                                alt={p.aset.nama_aset}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package size={16} className="text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 truncate max-w-[200px]">
                              {p.aset?.nama_aset ?? '-'}
                            </p>
                            <p className="text-[11px] font-mono text-indigo-400">
                              {p.aset?.kode_aset ?? '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <User size={12} className="text-slate-500" />
                          <span className="truncate max-w-[140px]">
                            {p.peminjam?.nama_lengkap ?? '-'}
                          </span>
                        </div>
                        <p
                          className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]"
                          title={p.keperluan}
                        >
                          {p.keperluan}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-bold text-slate-200">
                          {p.jumlah_dipinjam}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">
                          {p.aset?.satuan ?? ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateShort(p.tanggal_pinjam)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {p.tanggal_rencana_kembali ? (
                          <span
                            className={
                              overdue
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {formatDateShort(p.tanggal_rencana_kembali)}
                            {overdue && (
                              <span className="block text-[10px] text-amber-500">
                                +{overdueDays} hari
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusPeminjamanBadge(
                            overdue ? 'Terlambat' : p.status
                          )}`}
                        >
                          {overdue ? 'Terlambat' : p.status}
                        </span>
                        {p.tanggal_kembali && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {formatDateShort(p.tanggal_kembali)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {canReturn && (
                            <button
                              onClick={() => handleOpenReturn(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold transition-colors cursor-pointer"
                              title="Tandai Dikembalikan"
                            >
                              <RotateCcw size={11} /> Kembalikan
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL: AJUKAN PEMINJAMAN ==================== */}
      <Modal
        open={modalPinjamOpen}
        onClose={() => setModalPinjamOpen(false)}
        title="Ajukan Peminjaman Aset"
        size="md"
      >
        <div className="space-y-4 pt-1">
          {/* Info peminjam */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5">
            <p className="text-[10px] font-bold uppercase text-indigo-300 mb-1">
              Peminjam
            </p>
            <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <User size={14} className="text-indigo-400" />
              {guru?.nama_lengkap ?? '-'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Peminjaman dicatat atas nama Anda.
            </p>
          </div>

          {/* Aset */}
          <div>
            <label className={LABEL_CLASS}>Aset yang Dipinjam *</label>
            <SearchableSelect
              options={asetList.map((a) => ({
                value: a.id,
                label: a.nama_aset,
                hint: `${a.kode_aset} — Stok: ${a.jumlah} ${a.satuan}`,
              }))}
              value={form.aset_id}
              onChange={(v) => {
                const a = asetList.find((x) => x.id === v);
                setForm({
                  ...form,
                  aset_id: v,
                  jumlah_dipinjam: a ? String(Math.min(1, a.jumlah)) : '1',
                });
              }}
              placeholder="Pilih aset..."
              searchPlaceholder="Cari nama / kode aset..."
              emptyMessage="Aset tidak ditemukan"
            />
            {selectedAset && (
              <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                <Package size={11} />
                Stok tersedia: <strong>{selectedAset.jumlah} {selectedAset.satuan}</strong>
              </p>
            )}
          </div>

          {/* Jumlah & Rencana Kembali */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Jumlah *</label>
              <input
                type="number"
                min={1}
                max={maxJumlah}
                value={form.jumlah_dipinjam}
                onChange={(e) =>
                  setForm({ ...form, jumlah_dipinjam: e.target.value })
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Rencana Kembali</label>
              <input
                type="date"
                value={form.tanggal_rencana_kembali}
                onChange={(e) =>
                  setForm({ ...form, tanggal_rencana_kembali: e.target.value })
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Keperluan */}
          <div>
            <label className={LABEL_CLASS}>Keperluan *</label>
            <textarea
              rows={3}
              value={form.keperluan}
              onChange={(e) => setForm({ ...form, keperluan: e.target.value })}
              placeholder="Contoh: Untuk praktikum kelas XI RPL 2..."
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>

          {/* Kondisi Awal */}
          <div>
            <label className={LABEL_CLASS}>Kondisi Awal Saat Dipinjam</label>
            <select
              value={form.kondisi_saat_pinjam}
              onChange={(e) =>
                setForm({ ...form, kondisi_saat_pinjam: e.target.value })
              }
              className={`${INPUT_CLASS} cursor-pointer`}
            >
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
            </select>
          </div>

          {/* Catatan */}
          <div>
            <label className={LABEL_CLASS}>Catatan Tambahan</label>
            <input
              type="text"
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder="Opsional"
              className={INPUT_CLASS}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalPinjamOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmitPinjam}
              disabled={saving || !form.aset_id || !form.keperluan.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Simpan Peminjaman
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL: PENGEMBALIAN ==================== */}
      <Modal
        open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        title="Pengembalian Aset"
        size="sm"
      >
        {returnTarget && (
          <div className="space-y-4 pt-1">
            {/* Info aset */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                Aset Dikembalikan
              </p>
              <p className="text-sm font-bold text-slate-100">
                {returnTarget.aset?.nama_aset}
              </p>
              <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                {returnTarget.aset?.kode_aset}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <User size={11} /> {returnTarget.peminjam?.nama_lengkap}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Calendar size={11} /> Dipinjam: {formatDateTime(returnTarget.tanggal_pinjam)}
              </p>
            </div>

            {/* Kondisi kembali */}
            <div>
              <label className={LABEL_CLASS}>Kondisi Saat Dikembalikan *</label>
              <select
                value={returnForm.kondisi_saat_kembali}
                onChange={(e) =>
                  setReturnForm({
                    ...returnForm,
                    kondisi_saat_kembali: e.target.value,
                  })
                }
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                <option value="Baik">Baik — aset kembali normal</option>
                <option value="Rusak Ringan">Rusak Ringan — perlu diperiksa</option>
                <option value="Rusak Berat">
                  Rusak Berat — perlu perbaikan serius
                </option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Jika kondisi bukan "Baik", status aset otomatis berubah menjadi
                "Perbaikan".
              </p>
            </div>

            {/* Catatan */}
            <div>
              <label className={LABEL_CLASS}>Catatan Pengembalian</label>
              <textarea
                rows={2}
                value={returnForm.catatan}
                onChange={(e) =>
                  setReturnForm({ ...returnForm, catatan: e.target.value })
                }
                placeholder="Contoh: Ada 1 unit layar retak..."
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                disabled={returning}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={returning}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {returning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                Konfirmasi Pengembalian
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== CONFIRM DELETE ==================== */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Catatan Peminjaman"
        message={`Yakin hapus catatan peminjaman "${deleteTarget?.aset?.nama_aset}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}