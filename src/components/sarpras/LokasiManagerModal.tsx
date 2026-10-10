// src/components/sarpras/LokasiManagerModal.tsx
// Modal kelola master lokasi (Gedung → Lantai → Ruang) secara hierarkis.

import { useState, useMemo } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Building,
  Layers,
  DoorOpen,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import type { InventarisLokasi, TipeLokasi } from '@/types/database';

const TIPE_OPTIONS: TipeLokasi[] = ['Gedung', 'Lantai', 'Ruang', 'Area Luar'];

function getTipeIcon(tipe: TipeLokasi) {
  switch (tipe) {
    case 'Gedung':
      return Building;
    case 'Lantai':
      return Layers;
    case 'Ruang':
      return DoorOpen;
    case 'Area Luar':
      return MapPin;
    default:
      return MapPin;
  }
}

function getTipeColor(tipe: TipeLokasi): string {
  switch (tipe) {
    case 'Gedung':
      return 'text-indigo-400';
    case 'Lantai':
      return 'text-teal-400';
    case 'Ruang':
      return 'text-amber-400';
    case 'Area Luar':
      return 'text-emerald-400';
    default:
      return 'text-slate-400';
  }
}

type LokasiManagerModalProps = {
  open: boolean;
  onClose: () => void;
  lokasiList: InventarisLokasi[];
  onChanged: () => void;
};

export function LokasiManagerModal({
  open,
  onClose,
  lokasiList,
  onChanged,
}: LokasiManagerModalProps) {
  const [saving, setSaving] = useState(false);

  // Form tambah
  const [form, setForm] = useState({
    nama: '',
    tipe: 'Ruang' as TipeLokasi,
    parent_id: '',
    keterangan: '',
  });

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({
    nama: '',
    tipe: 'Ruang' as TipeLokasi,
    parent_id: '',
    keterangan: '',
  });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<InventarisLokasi | null>(null);

  // Bangun hierarki: root lokasi dulu, anak di bawahnya
  const lokasiTree = useMemo(() => {
    const map = new Map<string, InventarisLokasi & { children: InventarisLokasi[] }>();
    const roots: (InventarisLokasi & { children: InventarisLokasi[] })[] = [];

    lokasiList.forEach((l) => {
      map.set(l.id, { ...l, children: [] });
    });

    lokasiList.forEach((l) => {
      const node = map.get(l.id)!;
      if (l.parent_id && map.has(l.parent_id)) {
        map.get(l.parent_id)!.children.push(l);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [lokasiList]);

  // Reset form
  const resetForm = () => {
    setForm({ nama: '', tipe: 'Ruang', parent_id: '', keterangan: '' });
  };

  // Handler — tambah lokasi
  const handleAdd = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama lokasi wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        tipe: form.tipe,
        parent_id: form.parent_id || null,
        keterangan: form.keterangan.trim() || null,
      };

      const { error } = await supabase.from('inventaris_lokasi').insert(payload);
      if (error) throw error;

      showToast('success', 'Lokasi ditambahkan');
      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.SARPRAS_LOKASI,
        deskripsi: `Tambah lokasi [${form.tipe}] ${form.nama}`,
      });

      resetForm();
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal menambah: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // Handler — mulai edit
  const startEdit = (lokasi: InventarisLokasi) => {
    setEditingId(lokasi.id);
    setEditingForm({
      nama: lokasi.nama,
      tipe: lokasi.tipe,
      parent_id: lokasi.parent_id || '',
      keterangan: lokasi.keterangan || '',
    });
  };

  // Handler — simpan edit
  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editingForm.nama.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('inventaris_lokasi')
        .update({
          nama: editingForm.nama.trim(),
          tipe: editingForm.tipe,
          parent_id: editingForm.parent_id || null,
          keterangan: editingForm.keterangan.trim() || null,
        })
        .eq('id', editingId);
      if (error) throw error;

      showToast('success', 'Lokasi diperbarui');
      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.SARPRAS_LOKASI,
        targetId: editingId,
        deskripsi: `Update lokasi: ${editingForm.nama.trim()}`,
      });

      setEditingId(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal update: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // Handler — hapus
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('inventaris_lokasi')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      showToast('success', 'Lokasi dihapus');
      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.SARPRAS_LOKASI,
        targetId: deleteTarget.id,
        deskripsi: `Hapus lokasi [${deleteTarget.tipe}] ${deleteTarget.nama}`,
      });

      setDeleteTarget(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // Render recursive tree
  const renderLokasiRow = (
    lokasi: InventarisLokasi & { children: InventarisLokasi[] },
    depth: number = 0
  ) => {
    const TipeIcon = getTipeIcon(lokasi.tipe);
    const isEditing = editingId === lokasi.id;

    return (
      <div key={lokasi.id}>
        <div
          className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 mb-2"
          style={{ marginLeft: `${depth * 20}px` }}
        >
          {isEditing ? (
            <>
              <input
                type="text"
                value={editingForm.nama}
                onChange={(e) => setEditingForm({ ...editingForm, nama: e.target.value })}
                autoFocus
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/50 text-slate-200 text-xs focus:outline-none"
              />
              <select
                value={editingForm.tipe}
                onChange={(e) =>
                  setEditingForm({ ...editingForm, tipe: e.target.value as TipeLokasi })
                }
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs cursor-pointer focus:outline-none"
              >
                {TIPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                <CheckCircle2 size={14} />
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <TipeIcon size={16} className={`${getTipeColor(lokasi.tipe)} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{lokasi.nama}</p>
                {lokasi.keterangan && (
                  <p className="text-[10px] text-slate-500 truncate">{lokasi.keterangan}</p>
                )}
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                {lokasi.tipe}
              </span>
              <button
                onClick={() => startEdit(lokasi)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setDeleteTarget(lokasi)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Hapus"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>

        {lokasi.children.map((child) =>
          renderLokasiRow(
            { ...child, children: [] }, // simple — hanya 2 level untuk tampilan tree
            depth + 1
          )
        )}
      </div>
    );
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Lokasi Sarpras" size="lg">
        <div className="space-y-5 pt-1">
          {/* Info */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-300 leading-relaxed">
            Lokasi mendukung hierarki: <strong>Gedung → Lantai → Ruang</strong>. Pilih parent
            agar aset bisa dilacak keberadaannya.
          </div>

          {/* Form Tambah */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Tambah Lokasi Baru
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Nama Lokasi *</label>
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
                  placeholder="Contoh: Ruang Kepala Sekolah"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Tipe *</label>
                <select
                  value={form.tipe}
                  onChange={(e) => setForm({ ...form, tipe: e.target.value as TipeLokasi })}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {TIPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Parent (Opsional)</label>
              <select
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                <option value="">-- Tanpa Parent (Root) --</option>
                {lokasiList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.tipe} — {l.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Keterangan</label>
              <input
                type="text"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Info tambahan (opsional)"
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAdd}
                disabled={saving || !form.nama.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Tambah Lokasi
              </button>
            </div>
          </div>

          {/* List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Daftar Lokasi ({lokasiList.length})
              </h4>
            </div>

            {lokasiList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Belum ada lokasi terdaftar.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {lokasiTree.map((root) => renderLokasiRow(root, 0))}
              </div>
            )}
          </div>

          {/* Footer */}
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
        title="Hapus Lokasi"
        message={`Yakin hapus "${deleteTarget?.nama}"? Aset dengan lokasi ini akan kehilangan referensi.`}
      />
    </>
  );
}