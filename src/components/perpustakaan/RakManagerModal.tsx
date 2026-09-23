// src/components/perpustakaan/RakManagerModal.tsx
// Modal kelola master rak buku.

import { useState, useMemo } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, CheckCircle2, X,
  Library, Power, Search, MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import type { PerpusRak } from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type Props = {
  open: boolean;
  onClose: () => void;
  rakList: PerpusRak[];
  onChanged: () => void;
};

const emptyForm = {
  nama: '',
  lokasi: '',
  keterangan: '',
  is_aktif: true,
};

export function RakManagerModal({ open, onClose, rakList, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<PerpusRak | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return rakList;
    const q = search.toLowerCase();
    return rakList.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        (r.lokasi ?? '').toLowerCase().includes(q) ||
        (r.keterangan ?? '').toLowerCase().includes(q)
    );
  }, [rakList, search]);

  const handleAdd = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama rak wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('perpus_rak').insert({
        nama: form.nama.trim(),
        lokasi: form.lokasi.trim() || null,
        keterangan: form.keterangan.trim() || null,
        is_aktif: form.is_aktif,
      });
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE',
        modul: MODUL_PERPUS,
        deskripsi: `Tambah rak perpus: ${form.nama.trim()}`,
      });

      showToast('success', 'Rak ditambahkan');
      setForm(emptyForm);
      onChanged();
    } catch (err: any) {
      showToast(
        'error',
        err.code === '23505' ? 'Rak sudah ada' : 'Gagal: ' + (err.message || 'Error')
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: PerpusRak) => {
    setEditingId(r.id);
    setEditingForm({
      nama: r.nama,
      lokasi: r.lokasi ?? '',
      keterangan: r.keterangan ?? '',
      is_aktif: r.is_aktif,
    });
  };

  const handleUpdate = async () => {
    if (!editingId || !editingForm.nama.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('perpus_rak')
        .update({
          nama: editingForm.nama.trim(),
          lokasi: editingForm.lokasi.trim() || null,
          keterangan: editingForm.keterangan.trim() || null,
          is_aktif: editingForm.is_aktif,
        })
        .eq('id', editingId);
      if (error) throw error;

      showToast('success', 'Rak diperbarui');
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
      const { error } = await supabase.from('perpus_rak').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: MODUL_PERPUS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus rak perpus: ${deleteTarget.nama}`,
      });

      showToast('success', 'Rak dihapus');
      setDeleteTarget(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  const handleToggleAktif = async (r: PerpusRak) => {
    try {
      const { error } = await supabase
        .from('perpus_rak')
        .update({ is_aktif: !r.is_aktif })
        .eq('id', r.id);
      if (error) throw error;
      showToast('success', r.is_aktif ? 'Rak dinonaktifkan' : 'Rak diaktifkan');
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Rak Buku" size="lg">
        <div className="space-y-5 pt-1 max-h-[80vh] overflow-y-auto pr-1 custom-scrollbar">
          {/* FORM TAMBAH */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Plus size={13} /> Tambah Rak Baru
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Nama Rak *</label>
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
                  placeholder="Contoh: Rak E — Teknologi"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Lokasi Fisik</label>
                <input
                  type="text"
                  value={form.lokasi}
                  onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                  placeholder="Contoh: Sudut kiri belakang"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Keterangan</label>
              <input
                type="text"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Opsional"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_aktif}
                  onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
                  className="accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300">Aktifkan rak ini</span>
              </label>
              <button
                onClick={handleAdd}
                disabled={saving || !form.nama.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah Rak
              </button>
            </div>
          </div>

          {/* SEARCH */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari rak..."
              className={INPUT_CLASS + ' pl-9 text-xs'}
            />
          </div>

          {/* LIST */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Daftar Rak ({filtered.length})
            </h4>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                {search ? 'Tidak ada rak cocok.' : 'Belum ada rak.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => {
                  const isEditing = editingId === r.id;
                  if (isEditing) {
                    return (
                      <div
                        key={r.id}
                        className="bg-slate-950/60 border border-indigo-500/40 rounded-xl p-3 space-y-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editingForm.nama}
                            onChange={(e) =>
                              setEditingForm({ ...editingForm, nama: e.target.value })
                            }
                            autoFocus
                            className={INPUT_CLASS + ' text-xs'}
                          />
                          <input
                            type="text"
                            value={editingForm.lokasi}
                            onChange={(e) =>
                              setEditingForm({ ...editingForm, lokasi: e.target.value })
                            }
                            placeholder="Lokasi"
                            className={INPUT_CLASS + ' text-xs'}
                          />
                        </div>
                        <input
                          type="text"
                          value={editingForm.keterangan}
                          onChange={(e) =>
                            setEditingForm({ ...editingForm, keterangan: e.target.value })
                          }
                          placeholder="Keterangan"
                          className={INPUT_CLASS + ' text-xs'}
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editingForm.is_aktif}
                              onChange={(e) =>
                                setEditingForm({ ...editingForm, is_aktif: e.target.checked })
                              }
                              className="accent-indigo-500 cursor-pointer"
                            />
                            <span className="text-[11px] text-slate-300">Aktif</span>
                          </label>
                          <div className="flex items-center gap-1.5">
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
                      </div>
                    );
                  }

                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 bg-slate-950/40 border rounded-xl p-3 transition ${
                        !r.is_aktif
                          ? 'border-slate-800/40 opacity-50'
                          : 'border-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Library size={16} className="text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-200 truncate">{r.nama}</p>
                        {r.lokasi && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {r.lokasi}
                          </p>
                        )}
                        {r.keterangan && (
                          <p className="text-[10px] text-slate-600 truncate mt-0.5">
                            {r.keterangan}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleAktif(r)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            r.is_aktif
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-slate-500 hover:bg-slate-800'
                          }`}
                          title={r.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
        title="Hapus Rak"
        message={`Yakin hapus rak "${deleteTarget?.nama}"? Buku dengan rak ini akan kehilangan referensi lokasi.`}
      />
    </>
  );
}