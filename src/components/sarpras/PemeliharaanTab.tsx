// src/components/sarpras/PemeliharaanTab.tsx
// Tab Pemeliharaan Aset — Work Order (Preventif, Korektif, Kalibrasi, Inspeksi).

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Loader2,
  Wrench,
  Pencil,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  DollarSign,
  Package,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  getStatusPemeliharaanBadge,
  getJenisPemeliharaanBadge,
  formatDateShort,
  formatRupiah,
  INPUT_CLASS,
  LABEL_CLASS,
} from './shared';
import type {
  InventarisPemeliharaanWithRelations,
  InventarisSarpras,
  Guru,
  JenisPemeliharaan,
  StatusPemeliharaan,
} from '@/types/database';

const JENIS_OPTIONS: JenisPemeliharaan[] = ['Preventif', 'Korektif', 'Kalibrasi', 'Inspeksi'];
const STATUS_OPTIONS: StatusPemeliharaan[] = [
  'Dijadwalkan',
  'Berlangsung',
  'Selesai',
  'Dibatalkan',
];

const emptyForm = {
  aset_id: '',
  jenis: 'Preventif' as JenisPemeliharaan,
  judul: '',
  deskripsi: '',
  tanggal_mulai: new Date().toISOString().slice(0, 10),
  tanggal_selesai: '',
  biaya: '',
  vendor_servis: '',
  teknisi: '',
  kondisi_sebelum: 'Baik',
  pic_id: '',
};

