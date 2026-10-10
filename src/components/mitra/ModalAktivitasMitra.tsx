// src/components/mitra/ModalAktivitasMitra.tsx
// Form create/edit aktivitas mitra (PKL, rekrutmen, pelatihan, dll).

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, History, Upload, X, Paperclip, ExternalLink,
  Users, GraduationCap, Calendar, Info, FileText, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  INPUT_CLASS, LABEL_CLASS, formatFileSize,
} from './shared';
import {
  JENIS_AKTIVITAS_OPTIONS,
} from '@/types/database';
import type {
  MitraAktivitasWithRelations, MitraWithRelations,
  MouWithRelations, JenisAktivitasMitra,
} from '@/types/database';

const BUCKET = 'mitra-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: MitraAktivitasWithRelations | null;
  mitraList: MitraWithRelations[];
  currentGuruId: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  mitra_id: '',
  mou_id: '',
  jenis: 'PKL' as JenisAktivitasMitra,
  judul: '',
  deskripsi: '',
  tanggal: today,
  jumlah_siswa: '',
  jumlah_guru: '',
  file_url: '',
};

export function ModalAktivitasMitra({
  open, onClose, onSaved, editing, mitraList, currentGuruId,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [mouOptions, setMouOptions] = useState<MouWithRelations[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingMou, setLoadingMou] = useState(false);

  const isEdit = Boolean(editing?.id);

  // ==========================================================================
  // FETCH MoU opsi untuk mitra terpilih
  // ==========================================================================
  useEffect(() => {
    if (!open || !form.mitra_id) {
      setMouOptions([]);
      return;
    }
    setLoadingMou(true);
    (async () => {
      const { data } = await supabase
        .from('v_mou_lengkap')
        .select('*')
        .eq('mitra_id', form.mitra_id)
        .in('status', ['Aktif', 'Diperpanjang', 'Expired'])
        .order('tanggal_mulai', { ascending: false });
      setMouOptions((data as MouWithRelations[]) ?? []);
      setLoadingMou(false);
    })();
  }, [open, form.mitra_id]);

  // Reset saat open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        mitra_id: editing.mitra_id,
        mou_id: editing.mou_id ?? '',
        jenis: editing.jenis,
        judul: editing.judul,
        deskripsi: editing.deskripsi ?? '',
        tanggal: editing.tanggal,
        jumlah_siswa: editing.jumlah_siswa ? String(editing.jumlah_siswa) : '',
        jumlah_guru: editing.jumlah_guru ? String(editing.jumlah_guru) : '',
        file_url: editing.file_url ?? '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setSelectedFile(null);
  }, [open, editing]);

  // ==========================================================================
  // CONDITIONAL FIELD VISIBILITY
  // ==========================================================================
  const showSiswaField = useMemo(
    () => ['PKL', 'UKK', 'Rekrutmen', 'Pelatihan Siswa', 'Kunjungan Industri'].includes(form.jenis),
    [form.jenis]
  );
  const showGuruField = useMemo(
    () => ['Pelatihan Guru', 'Guest Teacher'].includes(form.jenis),
    [form.jenis]
  );

  // ==========================================================================
  // FILE
  // ==========================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'File maksimal 10 MB');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `akt-${Date.now()}-${safeName}`;
      const filePath = `${currentGuruId}/${fileName}`;

      setUploading(true);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '31536000', upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      showToast('error', 'Upload gagal: ' + (err.message || 'Error'));
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.mitra_id) {
      showToast('error', 'Mitra wajib dipilih');
      return;
    }
    if (!form.judul.trim()) {
      showToast('error', 'Judul aktivitas wajib diisi');
      return;
    }
    if (!form.tanggal) {
      showToast('error', 'Tanggal wajib diisi');
      return;
    }

    setSaving(true);
    try {
      let fileUrl: string | null = form.file_url || null;
      if (selectedFile) {
        const uploaded = await uploadFile(selectedFile);
        if (!uploaded) { setSaving(false); return; }
        fileUrl = uploaded;
      }

      const payload = {
        mitra_id: form.mitra_id,
        mou_id: form.mou_id || null,
        jenis: form.jenis,
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim() || null,
        tanggal: form.tanggal,
        jumlah_siswa: form.jumlah_siswa ? Number(form.jumlah_siswa) : null,
        jumlah_guru: form.jumlah_guru ? Number(form.jumlah_guru) : null,
        file_url: fileUrl,
      };

      if (isEdit && editing?.id) {
        const { error } = await supabase.from('mitra_aktivitas').update(payload).eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE', modul: AUDIT_MODUL.HRIS,
          targetId: editing.id, deskripsi: `Update aktivitas: ${payload.judul}`,
        });
        showToast('success', 'Aktivitas diperbarui');
      } else {
        const { data, error } = await supabase
          .from('mitra_aktivitas')
          .insert({ ...payload, created_by: currentGuruId })
          .select().single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE', modul: AUDIT_MODUL.HRIS,
          targetId: data?.id, deskripsi: `Catat aktivitas: ${payload.judul}`,
        });
        showToast('success', 'Aktivitas dicatat');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Aktivitas' : 'Catat Aktivitas Baru'}
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* INFO */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Catat setiap kerjasama dengan mitra: PKL, UKK, rekrutmen, pelatihan,
            kunjungan industri, dll. Data ini akan tampil di statistik mitra.
          </p>
        </div>

        {/* MITRA + JENIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Mitra *</label>
            <SearchableSelect
              options={mitraList.map((m) => ({
                value: m.id,
                label: `${m.nama}${m.kota ? ` · ${m.kota}` : ''}`,
              }))}
              value={form.mitra_id}
              onChange={(v) => setForm({ ...form, mitra_id: v, mou_id: '' })}
              placeholder="Pilih mitra..."
              searchPlaceholder="Cari mitra..."
              emptyMessage="Mitra tidak ditemukan"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Jenis Aktivitas *</label>
            <select
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisAktivitasMitra })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {JENIS_AKTIVITAS_OPTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
        </div>

        {/* MoU Link (opsional) */}
        {form.mitra_id && (
          <div>
            <label className={LABEL_CLASS}>
              Link ke MoU (opsional)
              {loadingMou && <Loader2 size={10} className="inline-block ml-2 animate-spin" />}
            </label>
            {mouOptions.length === 0 && !loadingMou ? (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-slate-400">
                Belum ada MoU aktif dengan mitra ini. Aktivitas tetap bisa disimpan tanpa link.
              </div>
            ) : (
              <SearchableSelect
                options={[
                  { value: '', label: '— Tidak ada MoU terkait —' },
                  ...mouOptions.map((m) => ({
                    value: m.id,
                    label: `${m.nomor_mou ?? '-'} · ${m.judul.slice(0, 40)}`,
                  })),
                ]}
                value={form.mou_id}
                onChange={(v) => setForm({ ...form, mou_id: v })}
                placeholder="Pilih MoU..."
                searchPlaceholder="Cari MoU..."
                emptyMessage="MoU tidak ditemukan"
              />
            )}
          </div>
        )}

        {/* JUDUL */}
        <div>
          <label className={LABEL_CLASS}>Judul Aktivitas *</label>
          <input
            type="text"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            placeholder="Contoh: PKL Gelombang 1 Tahun 2026, Rekrutmen Lulusan 2026"
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
            placeholder="Detail aktivitas (kelas berapa, jurusan apa, dll)..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* TANGGAL */}
        <div>
          <label className={LABEL_CLASS}>Tanggal *</label>
          <input
            type="date"
            value={form.tanggal}
            onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
            className={INPUT_CLASS + ' font-mono'}
          />
        </div>

        {/* JUMLAH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showSiswaField && (
            <div>
              <label className={LABEL_CLASS}>
                <Users size={11} className="inline mr-1" /> Jumlah Siswa
              </label>
              <input
                type="number"
                min={0}
                value={form.jumlah_siswa}
                onChange={(e) => setForm({ ...form, jumlah_siswa: e.target.value })}
                placeholder="0"
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
          )}
          {showGuruField && (
            <div>
              <label className={LABEL_CLASS}>
                <GraduationCap size={11} className="inline mr-1" /> Jumlah Guru
              </label>
              <input
                type="number"
                min={0}
                value={form.jumlah_guru}
                onChange={(e) => setForm({ ...form, jumlah_guru: e.target.value })}
                placeholder="0"
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
          )}
        </div>

        {/* FILE */}
        <div>
          <label className={LABEL_CLASS}>File / Dokumentasi (opsional)</label>

          {form.file_url && !selectedFile && (
            <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs">
              <Paperclip size={14} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-300 truncate flex-1">File lama tersimpan</span>
              <a
                href={form.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              >
                <ExternalLink size={11} />
              </a>
              <button
                type="button"
                onClick={() => setForm({ ...form, file_url: '' })}
                className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {selectedFile && (
            <div className="mb-2 p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-xs">
              <Paperclip size={14} className="text-indigo-400 shrink-0" />
              <span className="text-indigo-300 truncate flex-1">{selectedFile.name}</span>
              <span className="text-[10px] text-slate-500">{formatFileSize(selectedFile.size)}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {!selectedFile && !form.file_url && (
            <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
              <Upload size={18} className="text-indigo-400 mb-1" />
              <p className="text-[11px] text-slate-400">Upload file dokumentasi</p>
              <p className="text-[10px] text-slate-500 mt-0.5">PDF / gambar · maks 10 MB</p>
              <input
                type="file"
                accept=".pdf,application/pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}

          {(form.file_url || selectedFile) && (
            <label className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition cursor-pointer">
              <Upload size={11} /> Ganti File
              <input
                type="file"
                accept=".pdf,application/pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
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
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Upload...</>
            ) : saving ? (
              <><Loader2 size={14} className="animate-spin" /> Simpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Catat Aktivitas'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}