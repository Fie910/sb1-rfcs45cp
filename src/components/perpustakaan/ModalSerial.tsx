// src/components/perpustakaan/ModalSerial.tsx
// Form Tambah/Edit Serial (Majalah/Jurnal/Koran/Buletin).

import { useState, useEffect } from 'react';
import { Loader2, Save, Newspaper, Calendar, Library } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS, JENIS_SERIAL_OPTIONS,
} from './shared';
import type { PerpusSerial, PerpusRak, JenisSerial } from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type Props = {
  open: boolean;
  onClose: () => void;
  serial?: PerpusSerial | null;
  rakList: PerpusRak[];
  onSaved: () => void;
};

const emptyForm = {
  nama: '',
  jenis: 'Majalah' as JenisSerial,
  penerbit: '',
  edisi: '',
  tanggal_terbit: '',
  jumlah: '1',
  rak_id: '',
  keterangan: '',
  is_aktif: true,
};

export function ModalSerial({ open, onClose, serial, rakList, onSaved }: Props) {
  const isEdit = Boolean(serial?.id);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (serial) {
      setForm({
        nama: serial.nama,
        jenis: serial.jenis,
        penerbit: serial.penerbit ?? '',
        edisi: serial.edisi ?? '',
        tanggal_terbit: serial.tanggal_terbit ?? '',
        jumlah: String(serial.jumlah),
        rak_id: serial.rak_id ?? '',
        keterangan: serial.keterangan ?? '',
        is_aktif: serial.is_aktif,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, serial]);

  const handleSubmit = async () => {
    if (!form.nama.trim()) { showToast('error', 'Nama serial wajib diisi'); return; }
    const jml = Number(form.jumlah);
    if (!jml || jml < 0) { showToast('error', 'Jumlah minimal 0'); return; }

    setSaving(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        jenis: form.jenis,
        penerbit: form.penerbit.trim() || null,
        edisi: form.edisi.trim() || null,
        tanggal_terbit: form.tanggal_terbit || null,
        jumlah: jml,
        rak_id: form.rak_id || null,
        keterangan: form.keterangan.trim() || null,
        is_aktif: form.is_aktif,
      };

      if (isEdit && serial?.id) {
        const { error } = await supabase.from('perpus_serial')
          .update(payload).eq('id', serial.id);
        if (error) throw error;
        await logActivity({
          aksi: 'UPDATE', modul: MODUL_PERPUS, targetId: serial.id,
          deskripsi: `Update serial: ${payload.nama}`,
        });
        showToast('success', 'Serial diperbarui');
      } else {
        const { data, error } = await supabase.from('perpus_serial')
          .insert(payload).select().single();
        if (error) throw error;
        await logActivity({
          aksi: 'CREATE', modul: MODUL_PERPUS, targetId: data?.id,
          deskripsi: `Tambah serial: ${payload.nama}`,
        });
        showToast('success', 'Serial ditambahkan');
      }
      onSaved(); onClose();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? 'Edit Serial' : 'Tambah Serial Baru'} size="md">
      <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        <div>
          <label className={LABEL_CLASS}>Jenis *</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {JENIS_SERIAL_OPTIONS.map((j) => (
              <button key={j} type="button"
                onClick={() => setForm({ ...form, jenis: j })}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                  form.jenis === j
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}>
                {j}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Nama Serial *</label>
          <input type="text" value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="Contoh: Majalah Tempo Edisi 45"
            className={INPUT_CLASS} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Penerbit</label>
            <input type="text" value={form.penerbit}
              onChange={(e) => setForm({ ...form, penerbit: e.target.value })}
              placeholder="Tempo Inti Media"
              className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Edisi</label>
            <input type="text" value={form.edisi}
              onChange={(e) => setForm({ ...form, edisi: e.target.value })}
              placeholder="Edisi 45 / Vol. 12"
              className={INPUT_CLASS} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal Terbit</label>
            <input type="date" value={form.tanggal_terbit}
              onChange={(e) => setForm({ ...form, tanggal_terbit: e.target.value })}
              className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Jumlah Eksemplar</label>
            <input type="number" min={0} value={form.jumlah}
              onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
              className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Lokasi Rak</label>
            <SearchableSelect
              options={rakList.map((r) => ({
                value: r.id, label: r.nama, hint: r.lokasi ?? undefined,
              }))}
              value={form.rak_id}
              onChange={(v) => setForm({ ...form, rak_id: v })}
              placeholder="Pilih rak..."
              searchPlaceholder="Cari rak..."
              emptyMessage="Rak tidak ditemukan"
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Keterangan</label>
          <textarea rows={2} value={form.keterangan}
            onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            placeholder="Catatan tambahan..."
            className={INPUT_CLASS + ' resize-none'} />
        </div>

        <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
          <input type="checkbox" checked={form.is_aktif}
            onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
            className="accent-indigo-500 cursor-pointer" />
          <span className="text-xs text-slate-300">Aktif & tampil di OPAC</span>
        </label>

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Simpan Perubahan' : 'Simpan Serial'}
          </button>
        </div>
      </div>
    </Modal>
  );
}