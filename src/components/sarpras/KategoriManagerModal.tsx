// src/components/sarpras/KategoriManagerModal.tsx
// Modal kelola master kategori sarpras.

import { Loader2, Plus, Pencil, Trash2, CheckCircle2, X } from 'lucide-react';
import { Modal, ConfirmModal } from '@/components/Modal';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import { AUDIT_MODUL } from '@/lib/audit';
import { useKategoriManager } from '@/hooks/useKategoriManager';
import type { KategoriSarpras } from '@/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
  kategoriList: KategoriSarpras[];
  onChanged: () => void;
};

export function KategoriManagerModal({ open, onClose, kategoriList, onChanged }: Props) {
  const {
    saving, form, setForm,
    editingId, editingForm, setEditingForm,
    deleteTarget, setDeleteTarget,
    handleAdd, startEdit, cancelEdit, handleUpdate, handleDelete,
  } = useKategoriManager<KategoriSarpras>({
    tableName: 'kategori_sarpras',
    logModul: AUDIT_MODUL.SARPRAS,
    label: 'Kategori sarpras',
    emptyForm: { nama: '' },
    buildPayload: (f) => ({ nama: f.nama.trim() }),
    formFromItem: (k) => ({ nama: k.nama }),
    onChanged,
  });

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Kategori Sarpras" size="md">
        {/* Form Tambah */}
        <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <Plus size={14} /> Tambah Kategori Baru
          </h4>
          <div className="flex gap-2">
            <input
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Contoh: Alat Musik"
              className={`${INPUT_CLASS} flex-1`}
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Tambah
            </button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Daftar Kategori ({kategoriList.length})
          </h4>
          {kategoriList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Belum ada kategori.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {kategoriList.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-700/50"
                >
                  {editingId === k.id ? (
                    <>
                      <input
                        value={editingForm.nama}
                        onChange={(e) => setEditingForm({ ...editingForm, nama: e.target.value })}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdate();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/50 text-slate-200 text-xs focus:outline-none"
                      />
                      <button
                        onClick={handleUpdate}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-200">{k.nama}</span>
                      <button
                        onClick={() => startEdit(k)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(k)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Hapus"
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
        message={`Yakin hapus "${deleteTarget?.nama}"? Aset dengan kategori ini akan menjadi tanpa kategori.`}
      />
    </>
  );
}