export function PemeliharaanTab() {
  const { guru } = useAuth();

  const [list, setList] = useState<InventarisPemeliharaanWithRelations[]>([]);
  const [asetList, setAsetList] = useState<InventarisSarpras[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJenis, setFilterJenis] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventarisPemeliharaanWithRelations | null>(
    null
  );
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Modal Selesai (untuk update kondisi akhir)
  const [completeTarget, setCompleteTarget] =
    useState<InventarisPemeliharaanWithRelations | null>(null);
  const [completeForm, setCompleteForm] = useState({
    kondisi_sesudah: 'Baik',
    biaya: '',
    tanggal_selesai: new Date().toISOString().slice(0, 10),
  });
  const [completing, setCompleting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] =
    useState<InventarisPemeliharaanWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [peliharaRes, asetRes, guruRes] = await Promise.all([
        supabase
          .from('inventaris_pemeliharaan')
          .select(`
            *,
            aset:aset_id (id, kode_aset, nama_aset, foto_url),
            pic:pic_id (id, nama_lengkap)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('inventaris_sarpras').select('*').order('nama_aset'),
        supabase
          .from('gurus')
          .select('id, nip, nama_lengkap, email, role')
          .order('nama_lengkap'),
      ]);

      if (peliharaRes.error) throw peliharaRes.error;

      setList((peliharaRes.data as unknown as InventarisPemeliharaanWithRelations[]) || []);
      setAsetList((asetRes.data as InventarisSarpras[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat pemeliharaan: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ==========================================================================
  // FILTER + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterJenis && p.jenis !== filterJenis) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (p.aset?.nama_aset ?? '').toLowerCase().includes(q) ||
          (p.aset?.kode_aset ?? '').toLowerCase().includes(q) ||
          p.judul.toLowerCase().includes(q) ||
          (p.teknisi ?? '').toLowerCase().includes(q) ||
          (p.vendor_servis ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterStatus, filterJenis, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const dijadwalkan = list.filter((p) => p.status === 'Dijadwalkan').length;
    const berlangsung = list.filter((p) => p.status === 'Berlangsung').length;
    const selesai = list.filter((p) => p.status === 'Selesai').length;
    const totalBiaya = list
      .filter((p) => p.status === 'Selesai')
      .reduce((sum, p) => sum + (p.biaya ?? 0), 0);
    return { total, dijadwalkan, berlangsung, selesai, totalBiaya };
  }, [list]);

  // ==========================================================================
  // HANDLERS — CRUD
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: InventarisPemeliharaanWithRelations) => {
    setEditingItem(item);
    setForm({
      aset_id: item.aset_id,
      jenis: item.jenis,
      judul: item.judul,
      deskripsi: item.deskripsi ?? '',
      tanggal_mulai: item.tanggal_mulai,
      tanggal_selesai: item.tanggal_selesai ?? '',
      biaya: item.biaya != null ? String(item.biaya) : '',
      vendor_servis: item.vendor_servis ?? '',
      teknisi: item.teknisi ?? '',
      kondisi_sebelum: item.kondisi_sebelum ?? 'Baik',
      pic_id: item.pic_id ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.aset_id) {
      showToast('error', 'Pilih aset terlebih dahulu');
      return;
    }
    if (!form.judul.trim()) {
      showToast('error', 'Judul pemeliharaan wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        aset_id: form.aset_id,
        jenis: form.jenis,
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim() || null,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: form.tanggal_selesai || null,
        biaya: form.biaya ? Number(form.biaya) : null,
        vendor_servis: form.vendor_servis.trim() || null,
        teknisi: form.teknisi.trim() || null,
        kondisi_sebelum: form.kondisi_sebelum || null,
        pic_id: form.pic_id || null,
        status: editingItem?.status ?? 'Dijadwalkan',
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventaris_pemeliharaan')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingItem.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.SARPRAS,
          targetId: editingItem.id,
          deskripsi: `Update pemeliharaan: ${payload.judul}`,
        });
        showToast('success', 'Pemeliharaan diperbarui');
      } else {
        const { data, error } = await supabase
          .from('inventaris_pemeliharaan')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.SARPRAS,
          targetId: data?.id,
          deskripsi: `Jadwalkan pemeliharaan: ${payload.judul}`,
        });
        showToast('success', 'Pemeliharaan dijadwalkan');
      }

      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // Status transition: Dijadwalkan → Berlangsung
  const handleStart = async (item: InventarisPemeliharaanWithRelations) => {
    try {
      const { error } = await supabase
        .from('inventaris_pemeliharaan')
        .update({ status: 'Berlangsung', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;

      // Tandai aset dalam perbaikan
      await supabase
        .from('inventaris_sarpras')
        .update({ status: 'Perbaikan' })
        .eq('id', item.aset_id);

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: item.id,
        deskripsi: `Mulai pemeliharaan: ${item.judul}`,
      });

      showToast('success', 'Pemeliharaan dimulai');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // Complete → modal untuk set kondisi akhir
  const handleOpenComplete = (item: InventarisPemeliharaanWithRelations) => {
    setCompleteTarget(item);
    setCompleteForm({
      kondisi_sesudah: 'Baik',
      biaya: item.biaya != null ? String(item.biaya) : '',
      tanggal_selesai: new Date().toISOString().slice(0, 10),
    });
  };

  const handleConfirmComplete = async () => {
    if (!completeTarget) return;

    setCompleting(true);
    try {
      const { error } = await supabase
        .from('inventaris_pemeliharaan')
        .update({
          status: 'Selesai',
          kondisi_sesudah: completeForm.kondisi_sesudah,
          biaya: completeForm.biaya ? Number(completeForm.biaya) : null,
          tanggal_selesai: completeForm.tanggal_selesai,
          updated_at: new Date().toISOString(),
        })
        .eq('id', completeTarget.id);
      if (error) throw error;

      // Update aset sesuai kondisi akhir
      const newAsetStatus = completeForm.kondisi_sesudah === 'Baik' ? 'Aktif' : 'Perbaikan';
      await supabase
        .from('inventaris_sarpras')
        .update({
          status: newAsetStatus,
          kondisi: completeForm.kondisi_sesudah,
        })
        .eq('id', completeTarget.aset_id);

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: completeTarget.id,
        deskripsi: `Selesai pemeliharaan: ${completeTarget.judul} — kondisi akhir ${completeForm.kondisi_sesudah}`,
      });

      showToast('success', 'Pemeliharaan selesai');
      setCompleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async (item: InventarisPemeliharaanWithRelations) => {
    try {
      const { error } = await supabase
        .from('inventaris_pemeliharaan')
        .update({ status: 'Dibatalkan', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;

      // Kembalikan aset ke Aktif
      await supabase
        .from('inventaris_sarpras')
        .update({ status: 'Aktif' })
        .eq('id', item.aset_id);

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: item.id,
        deskripsi: `Batalkan pemeliharaan: ${item.judul}`,
      });

      showToast('success', 'Pemeliharaan dibatalkan');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('inventaris_pemeliharaan')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus pemeliharaan: ${deleteTarget.judul}`,
      });

      showToast('success', 'Pemeliharaan dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'Tanggal Mulai',
    'Aset',
    'Kode',
    'Jenis',
    'Judul',
    'Teknisi/Vendor',
    'Status',
    'Kondisi Akhir',
    'Biaya',
  ];
  const exportRows = filtered.map((p) => [
    formatDateShort(p.tanggal_mulai),
    p.aset?.nama_aset ?? '-',
    p.aset?.kode_aset ?? '-',
    p.jenis,
    p.judul,
    p.teknisi || p.vendor_servis || '-',
    p.status,
    p.kondisi_sesudah ?? '-',
    p.biaya ?? 0,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Wrench className="text-indigo-400" size={20} />
            Pemeliharaan & Perbaikan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} work order ditampilkan
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Work Order Baru
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
            <Wrench size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Total WO</p>
            <p className="text-base font-extrabold text-slate-100">{stats.total}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Dijadwalkan</p>
            <p className="text-base font-extrabold text-indigo-400">{stats.dijadwalkan}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Play size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Berlangsung</p>
            <p className="text-base font-extrabold text-amber-400">{stats.berlangsung}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Selesai</p>
            <p className="text-base font-extrabold text-emerald-400">{stats.selesai}</p>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <DollarSign size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Total Biaya</p>
            <p className="text-sm font-extrabold text-teal-400 truncate">
              {formatRupiah(stats.totalBiaya)}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aset, judul, teknisi, vendor..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs w-full lg:w-48`}
          >
            <option value="">Semua Jenis</option>
            {JENIS_OPTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs w-full lg:w-48`}
          >
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <ExportImportButtons
            filename={`pemeliharaan_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Pemeliharaan Aset"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Memuat work order...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Wrench size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {search || filterStatus || filterJenis
              ? 'Tidak ada work order yang cocok'
              : 'Belum ada work order'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {search || filterStatus || filterJenis
              ? 'Coba reset filter.'
              : 'Klik "Work Order Baru" untuk menjadwalkan pemeliharaan.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Aset & Pekerjaan</th>
                  <th className="text-left px-4 py-3">Jenis</th>
                  <th className="text-left px-4 py-3">Teknisi / Vendor</th>
                  <th className="text-left px-4 py-3">Tgl. Mulai</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Biaya</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((p) => {
                  const canStart = p.status === 'Dijadwalkan';
                  const canComplete = p.status === 'Berlangsung';
                  const canCancel = p.status === 'Dijadwalkan' || p.status === 'Berlangsung';
                  const canEdit = p.status !== 'Selesai' && p.status !== 'Dibatalkan';

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors group">
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
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[220px]">
                              {p.judul}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[220px] mt-0.5">
                              {p.aset?.nama_aset} · {p.aset?.kode_aset}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getJenisPemeliharaanBadge(
                            p.jenis
                          )}`}
                        >
                          {p.jenis}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {p.teknisi || p.vendor_servis || (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateShort(p.tanggal_mulai)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusPemeliharaanBadge(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-slate-300">
                        {p.biaya ? formatRupiah(p.biaya) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {canStart && (
                            <button
                              onClick={() => handleStart(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Mulai pekerjaan"
                            >
                              <Play size={10} /> Mulai
                            </button>
                          )}
                          {canComplete && (
                            <button
                              onClick={() => handleOpenComplete(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Tandai selesai"
                            >
                              <CheckCircle2 size={10} /> Selesai
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Batalkan"
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 size={13} />
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
      )}

      {/* ==================== MODAL: CREATE/EDIT WORK ORDER ==================== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Work Order' : 'Buat Work Order Baru'}
        size="lg"
      >
        <div className="space-y-4 pt-1">
          <div>
            <label className={LABEL_CLASS}>Aset *</label>
            <SearchableSelect
              options={asetList.map((a) => ({
                value: a.id,
                label: a.nama_aset,
                hint: `${a.kode_aset} · kondisi ${a.kondisi}`,
              }))}
              value={form.aset_id}
              onChange={(v) => setForm({ ...form, aset_id: v })}
              placeholder="Pilih aset..."
              searchPlaceholder="Cari nama / kode aset..."
              emptyMessage="Aset tidak ditemukan"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Jenis *</label>
              <select
                value={form.jenis}
                onChange={(e) =>
                  setForm({ ...form, jenis: e.target.value as JenisPemeliharaan })
                }
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {JENIS_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Tanggal Mulai *</label>
              <input
                type="date"
                value={form.tanggal_mulai}
                onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Judul Pekerjaan *</label>
            <input
              type="text"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Contoh: Servis rutin AC ruang guru"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Deskripsi Pekerjaan</label>
            <textarea
              rows={2}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Rincian pekerjaan yang akan dilakukan..."
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Teknisi</label>
              <input
                type="text"
                value={form.teknisi}
                onChange={(e) => setForm({ ...form, teknisi: e.target.value })}
                placeholder="Nama teknisi internal"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Vendor Servis</label>
              <input
                type="text"
                value={form.vendor_servis}
                onChange={(e) => setForm({ ...form, vendor_servis: e.target.value })}
                placeholder="Nama vendor eksternal"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Kondisi Sebelum</label>
              <select
                value={form.kondisi_sebelum}
                onChange={(e) => setForm({ ...form, kondisi_sebelum: e.target.value })}
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                <option value="Baik">Baik</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Estimasi Biaya</label>
              <input
                type="number"
                min={0}
                value={form.biaya}
                onChange={(e) => setForm({ ...form, biaya: e.target.value })}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>PIC Internal</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: g.nama_lengkap,
                hint: g.nip ? `NIP: ${g.nip}` : undefined,
              }))}
              value={form.pic_id}
              onChange={(v) => setForm({ ...form, pic_id: v })}
              placeholder="Pilih guru PIC (opsional)"
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
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
              disabled={saving || !form.aset_id || !form.judul.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
              {editingItem ? 'Simpan Perubahan' : 'Simpan Work Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL: SELESAI ==================== */}
      <Modal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        title="Selesaikan Work Order"
        size="sm"
      >
        {completeTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                Work Order
              </p>
              <p className="text-sm font-bold text-slate-100">{completeTarget.judul}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Aset: {completeTarget.aset?.nama_aset}
              </p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Kondisi Sesudah *</label>
              <select
                value={completeForm.kondisi_sesudah}
                onChange={(e) =>
                  setCompleteForm({ ...completeForm, kondisi_sesudah: e.target.value })
                }
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                <option value="Baik">Baik — aset siap pakai kembali</option>
                <option value="Rusak Ringan">Rusak Ringan — perlu perhatian</option>
                <option value="Rusak Berat">Rusak Berat — perlu perbaikan lanjut</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Jika "Baik", status aset otomatis kembali ke Aktif.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Biaya Aktual</label>
                <input
                  type="number"
                  min={0}
                  value={completeForm.biaya}
                  onChange={(e) =>
                    setCompleteForm({ ...completeForm, biaya: e.target.value })
                  }
                  placeholder="0"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Tanggal Selesai</label>
                <input
                  type="date"
                  value={completeForm.tanggal_selesai}
                  onChange={(e) =>
                    setCompleteForm({ ...completeForm, tanggal_selesai: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCompleteTarget(null)}
                disabled={completing}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                disabled={completing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {completing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Konfirmasi Selesai
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Work Order"
        message={`Yakin hapus work order "${deleteTarget?.judul}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}