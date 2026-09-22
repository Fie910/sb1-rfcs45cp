// src/components/kedisiplinan/KategoriManagerModal.tsx
// Modal kelola master kategori pelanggaran.

import { useState, useMemo } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, CheckCircle2, X,
  AlertCircle, AlertTriangle, ShieldAlert, Power, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  getLevelPelanggaranBadge,
  getLevelPelanggaranIcon,
  KATEGORI_PELANGGARAN_LEVELS,
} from './shared';
import type {
  KesiswaanKategoriPelanggaran,
  KategoriPelanggaranLevel,
} from '@/types/database';

const MODUL_KEDISIPLINAN = (AUDIT_MODUL as any)?.KEDISIPLINAN ?? 'Kedisiplinan';

// =============================================================================
// TYPES
// =============================================================================

type KategoriManagerModalProps = {
  open: boolean;
  onClose: () => void;
  kategoriList: KesiswaanKategoriPelanggaran[];
  onChanged: () => void;
};

const emptyForm = {
  nama: '',
  kategori: 'Ringan' as KategoriPelanggaranLevel,
  poin_default: '5',
  deskripsi: '',
  is_aktif: true,
};

// =============================================================================
// KOMPONEN
// =============================================================================

export function KategoriManagerModal({
  open,
  onClose,
  kategoriList,
  onChanged,
}: KategoriManagerModalProps) {
  const [saving, setSaving] = useState(false);

  // Form Tambah
  const [form, setForm] = useState(emptyForm);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState(emptyForm);

  // Delete
  const [deleteTarget, setDeleteTarget] =
    useState<KesiswaanKategoriPelanggaran | null>(null);

  // Filter
  const [filterLevel, setFilterLevel] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  // ==========================================================================
  // FILTERED LIST
  // ==========================================================================
  const filtered = useMemo(() => {
    return kategoriList.filter((k) => {
      if (filterLevel && k.kategori !== filterLevel) return false;
      if (!showInactive && !k.is_aktif) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          k.nama.toLowerCase().includes(q) ||
          (k.deskripsi ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [kategoriList, filterLevel, search, showInactive]);

  // Group by level
  const grouped = useMemo(() => {
    const map: Record<KategoriPelanggaranLevel, KesiswaanKategoriPelanggaran[]> = {
      Ringan: [],
      Sedang: [],
      Berat: [],
    };
    filtered.forEach((k) => {
      map[k.kategori].push(k);
    });
    return map;
  }, [filtered]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleAdd = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama kategori wajib diisi');
      return;
    }
    const poinNum = Number(form.poin_default);
    if (!poinNum || poinNum <= 0) {
      showToast('error', 'Poin harus lebih dari 0');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('kesiswaan_kategori_pelanggaran')
        .insert({
          nama: form.nama.trim(),
          kategori: form.kategori,
          poin_default: poinNum,
          deskripsi: form.deskripsi.trim() || null,
          is_aktif: form.is_aktif,
        });
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE',
        modul: MODUL_KEDISIPLINAN,
        deskripsi: `Tambah kategori pelanggaran: [${form.kategori}] ${form.nama.trim()} (${poinNum} poin)`,
      });

      showToast('success', 'Kategori ditambahkan');
      resetForm();
      onChanged();
    } catch (err: any) {
      if (err.code === '23505') {
        showToast('error', 'Nama kategori ini sudah ada');
      } else {
        showToast('error', 'Gagal menambah: ' + (err.message || 'Error'));
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (k: KesiswaanKategoriPelanggaran) => {
    setEditingId(k.id);
    setEditingForm({
      nama: k.nama,
      kategori: k.kategori,
      poin_default: String(k.poin_default),
      deskripsi: k.deskripsi ?? '',
      is_aktif: k.is_aktif,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editingForm.nama.trim()) return;
    const poinNum = Number(editingForm.poin_default);
    if (!poinNum || poinNum <= 0) {
      showToast('error', 'Poin harus lebih dari 0');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('kesiswaan_kategori_pelanggaran')
        .update({
          nama: editingForm.nama.trim(),
          kategori: editingForm.kategori,
          poin_default: poinNum,
          deskripsi: editingForm.deskripsi.trim() || null,
          is_aktif: editingForm.is_aktif,
        })
        .eq('id', editingId);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: MODUL_KEDISIPLINAN,
        targetId: editingId,
        deskripsi: `Update kategori pelanggaran: ${editingForm.nama.trim()}`,
      });

      showToast('success', 'Kategori diperbarui');
      setEditingId(null);
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
        .from('kesiswaan_kategori_pelanggaran')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: MODUL_KEDISIPLINAN,
        targetId: deleteTarget.id,
        deskripsi: `Hapus kategori pelanggaran: ${deleteTarget.nama}`,
      });

      showToast('success', 'Kategori dihapus');
      setDeleteTarget(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const handleToggleAktif = async (k: KesiswaanKategoriPelanggaran) => {
    try {
      const { error } = await supabase
        .from('kesiswaan_kategori_pelanggaran')
        .update({ is_aktif: !k.is_aktif })
        .eq('id', k.id);
      if (error) throw error;

      showToast('success', k.is_aktif ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan');
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Kategori Pelanggaran" size="lg">
        <div className="space-y-5 pt-1 max-h-[80vh] overflow-y-auto pr-1 custom-scrollbar">

          {/* INFO */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-300/90 leading-relaxed">
              <p className="font-bold mb-0.5">Tentang Kategori</p>
              <p className="text-rose-400/70">
                Kategori menentukan poin default yang otomatis terisi saat
                mencatat pelanggaran. Anda tetap bisa menyesuaikan poin di form
                transaksi. Kategori nonaktif tidak akan muncul di dropdown.
              </p>
            </div>
          </div>

          {/* FORM TAMBAH */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Plus size={13} /> Tambah Kategori Baru
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Nama Kategori *</label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="Contoh: Terlambat masuk sekolah"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Level *</label>
                <select
                  value={form.kategori}
                  onChange={(e) =>
                    setForm({ ...form, kategori: e.target.value as KategoriPelanggaranLevel })
                  }
                  className={INPUT_CLASS + ' cursor-pointer'}
                >
                  {KATEGORI_PELANGGARAN_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLASS}>Poin Default *</label>
                <input
                  type="number"
                  min={1}
                  value={form.poin_default}
                  onChange={(e) => setForm({ ...form, poin_default: e.target.value })}
                  placeholder="5"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Deskripsi</label>
                <input
                  type="text"
                  value={form.deskripsi}
                  onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  placeholder="Keterangan tambahan (opsional)"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_aktif}
                  onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
                  className="accent-rose-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300">Aktifkan kategori ini</span>
              </label>

              <button
                onClick={handleAdd}
                disabled={saving || !form.nama.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah Kategori
              </button>
            </div>
          </div>

          {/* FILTER */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama kategori..."
                className={INPUT_CLASS + ' pl-9 text-xs'}
              />
            </div>

            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className={INPUT_CLASS + ' cursor-pointer text-xs sm:w-40'}
            >
              <option value="">Semua Level</option>
              {KATEGORI_PELANGGARAN_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-rose-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 whitespace-nowrap">
                Tampilkan nonaktif
              </span>
            </label>
          </div>

          {/* LIST GROUPED */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Daftar Kategori ({filtered.length})
              </h4>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                {search || filterLevel
                  ? 'Tidak ada kategori yang cocok dengan filter.'
                  : 'Belum ada kategori.'}
              </div>
            ) : (
              <div className="space-y-5">
                {KATEGORI_PELANGGARAN_LEVELS.map((lvl) => {
                  const items = grouped[lvl];
                  if (items.length === 0) return null;

                  const LevelIcon = getLevelPelanggaranIcon(lvl);

                  return (
                    <div key={lvl}>
                      <div className="flex items-center gap-2 mb-2">
                        <LevelIcon size={14} className="text-slate-400" />
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${getLevelPelanggaranBadge(
                            lvl
                          )}`}
                        >
                          {lvl}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({items.length} kategori)
                        </span>
                      </div>

                      <div className="space-y-2">
                        {items.map((k) => {
                          const isEditing = editingId === k.id;

                          if (isEditing) {
                            return (
                              <div
                                key={k.id}
                                className="bg-slate-950/60 border border-indigo-500/40 rounded-xl p-3 space-y-2"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    value={editingForm.nama}
                                    onChange={(e) =>
                                      setEditingForm({ ...editingForm, nama: e.target.value })
                                    }
                                    autoFocus
                                    className={INPUT_CLASS + ' sm:col-span-2 text-xs'}
                                  />
                                  <select
                                    value={editingForm.kategori}
                                    onChange={(e) =>
                                      setEditingForm({
                                        ...editingForm,
                                        kategori: e.target.value as KategoriPelanggaranLevel,
                                      })
                                    }
                                    className={INPUT_CLASS + ' cursor-pointer text-xs'}
                                  >
                                    {KATEGORI_PELANGGARAN_LEVELS.map((l) => (
                                      <option key={l} value={l}>{l}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    value={editingForm.poin_default}
                                    onChange={(e) =>
                                      setEditingForm({ ...editingForm, poin_default: e.target.value })
                                    }
                                    className={INPUT_CLASS + ' text-xs'}
                                  />
                                  <input
                                    type="text"
                                    value={editingForm.deskripsi}
                                    onChange={(e) =>
                                      setEditingForm({ ...editingForm, deskripsi: e.target.value })
                                    }
                                    placeholder="Deskripsi"
                                    className={INPUT_CLASS + ' sm:col-span-2 text-xs'}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingForm.is_aktif}
                                      onChange={(e) =>
                                        setEditingForm({ ...editingForm, is_aktif: e.target.checked })
                                      }
                                      className="accent-rose-500 cursor-pointer"
                                    />
                                    <span className="text-[11px] text-slate-300">Aktif</span>
                                  </label>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={handleUpdate}
                                      disabled={saving}
                                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                                      title="Simpan"
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                                      title="Batal"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={k.id}
                              className={`flex items-center gap-2 bg-slate-950/40 border rounded-xl p-3 transition ${
                                !k.is_aktif
                                  ? 'border-slate-800/40 opacity-50'
                                  : 'border-slate-800/60 hover:border-slate-700'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-slate-200 truncate">
                                    {k.nama}
                                  </p>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                                    {k.poin_default}p
                                  </span>
                                  {!k.is_aktif && (
                                    <span className="text-[9px] font-bold uppercase text-slate-500 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 shrink-0">
                                      Nonaktif
                                    </span>
                                  )}
                                </div>
                                {k.deskripsi && (
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {k.deskripsi}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleToggleAktif(k)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    k.is_aktif
                                      ? 'text-emerald-400 hover:bg-emerald-500/10'
                                      : 'text-slate-500 hover:bg-slate-800'
                                  }`}
                                  title={k.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                                >
                                  <Power size={13} />
                                </button>
                                <button
                                  onClick={() => startEdit(k)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                                  title="Edit"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(k)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                  title="Hapus"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FOOTER */}
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

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Yakin hapus kategori "${deleteTarget?.nama}"? Pelanggaran yang sudah tercatat dengan kategori ini tidak akan terhapus (kategori jadi kosong).`}
      />
    </>
  );
}