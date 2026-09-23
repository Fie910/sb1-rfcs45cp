// src/components/perpustakaan/KategoriManagerModal.tsx
// Modal kelola master kategori Dewey.

import { useState, useMemo } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, CheckCircle2, X,
  BookMarked, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import type { PerpusKategori } from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type Props = {
  open: boolean;
  onClose: () => void;
  kategoriList: PerpusKategori[];
  onChanged: () => void;
};

const emptyForm = {
  nama: '',
  kode_dewey: '',
  deskripsi: '',
};

export function KategoriManagerModal({ open, onClose, kategoriList, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<PerpusKategori | null>(null);
  const [search, setSearch] = useState('');

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

  const handleAdd = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama kategori wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('perpus_kategori').insert({
        nama: form.nama.trim(),
        kode_dewey: form.kode_dewey.trim() || null,
        deskripsi: form.deskripsi.trim() || null,
      });
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE',
        modul: MODUL_PERPUS,
        deskripsi: `Tambah kategori perpus: ${form.nama.trim()}`,
      });

      showToast('success', 'Kategori ditambahkan');
      setForm(emptyForm);
      onChanged();
    } catch (err: any) {
      showToast(
        'error',
        err.code === '23505' ? 'Kategori sudah ada' : 'Gagal: ' + (err.message || 'Error')
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (k: PerpusKategori) => {
    setEditingId(k.id);
    setEditingForm({
      nama: k.nama,
      kode_dewey: k.kode_dewey ?? '',
      deskripsi: k.deskripsi ?? '',
    });
  };

  const handleUpdate = async () => {
    if (!editingId || !editingForm.nama.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('perpus_kategori')
        .update({
          nama: editingForm.nama.trim(),
          kode_dewey: editingForm.kode_dewey.trim() || null,
          deskripsi: editingForm.deskripsi.trim() || null,
        })
        .eq('id', editingId);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: MODUL_PERPUS,
        targetId: editingId,
        deskripsi: `Update kategori perpus: ${editingForm.nama.trim()}`,
      });

      showToast('success', 'Kategori diperbarui');
      setEditingId(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('perpus_kategori')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: MODUL_PERPUS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus kategori perpus: ${deleteTarget.nama}`,
      });

      showToast('success', 'Kategori dihapus');
      setDeleteTarget(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Kategori Buku (Dewey)" size="lg">
        <div className="space-y-5 pt-1 max-h-[80vh] overflow-y-auto pr-1 custom-scrollbar">
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
            <BookMarked size={16} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-indigo-300/90 leading-relaxed">
              <p className="font-bold mb-0.5">Klasifikasi Dewey</p>
              <p className="text-indigo-400/70">
                Sistem Dewey Decimal Classification (DDC) mengelompokkan buku ke 10
                kelas utama (000-900). Kode ini dipakai untuk generate kode buku otomatis.
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
                  placeholder="Contoh: Ilmu Sosial"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Kode Dewey</label>
                <input
                  type="text"
                  value={form.kode_dewey}
                  onChange={(e) => setForm({ ...form, kode_dewey: e.target.value })}
                  placeholder="300"
                  className={INPUT_CLASS + ' font-mono'}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Deskripsi</label>
              <input
                type="text"
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Contoh: Sosiologi, ekonomi, hukum, pendidikan"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={handleAdd}
                disabled={saving || !form.nama.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah Kategori
              </button>
            </div>
          </div>

          {/* FILTER */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kategori..."
              className={INPUT_CLASS + ' pl-9 text-xs'}
            />
          </div>

          {/* LIST */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Daftar Kategori ({filtered.length})
            </h4>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                {search ? 'Tidak ada kategori cocok.' : 'Belum ada kategori.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((k) => {
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
                          <input
                            type="text"
                            value={editingForm.kode_dewey}
                            onChange={(e) =>
                              setEditingForm({ ...editingForm, kode_dewey: e.target.value })
                            }
                            placeholder="Kode Dewey"
                            className={INPUT_CLASS + ' font-mono text-xs'}
                          />
                        </div>
                        <input
                          type="text"
                          value={editingForm.deskripsi}
                          onChange={(e) =>
                            setEditingForm({ ...editingForm, deskripsi: e.target.value })
                          }
                          placeholder="Deskripsi"
                          className={INPUT_CLASS + ' text-xs'}
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={handleUpdate}
                            disabled={saving}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
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
                      className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 hover:border-slate-700 transition"
                    >
                      {/* Dewey Code */}
                      <div className="w-14 h-14 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold uppercase text-indigo-400 leading-none">
                          DDC
                        </span>
                        <span className="text-base font-extrabold text-indigo-300 font-mono leading-tight">
                          {k.kode_dewey ?? '-'}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-200 truncate">{k.nama}</p>
                        {k.deskripsi && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {k.deskripsi}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
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
        message={`Yakin hapus kategori "${deleteTarget?.nama}"? Buku dengan kategori ini akan kehilangan referensi.`}
      />
    </>
  );
}