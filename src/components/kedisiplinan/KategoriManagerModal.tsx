// src/components/kedisiplinan/KategoriManagerModal.tsx
// Modal kelola master kategori pelanggaran.

import { useMemo, useState } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, CheckCircle2, X, Power, Search,
} from 'lucide-react';
import { Modal, ConfirmModal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, getLevelPelanggaranIcon, KATEGORI_PELANGGARAN_LEVELS,
} from './shared';
import { useKategoriManager } from '@/hooks/useKategoriManager';
import type {
  KesiswaanKategoriPelanggaran, KategoriPelanggaranLevel,
} from '@/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
  kategoriList: KesiswaanKategoriPelanggaran[];
  onChanged: () => void;
};

export function KategoriManagerModal({ open, onClose, kategoriList, onChanged }: Props) {
  // Filter state (khusus kedisiplinan)
  const [filterLevel, setFilterLevel] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const {
    saving, form, setForm,
    editingId, editingForm, setEditingForm,
    deleteTarget, setDeleteTarget,
    handleAdd, startEdit, cancelEdit, handleUpdate, handleDelete,
  } = useKategoriManager<KesiswaanKategoriPelanggaran>({
    tableName: 'kesiswaan_kategori_pelanggaran',
    logModul: (AUDIT_MODUL as any)?.KEDISIPLINAN ?? 'Kedisiplinan',
    label: 'Kategori pelanggaran',
    emptyForm: { nama: '', kategori: 'Ringan' as KategoriPelanggaranLevel, poin_default: '5', deskripsi: '', is_aktif: true },
    buildPayload: (f) => ({
      nama: f.nama.trim(),
      kategori: f.kategori,
      poin_default: Number(f.poin_default),
      deskripsi: f.deskripsi?.trim() || null,
      is_aktif: f.is_aktif,
    }),
    formFromItem: (k) => ({
      nama: k.nama,
      kategori: k.kategori,
      poin_default: String(k.poin_default),
      deskripsi: k.deskripsi ?? '',
      is_aktif: k.is_aktif,
    }),
    validateForm: (f) => {
      if (!f.nama?.trim()) return 'Nama kategori wajib diisi';
      const poinNum = Number(f.poin_default);
      if (!poinNum || poinNum <= 0) return 'Poin harus lebih dari 0';
      return null;
    },
    onChanged,
  });

  // ---------------------------------------------------------------------------
  // Toggle aktif (khusus kedisiplinan — tidak ada di hook karena spesifik)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Filter + Grouping
  // ---------------------------------------------------------------------------
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

  const grouped = useMemo(() => {
    const map: Record<string, KesiswaanKategoriPelanggaran[]> = {
      Ringan: [], Sedang: [], Berat: [],
    };
    filtered.forEach((k) => {
      map[k.kategori].push(k);
    });
    return map;
  }, [filtered]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Kategori Pelanggaran" size="lg">
        {/* INFO */}
        <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <h4 className="text-xs font-bold text-rose-200 mb-1">Tentang Kategori</h4>
          <p className="text-xs text-rose-200/80 leading-relaxed">
            Kategori menentukan poin default yang otomatis terisi saat mencatat pelanggaran.
            Anda tetap bisa menyesuaikan poin di form transaksi. Kategori nonaktif tidak akan muncul di dropdown.
          </p>
        </div>

        {/* FORM TAMBAH */}
        <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <Plus size={14} /> Tambah Kategori Baru
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Nama Kategori *</label>
              <input
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
              <label className="text-xs text-slate-400 mb-1 block">Level *</label>
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
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Poin Default *</label>
              <input
                type="number"
                value={form.poin_default}
                onChange={(e) => setForm({ ...form, poin_default: e.target.value })}
                placeholder="5"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Deskripsi</label>
              <input
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Keterangan tambahan (opsional)"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_aktif}
                  onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
                  className="accent-rose-500 cursor-pointer"
                />
                Aktifkan kategori ini
              </label>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="ml-auto px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah Kategori
              </button>
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
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
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-rose-500 cursor-pointer"
            />
            Tampilkan nonaktif
          </label>
        </div>

        {/* LIST GROUPED */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Daftar Kategori ({filtered.length})
          </h4>
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              {search || filterLevel
                ? 'Tidak ada kategori yang cocok dengan filter.'
                : 'Belum ada kategori.'}
            </p>
          ) : (
            KATEGORI_PELANGGARAN_LEVELS.map((lvl) => {
              const items = grouped[lvl];
              if (items.length === 0) return null;
              const LevelIcon = getLevelPelanggaranIcon(lvl);
              return (
                <div key={lvl}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <LevelIcon size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">{lvl}</span>
                    <span className="text-[10px] text-slate-500">({items.length} kategori)</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((k) => {
                      const isEditing = editingId === k.id;
                      if (isEditing) {
                        return (
                          <div key={k.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-slate-800/60 border border-indigo-500/30">
                            <input
                              value={editingForm.nama}
                              onChange={(e) => setEditingForm({ ...editingForm, nama: e.target.value })}
                              autoFocus
                              className={INPUT_CLASS + ' sm:col-span-2 text-xs'}
                            />
                            <select
                              value={editingForm.kategori}
                              onChange={(e) =>
                                setEditingForm({ ...editingForm, kategori: e.target.value as KategoriPelanggaranLevel })
                              }
                              className={INPUT_CLASS + ' cursor-pointer text-xs'}
                            >
                              {KATEGORI_PELANGGARAN_LEVELS.map((l) => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={editingForm.poin_default}
                              onChange={(e) => setEditingForm({ ...editingForm, poin_default: e.target.value })}
                              className={INPUT_CLASS + ' text-xs'}
                            />
                            <input
                              value={editingForm.deskripsi}
                              onChange={(e) => setEditingForm({ ...editingForm, deskripsi: e.target.value })}
                              placeholder="Deskripsi"
                              className={INPUT_CLASS + ' sm:col-span-2 text-xs'}
                            />
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingForm.is_aktif}
                                onChange={(e) => setEditingForm({ ...editingForm, is_aktif: e.target.checked })}
                                className="accent-rose-500 cursor-pointer"
                              />
                              Aktif
                            </label>
                            <div className="sm:col-span-3 flex gap-2 justify-end">
                              <button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={k.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-700/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-200 font-medium">{k.nama}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono">
                                {k.poin_default}p
                              </span>
                              {!k.is_aktif && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 text-[10px]">
                                  Nonaktif
                                </span>
                              )}
                            </div>
                            {k.deskripsi && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{k.deskripsi}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleAktif(k)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              k.is_aktif
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-slate-500 hover:bg-slate-800'
                            }`}
                            title={k.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => startEdit(k)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(k)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Yakin hapus kategori "${deleteTarget?.nama}"? Pelanggaran yang sudah tercatat dengan kategori ini tidak akan terhapus (kategori jadi kosong).`}
      />
    </>
  );
}