// src/components/arsip/ModalKategori.tsx
// Modal CRUD kategori arsip dengan icon & color picker.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, Shield, Clock, Hash,
  FileText, Award, BookOpen, ClipboardList, Wallet, UserCog,
  FolderOpen, Lock, Key, Target, Star, Briefcase, GraduationCap,
  Building2, Users, Home, FileCheck, Receipt, Landmark, School,
  Package, Newspaper, Megaphone, Globe, Map, PieChart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import type { ArsipKategori, AksesLevel } from '@/types/database';

// =============================================================================
// CONSTANTS
// =============================================================================
const ICON_OPTIONS: { name: string; Icon: any }[] = [
  { name: 'FileText', Icon: FileText },
  { name: 'Award', Icon: Award },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'ClipboardList', Icon: ClipboardList },
  { name: 'Wallet', Icon: Wallet },
  { name: 'UserCog', Icon: UserCog },
  { name: 'FolderOpen', Icon: FolderOpen },
  { name: 'Shield', Icon: Shield },
  { name: 'Lock', Icon: Lock },
  { name: 'Key', Icon: Key },
  { name: 'Target', Icon: Target },
  { name: 'Star', Icon: Star },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'Building2', Icon: Building2 },
  { name: 'Users', Icon: Users },
  { name: 'Home', Icon: Home },
  { name: 'FileCheck', Icon: FileCheck },
  { name: 'Receipt', Icon: Receipt },
  { name: 'Landmark', Icon: Landmark },
  { name: 'School', Icon: School },
  { name: 'Package', Icon: Package },
  { name: 'Newspaper', Icon: Newspaper },
  { name: 'Megaphone', Icon: Megaphone },
  { name: 'Globe', Icon: Globe },
  { name: 'Map', Icon: Map },
  { name: 'PieChart', Icon: PieChart },
];

const COLOR_OPTIONS = [
  { name: 'indigo', bg: 'bg-indigo-500' },
  { name: 'emerald', bg: 'bg-emerald-500' },
  { name: 'teal', bg: 'bg-teal-500' },
  { name: 'amber', bg: 'bg-amber-500' },
  { name: 'blue', bg: 'bg-blue-500' },
  { name: 'purple', bg: 'bg-purple-500' },
  { name: 'cyan', bg: 'bg-cyan-500' },
  { name: 'rose', bg: 'bg-rose-500' },
  { name: 'pink', bg: 'bg-pink-500' },
  { name: 'slate', bg: 'bg-slate-500' },
];

const emptyForm = {
  nama: '',
  deskripsi: '',
  icon: 'FileText',
  warna: 'indigo',
  akses_level: 'Public' as AksesLevel,
  retensi_default_bulan: 60,
  urutan_tampil: 10,
  is_aktif: true,
};

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: ArsipKategori | null;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalKategori({ open, onClose, onSaved, editing }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        nama: editing.nama,
        deskripsi: editing.deskripsi ?? '',
        icon: editing.icon ?? 'FileText',
        warna: editing.warna,
        akses_level: editing.akses_level,
        retensi_default_bulan: editing.retensi_default_bulan,
        urutan_tampil: editing.urutan_tampil,
        is_aktif: editing.is_aktif,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, editing]);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama kategori wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        icon: form.icon,
        warna: form.warna,
        akses_level: form.akses_level,
        retensi_default_bulan: form.retensi_default_bulan,
        urutan_tampil: form.urutan_tampil,
        is_aktif: form.is_aktif,
      };

      if (isEdit && editing?.id) {
        const { error } = await supabase
          .from('arsip_kategori')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: editing.id,
          deskripsi: `Update kategori arsip: ${payload.nama}`,
        });
        showToast('success', 'Kategori diperbarui');
      } else {
        const { data, error } = await supabase
          .from('arsip_kategori')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: data?.id,
          deskripsi: `Buat kategori arsip: ${payload.nama}`,
        });
        showToast('success', 'Kategori dibuat');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      if (err.code === '23505') {
        showToast('error', 'Nama kategori sudah ada');
      } else {
        showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
      }
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  const PreviewIcon = ICON_OPTIONS.find((i) => i.name === form.icon)?.Icon ?? FileText;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Kategori' : 'Kategori Baru'}
      size="md"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* PREVIEW */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              form.warna === 'indigo' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
              form.warna === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
              form.warna === 'teal' ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' :
              form.warna === 'amber' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
              form.warna === 'blue' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
              form.warna === 'purple' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
              form.warna === 'cyan' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
              form.warna === 'rose' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
              form.warna === 'pink' ? 'bg-pink-500/15 text-pink-400 border-pink-500/30' :
              'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <PreviewIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Preview
            </p>
            <p className="text-sm font-bold text-slate-100 truncate">
              {form.nama || 'Nama Kategori'}
            </p>
          </div>
        </div>

        {/* NAMA */}
        <div>
          <label className={LABEL_CLASS}>Nama Kategori *</label>
          <input
            type="text"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="Contoh: SOP & Prosedur"
            className={INPUT_CLASS}
          />
        </div>

        {/* DESKRIPSI */}
        <div>
          <label className={LABEL_CLASS}>Deskripsi</label>
          <textarea
            rows={2}
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            placeholder="Keterangan singkat kategori..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* ICON PICKER */}
        <div>
          <label className={LABEL_CLASS}>Icon</label>
          <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 max-h-40 overflow-y-auto custom-scrollbar">
            {ICON_OPTIONS.map(({ name, Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setForm({ ...form, icon: name })}
                className={`aspect-square rounded-lg flex items-center justify-center transition cursor-pointer ${
                  form.icon === name
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={name}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* COLOR PICKER */}
        <div>
          <label className={LABEL_CLASS}>Warna</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setForm({ ...form, warna: c.name })}
                className={`w-8 h-8 rounded-lg transition cursor-pointer ${c.bg} ${
                  form.warna === c.name
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* AKSES LEVEL */}
        <div>
          <label className={LABEL_CLASS}>Akses Level</label>
          <select
            value={form.akses_level}
            onChange={(e) => setForm({ ...form, akses_level: e.target.value as AksesLevel })}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="Public">Public (semua guru bisa akses)</option>
            <option value="Internal">Internal (guru, staf)</option>
            <option value="Confidential">Confidential (admin, kepala, takola)</option>
          </select>
        </div>

        {/* RETENSI + URUTAN */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Retensi Default (bulan)</label>
            <input
              type="number"
              min={1}
              max={600}
              value={form.retensi_default_bulan}
              onChange={(e) => setForm({ ...form, retensi_default_bulan: Number(e.target.value) })}
              className={INPUT_CLASS + ' font-mono'}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Urutan Tampil</label>
            <input
              type="number"
              min={1}
              max={999}
              value={form.urutan_tampil}
              onChange={(e) => setForm({ ...form, urutan_tampil: Number(e.target.value) })}
              className={INPUT_CLASS + ' font-mono'}
            />
          </div>
        </div>

        {/* IS AKTIF */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_aktif}
              onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
              className="w-4 h-4 accent-indigo-500 cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-200">Aktif</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Kategori non-aktif tidak muncul saat upload dokumen baru
              </p>
            </div>
          </label>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Buat Kategori'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}