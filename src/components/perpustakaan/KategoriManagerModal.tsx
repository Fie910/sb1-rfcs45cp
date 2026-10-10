// src/components/perpustakaan/KategoriManagerModal.tsx
// Modal kelola master kategori Dewey.

import { useState, useMemo } from 'react';
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, X, BookMarked, Search } from 'lucide-react';
import { Modal, ConfirmModal } from '@/components/Modal';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import { AUDIT_MODUL } from '@/utils/audit';
import { useKategoriManager } from '@/hooks/useKategoriManager';
import type { PerpusKategori } from '@/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
  kategoriList: PerpusKategori[];
  onChanged: () => void;
};

export function KategoriManagerModal({ open, onClose, kategoriList, onChanged }: Props) {
  const [search, setSearch] = useState('');

  const {
    saving, form, setForm,
    editingId, editingForm, setEditingForm,
    deleteTarget, setDeleteTarget,
    handleAdd, startEdit, cancelEdit, handleUpdate, handleDelete,
  } = useKategoriManager<PerpusKategori>({
    tableName: 'perpus_kategori',
    logModul: AUDIT_MODUL.PERPUS ?? 'Perpustakaan',
    label: 'Kategori perpus',
    emptyForm: { nama: '', kode_dewey: '', deskripsi: '' },
    buildPayload: (f) => ({
      nama: f.nama.trim(),
      kode_dewey: f.kode_dewey?.trim() || null,
      deskripsi: f.deskripsi?.trim() || null,
    }),
    formFromItem: (k) => ({
      nama: k.nama,
      kode_dewey: k.kode_dewey ?? '',
      deskripsi: k.deskripsi ?? '',
    }),
    onChanged,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return kategoriList;
    const q = search.toLowerCase();
    return kategoriList.filter(
      (k) =>
        k.nama.toLowerCase().includes(q) ||
        (k.kode_dewey ?? '').toLowerCase().includes(q) ||
        (k.deskripsi ?? '').toLowerCase().includes(q)
    );
  }, [kategoriList, search]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Klasifikasi Dewey" size="lg">
        {/* Info */}
        <div className="mb-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <p className="text-xs text-indigo-200 leading-relaxed">
            Sistem Dewey Decimal Classification (DDC) mengelompokkan buku ke 10 kelas utama (000-900).
            Kode ini dipakai untuk generate kode buku otomatis.
          </p>
        </div>

        {/* FORM TAMBAH */}
        <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <BookMarked size={14} /> Tambah Kategori Baru
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Nama Kategori *</label>
              <input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Contoh: Ilmu Sosial"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Kode Dewey</label>
              <input
                value={form.kode_dewey}
                onChange={(e) => setForm({ ...form, kode_dewey: e.target.value })}
                placeholder="300"
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
            <div className="sm:col-span-4">
              <label className={LABEL_CLASS}>Deskripsi</label>
              <input
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Contoh: Sosiologi, ekonomi, hukum, pendidikan"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Tambah Kategori
          </button>
        </div>

        {/* FILTER */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kategori..."
            className={INPUT_CLASS + ' pl-9 text-xs'}
          />
        </div>

        {/* LIST */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Daftar Kategori ({filtered.length})
          </h4>
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              {search ? 'Tidak ada kategori cocok.' : 'Belum ada kategori.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filtered.map((k) => {
                const isEditing = editingId === k.id;
                if (isEditing) {
                  return (
                    <div key={k.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-2 rounded-lg bg-slate-800/60 border border-indigo-500/30">
                      <input
                        value={editingForm.nama}
                        onChange={(e) => setEditingForm({ ...editingForm, nama: e.target.value })}
                        autoFocus
                        className={INPUT_CLASS + ' sm:col-span-2 text-xs'}
                      />
                      <input
                        value={editingForm.kode_dewey}
                        onChange={(e) => setEditingForm({ ...editingForm, kode_dewey: e.target.value })}
                        placeholder="Kode Dewey"
                        className={INPUT_CLASS + ' font-mono text-xs'}
                      />
                      <input
                        value={editingForm.deskripsi}
                        onChange={(e) => setEditingForm({ ...editingForm, deskripsi: e.target.value })}
                        placeholder="Deskripsi"
                        className={INPUT_CLASS + ' text-xs'}
                      />
                      <div className="sm:col-span-4 flex gap-2 justify-end">
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
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                          DDC {k.kode_dewey ?? '-'}
                        </span>
                        <span className="text-sm text-slate-200 font-medium">{k.nama}</span>
                      </div>
                      {k.deskripsi && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{k.deskripsi}</p>
                      )}
                    </div>
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
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Yakin hapus kategori "${deleteTarget?.nama}"? Buku dengan kategori ini akan kehilangan referensi.`}
      />
    </>
  );
}