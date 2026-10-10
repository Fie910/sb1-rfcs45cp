// src/components/sarpras/PenghapusanTab.tsx
// Tab Penghapusan Aset — pengajuan + approval berjenjang.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Loader2,
  Trash2,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { isSarprasManager } from './shared';
import { getStatusPenghapusanBadge, formatDateShort, formatRupiah, INPUT_CLASS, LABEL_CLASS } from './shared';
import type {
  InventarisPenghapusanWithRelations,
  InventarisSarpras,
  MetodePenghapusan,
} from '@/types/database';

const METODE_OPTIONS: MetodePenghapusan[] = [
  'Dimusnahkan',
  'Dilelang',
  'Dihibahkan',
  'Dijual',
  'Lainnya',
];

export function PenghapusanTab() {
  const { guru } = useAuth();
  const isManager = isSarprasManager(guru?.role);

  const [list, setList] = useState<InventarisPenghapusanWithRelations[]>([]);
  const [asetList, setAsetList] = useState<InventarisSarpras[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal create
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    aset_id: '',
    alasan: '',
    rekomendasi: '',
    nilai_buku_saat_ajukan: '',
  });
  const [saving, setSaving] = useState(false);

  // Modal approval
  const [approveTarget, setApproveTarget] =
    useState<InventarisPenghapusanWithRelations | null>(null);
  const [approveForm, setApproveForm] = useState({
    metode_penghapusan: 'Dimusnahkan' as MetodePenghapusan,
    catatan_approval: '',
  });
  const [approving, setApproving] = useState(false);

  // Reject
  const [rejectTarget, setRejectTarget] =
    useState<InventarisPenghapusanWithRelations | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] =
    useState<InventarisPenghapusanWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hapusRes, asetRes] = await Promise.all([
        supabase
          .from('inventaris_penghapusan')
          .select(`
            *,
            aset:aset_id (id, kode_aset, nama_aset, harga_perolehan),
            pengaju:pengaju_id (id, nama_lengkap),
            approver:approver_id (id, nama_lengkap)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('inventaris_sarpras')
          .select('*')
          .neq('status', 'Dihapus')
          .order('nama_aset'),
      ]);

      if (hapusRes.error) throw hapusRes.error;

      setList((hapusRes.data as unknown as InventarisPenghapusanWithRelations[]) || []);
      setAsetList((asetRes.data as InventarisSarpras[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat penghapusan: ' + (err.message || 'Error'));
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
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (p.aset?.nama_aset ?? '').toLowerCase().includes(q) ||
          (p.aset?.kode_aset ?? '').toLowerCase().includes(q) ||
          (p.pengaju?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          p.alasan.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterStatus, search]);

  const stats = useMemo(() => {
    const menunggu = list.filter((p) => p.status === 'Menunggu').length;
    const disetujui = list.filter((p) => p.status === 'Disetujui').length;
    const ditolak = list.filter((p) => p.status === 'Ditolak').length;
    const nilaiDiajukan = list
      .filter((p) => p.status === 'Menunggu')
      .reduce((sum, p) => sum + (p.nilai_buku_saat_ajukan ?? 0), 0);
    return { menunggu, disetujui, ditolak, nilaiDiajukan };
  }, [list]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setForm({
      aset_id: '',
      alasan: '',
      rekomendasi: '',
      nilai_buku_saat_ajukan: '',
    });
    setModalOpen(true);
  };

  // Auto-fill nilai buku saat aset dipilih
  const selectedAset = asetList.find((a) => a.id === form.aset_id);

  const handleSubmit = async () => {
    if (!guru?.id) return;
    if (!form.aset_id) {
      showToast('error', 'Pilih aset yang akan dihapus');
      return;
    }
    if (!form.alasan.trim()) {
      showToast('error', 'Alasan penghapusan wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('inventaris_penghapusan')
        .insert({
          aset_id: form.aset_id,
          pengaju_id: guru.id,
          alasan: form.alasan.trim(),
          rekomendasi: form.rekomendasi.trim() || null,
          nilai_buku_saat_ajukan: form.nilai_buku_saat_ajukan
            ? Number(form.nilai_buku_saat_ajukan)
            : null,
          status: 'Menunggu',
        })
        .select()
        .single();
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: data?.id,
        deskripsi: `Ajukan penghapusan: ${selectedAset?.nama_aset}`,
      });

      showToast('success', 'Pengajuan penghapusan dikirim');
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ============== APPROVE ==============
  const handleOpenApprove = (item: InventarisPenghapusanWithRelations) => {
    setApproveTarget(item);
    setApproveForm({
      metode_penghapusan: 'Dimusnahkan',
      catatan_approval: '',
    });
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget || !guru?.id) return;
    setApproving(true);
    try {
      const { error } = await supabase
        .from('inventaris_penghapusan')
        .update({
          status: 'Disetujui',
          approver_id: guru.id,
          approved_at: new Date().toISOString(),
          metode_penghapusan: approveForm.metode_penghapusan,
          catatan_approval: approveForm.catatan_approval.trim() || null,
        })
        .eq('id', approveTarget.id);
      if (error) throw error;

      // Update aset → Dihapus
      await supabase
        .from('inventaris_sarpras')
        .update({ status: 'Dihapus' })
        .eq('id', approveTarget.aset_id);

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: approveTarget.id,
        deskripsi: `Setujui penghapusan: ${approveTarget.aset?.nama_aset} — metode ${approveForm.metode_penghapusan}`,
      });

      showToast('success', 'Penghapusan disetujui, aset ditandai dihapus');
      setApproveTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setApproving(false);
    }
  };

  // ============== REJECT ==============
  const handleOpenReject = (item: InventarisPenghapusanWithRelations) => {
    setRejectTarget(item);
    setRejectNote('');
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget || !guru?.id) return;
    if (!rejectNote.trim()) {
      showToast('error', 'Catatan penolakan wajib diisi');
      return;
    }
    setRejecting(true);
    try {
      const { error } = await supabase
        .from('inventaris_penghapusan')
        .update({
          status: 'Ditolak',
          approver_id: guru.id,
          approved_at: new Date().toISOString(),
          catatan_approval: rejectNote.trim(),
        })
        .eq('id', rejectTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: rejectTarget.id,
        deskripsi: `Tolak penghapusan: ${rejectTarget.aset?.nama_aset}`,
      });

      showToast('success', 'Penghapusan ditolak');
      setRejectTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setRejecting(false);
    }
  };

  // ============== DELETE ==============
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('inventaris_penghapusan')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus pengajuan penghapusan: ${deleteTarget.aset?.nama_aset}`,
      });

      showToast('success', 'Pengajuan dihapus');
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
    'Tgl. Pengajuan',
    'Aset',
    'Kode',
    'Pengaju',
    'Alasan',
    'Nilai Buku',
    'Status',
    'Metode',
    'Approver',
  ];
  const exportRows = filtered.map((p) => [
    formatDateShort(p.created_at),
    p.aset?.nama_aset ?? '-',
    p.aset?.kode_aset ?? '-',
    p.pengaju?.nama_lengkap ?? '-',
    p.alasan,
    p.nilai_buku_saat_ajukan ?? 0,
    p.status,
    p.metode_penghapusan ?? '-',
    p.approver?.nama_lengkap ?? '-',
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
            <Trash2 className="text-indigo-400" size={20} />
            Penghapusan Aset
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} pengajuan ditampilkan
          </p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Ajukan Penghapusan
          </button>
        )}
      </div>

      {/* INFO UNTUK NON-MANAGER */}
      {!isManager && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-3">
          <ShieldCheck size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-300">
              Mode Lihat Saja
            </p>
            <p className="text-[11px] text-amber-400/80 mt-0.5 leading-relaxed">
              Hanya admin/kepala/wakil/sarpras yang dapat mengajukan dan menyetujui
              penghapusan aset.
            </p>
          </div>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Menunggu</p>
            <p className="text-base font-extrabold text-amber-400">{stats.menunggu}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Disetujui</p>
            <p className="text-base font-extrabold text-indigo-400">{stats.disetujui}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <XCircle size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Ditolak</p>
            <p className="text-base font-extrabold text-rose-400">{stats.ditolak}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <DollarSign size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Nilai Diajukan
            </p>
            <p className="text-sm font-extrabold text-teal-400 truncate">
              {formatRupiah(stats.nilaiDiajukan)}
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
              placeholder="Cari aset, pengaju, alasan..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs w-full lg:w-48`}
          >
            <option value="">Semua Status</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>
        <div className="flex justify-end">
          <ExportImportButtons
            filename={`penghapusan_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Penghapusan Aset"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Memuat pengajuan...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Trash2 size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {search || filterStatus
              ? 'Tidak ada pengajuan yang cocok'
              : 'Belum ada pengajuan penghapusan'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {isManager
              ? 'Klik "Ajukan Penghapusan" untuk memulai.'
              : 'Hubungi Divisi Sarpras untuk pengajuan penghapusan.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`bg-slate-900 border rounded-2xl p-4 space-y-3 transition-all ${
                p.status === 'Menunggu'
                  ? 'border-amber-500/30'
                  : p.status === 'Disetujui'
                  ? 'border-indigo-500/30'
                  : p.status === 'Ditolak'
                  ? 'border-rose-500/30'
                  : 'border-slate-800'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                    <Package size={18} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 text-sm truncate">
                      {p.aset?.nama_aset ?? '-'}
                    </p>
                    <p className="text-[10px] font-mono text-indigo-400">
                      {p.aset?.kode_aset ?? '-'}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getStatusPenghapusanBadge(
                    p.status
                  )}`}
                >
                  {p.status}
                </span>
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2">
                  <p className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">
                    Diajukan Oleh
                  </p>
                  <p className="text-slate-200 font-medium truncate">
                    {p.pengaju?.nama_lengkap ?? '-'}
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2">
                  <p className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">
                    Nilai Buku
                  </p>
                  <p className="text-teal-400 font-mono font-medium truncate">
                    {p.nilai_buku_saat_ajukan
                      ? formatRupiah(p.nilai_buku_saat_ajukan)
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Alasan */}
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5">
                <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">
                  Alasan
                </p>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                  {p.alasan}
                </p>
              </div>

              {/* Metode & Approver */}
              {p.status !== 'Menunggu' && (
                <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5 space-y-1">
                  {p.metode_penghapusan && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Metode:</span>
                      <span className="text-slate-200 font-bold">
                        {p.metode_penghapusan}
                      </span>
                    </div>
                  )}
                  {p.approver && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">
                        {p.status === 'Ditolak' ? 'Ditolak oleh:' : 'Disetujui oleh:'}
                      </span>
                      <span className="text-slate-200 font-medium truncate max-w-[150px]">
                        {p.approver.nama_lengkap}
                      </span>
                    </div>
                  )}
                  {p.catatan_approval && (
                    <div className="pt-1 border-t border-slate-800/60">
                      <p className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">
                        Catatan:
                      </p>
                      <p className="text-[11px] text-slate-400 italic leading-relaxed">
                        {p.catatan_approval}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-500">
                  {formatDateShort(p.created_at)}
                </span>
                <div className="flex items-center gap-1.5">
                  {p.status === 'Menunggu' && isManager && (
                    <>
                      <button
                        onClick={() => handleOpenApprove(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <CheckCircle2 size={11} /> Setujui
                      </button>
                      <button
                        onClick={() => handleOpenReject(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <XCircle size={11} /> Tolak
                      </button>
                    </>
                  )}
                  {p.status === 'Menunggu' && isManager && (
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Hapus pengajuan"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODAL: AJUKAN ==================== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajukan Penghapusan Aset"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-300">Peringatan</p>
              <p className="text-[11px] text-rose-400/80 mt-0.5 leading-relaxed">
                Penghapusan aset bersifat permanen. Setelah disetujui, aset tidak akan
                muncul lagi di daftar aktif.
              </p>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Aset *</label>
            <SearchableSelect
              options={asetList.map((a) => ({
                value: a.id,
                label: a.nama_aset,
                hint: `${a.kode_aset} · ${a.kondisi}`,
              }))}
              value={form.aset_id}
              onChange={(v) => {
                const a = asetList.find((x) => x.id === v);
                setForm({
                  ...form,
                  aset_id: v,
                  nilai_buku_saat_ajukan:
                    a?.harga_perolehan != null ? String(a.harga_perolehan) : '',
                });
              }}
              placeholder="Pilih aset yang akan dihapus..."
              searchPlaceholder="Cari nama / kode aset..."
              emptyMessage="Aset tidak ditemukan"
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Nilai Buku Saat Ini (Rp)</label>
            <input
              type="number"
              min={0}
              value={form.nilai_buku_saat_ajukan}
              onChange={(e) =>
                setForm({ ...form, nilai_buku_saat_ajukan: e.target.value })
              }
              placeholder="0"
              className={INPUT_CLASS}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Otomatis terisi dari harga perolehan — bisa disesuaikan.
            </p>
          </div>

          <div>
            <label className={LABEL_CLASS}>Alasan Penghapusan *</label>
            <textarea
              rows={3}
              value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
              placeholder="Contoh: Kerusakan berat yang tidak ekonomis untuk diperbaiki..."
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Rekomendasi</label>
            <input
              type="text"
              value={form.rekomendasi}
              onChange={(e) => setForm({ ...form, rekomendasi: e.target.value })}
              placeholder="Contoh: Diganti dengan unit baru tahun ini"
              className={INPUT_CLASS}
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
              onClick={handleSubmit}
              disabled={saving || !form.aset_id || !form.alasan.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Ajukan Penghapusan
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL: APPROVE ==================== */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Setujui Penghapusan"
        size="sm"
      >
        {approveTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                Aset
              </p>
              <p className="text-sm font-bold text-slate-100">
                {approveTarget.aset?.nama_aset}
              </p>
              <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                {approveTarget.aset?.kode_aset}
              </p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Metode Penghapusan *</label>
              <select
                value={approveForm.metode_penghapusan}
                onChange={(e) =>
                  setApproveForm({
                    ...approveForm,
                    metode_penghapusan: e.target.value as MetodePenghapusan,
                  })
                }
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {METODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Catatan Approval</label>
              <textarea
                rows={2}
                value={approveForm.catatan_approval}
                onChange={(e) =>
                  setApproveForm({ ...approveForm, catatan_approval: e.target.value })
                }
                placeholder="Catatan (opsional)..."
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                disabled={approving}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={approving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {approving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Setujui
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== MODAL: REJECT ==================== */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Tolak Penghapusan"
        size="sm"
      >
        {rejectTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                Aset
              </p>
              <p className="text-sm font-bold text-slate-100">
                {rejectTarget.aset?.nama_aset}
              </p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Alasan Penolakan *</label>
              <textarea
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Jelaskan alasan penolakan..."
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={rejecting}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejecting || !rejectNote.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {rejecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Tolak Pengajuan
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
        title="Hapus Pengajuan"
        message={`Yakin hapus pengajuan penghapusan untuk "${deleteTarget?.aset?.nama_aset}"?`}
      />
    </div>
  );
}