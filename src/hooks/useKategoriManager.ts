// src/hooks/useKategoriManager.ts
// Custom hook untuk CRUD master kategori (dipakai di Kedisiplinan, Perpustakaan, Sarpras).
// Menangani: state form, saving, edit, delete, logActivity, toast, onChanged.
//
// Setiap modul tetap punya JSX sendiri, tapi logic-nya terpusat di sini.

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity } from '@/utils/audit';

// =============================================================================
// TYPES
// =============================================================================

type KategoriBase = { id: string; nama: string };
type FormState = Record<string, any>;

export type UseKategoriManagerOptions<T extends KategoriBase> = {
  /** Nama tabel Supabase, mis: 'kategori_sarpras' */
  tableName: string;
  /** Modul untuk audit log, mis: AUDIT_MODUL.SARPRAS */
  logModul: string;
  /** Label entity untuk toast & log, mis: 'Kategori sarpras' */
  label: string;
  /** Form awal (kosong), mis: { nama: '', deskripsi: '' } */
  emptyForm: FormState;
  /** Konversi form → payload untuk Supabase */
  buildPayload: (form: FormState) => Record<string, any>;
  /** Konversi item dari DB → form (untuk edit mode) */
  formFromItem: (item: T) => FormState;
  /** Validasi form. Return pesan error, atau null kalau valid. */
  validateForm?: (form: FormState) => string | null;
  /** Callback setelah sukses CRUD (biasanya reload data) */
  onChanged: () => void;
};

// =============================================================================
// HOOK
// =============================================================================

export function useKategoriManager<T extends KategoriBase>({
  tableName,
  logModul,
  label,
  emptyForm,
  buildPayload,
  formFromItem,
  validateForm,
  onChanged,
}: UseKategoriManagerOptions<T>) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const resetForm = () => setForm(emptyForm);

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------
  const handleAdd = async () => {
    // Validasi
    if (validateForm) {
      const error = validateForm(form);
      if (error) {
        showToast('error', error);
        return;
      }
    } else if (!form.nama?.trim()) {
      showToast('error', 'Nama kategori wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from(tableName).insert(buildPayload(form));
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE',
        modul: logModul,
        deskripsi: `Tambah ${label}: ${form.nama?.trim()}`,
      });

      showToast('success', `${label} ditambahkan`);
      resetForm();
      onChanged();
    } catch (err: any) {
      if (err.code === '23505') {
        showToast('error', `${label} sudah ada`);
      } else {
        showToast('error', 'Gagal menambah: ' + (err.message || 'Error'));
      }
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------------------------
  const startEdit = (item: T) => {
    setEditingId(item.id);
    setEditingForm(formFromItem(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingForm(emptyForm);
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    if (validateForm) {
      const error = validateForm(editingForm);
      if (error) {
        showToast('error', error);
        return;
      }
    } else if (!editingForm.nama?.trim()) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update(buildPayload(editingForm))
        .eq('id', editingId);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: logModul,
        targetId: editingId,
        deskripsi: `Update ${label}: ${editingForm.nama?.trim()}`,
      });

      showToast('success', `${label} diperbarui`);
      cancelEdit();
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal update: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: logModul,
        targetId: deleteTarget.id,
        deskripsi: `Hapus ${label}: ${deleteTarget.nama}`,
      });

      showToast('success', `${label} dihapus`);
      setDeleteTarget(null);
      onChanged();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  return {
    // state
    saving,
    form,
    setForm,
    editingId,
    editingForm,
    setEditingForm,
    deleteTarget,
    setDeleteTarget,
    // actions
    handleAdd,
    startEdit,
    cancelEdit,
    handleUpdate,
    handleDelete,
    resetForm,
  };
}