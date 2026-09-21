// src/components/sarpras/KategoriManagerModal.tsx
// Modal kelola master kategori sarpras.

import { useState } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import type { KategoriSarpras } from '@/types/database';

type KategoriManagerModalProps = {
  open: boolean;
  onClose: () => void;
  kategoriList: KategoriSarpras[];
  onChanged: () => void;
};

export function KategoriManagerModal({
  open,
  onClose,
  kategoriList,
  onChanged,
}: KategoriManagerModalProps) {
  const [saving, setSaving] = useState(false);
  const [newNama, setNewNama] = useState('');
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
          {/* Form Tambah */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <label className={LABEL_CLASS}>Tambah Kategori Baru</label>
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
                className={`${INPUT_CLASS} flex-1`}
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newNama.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah
              </button>
            </div>
          </div>

          {/* List */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Daftar Kategori ({kategoriList.length})
            </p>
            {kategoriList.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Belum ada kategori.
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdate(k.id);
                            }
                          }}
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
        message={`Yakin hapus "${deleteTarget?.nama}"? Aset dengan kategori ini akan menjadi tanpa kategori.`}
      />
    </>
  );
}