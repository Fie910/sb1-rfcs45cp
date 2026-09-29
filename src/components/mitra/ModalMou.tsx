// src/components/mitra/ModalMou.tsx
// Form create/edit MoU dengan upload PDF + parent (perpanjangan).

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, FileSignature, Upload, X, Paperclip, ExternalLink,
  AlertTriangle, Info, Calendar, Link2, Building2, History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS, formatFileSize, formatRupiah,
} from './shared';
import {
  JENIS_MOU_OPTIONS, STATUS_MOU_OPTIONS,
} from '@/types/database';
import type {
  MouWithRelations, MitraWithRelations, JenisMou, StatusMou,
} from '@/types/database';

const BUCKET = 'mitra-files';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: MouWithRelations | null;
  mitraList: MitraWithRelations[];
  currentGuruId: string;
};

const today = new Date().toISOString().slice(0, 10);
const threeYearsLater = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().slice(0, 10);
})();

const emptyForm = {
  mitra_id: '',
  jenis_mou: 'MoU' as JenisMou,
  judul: '',
  deskripsi: '',
  tanggal_mulai: today,
  tanggal_selesai: threeYearsLater,
  status: 'Draft' as StatusMou,
  penandatangan_sekolah_id: '',
  penandatangan_mitra_nama: '',
  penandatangan_mitra_jabatan: '',
  lingkup_kerjasama: '',
  nilai_kerjasama: '',
  file_url: '',
  parent_mou_id: '',
};

export function ModalMou({
  open, onClose, onSaved, editing, mitraList, currentGuruId,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [guruList, setGuruList] = useState<{ id: string; nama_lengkap: string; nip: string | null }[]>([]);
  const [parentOptions, setParentOptions] = useState<MouWithRelations[]>([]);
  const [loadingParent, setLoadingParent] = useState(false);

  const isEdit = Boolean(editing?.id);

  // Fetch guru list untuk penandatangan
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('gurus')
        .select('id, nama_lengkap, nip')
        .order('nama_lengkap');
      setGuruList((data as any[]) ?? []);
    })();
  }, [open]);

  // Fetch parent MoU options (untuk addendum/perpanjangan)
  useEffect(() => {
    if (!open || !form.mitra_id || isEdit) {
      setParentOptions([]);
      return;
    }
    setLoadingParent(true);
    (async () => {
      const { data } = await supabase
        .from('v_mou_lengkap')
        .select('*')
        .eq('mitra_id', form.mitra_id)
        .in('status', ['Aktif', 'Expired', 'Diperpanjang'])
        .order('tanggal_selesai', { ascending: false });
      setParentOptions((data as MouWithRelations[]) ?? []);
      setLoadingParent(false);
    })();
  }, [open, form.mitra_id, isEdit]);

  // Reset saat open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        mitra_id: editing.mitra_id,
        jenis_mou: editing.jenis_mou,
        judul: editing.judul,
        deskripsi: editing.deskripsi ?? '',
        tanggal_mulai: editing.tanggal_mulai,
        tanggal_selesai: editing.tanggal_selesai,
        status: editing.status,
        penandatangan_sekolah_id: editing.penandatangan_sekolah_id ?? '',
        penandatangan_mitra_nama: editing.penandatangan_mitra_nama ?? '',
        penandatangan_mitra_jabatan: editing.penandatangan_mitra_jabatan ?? '',
        lingkup_kerjasama: editing.lingkup_kerjasama ?? '',
        nilai_kerjasama: editing.nilai_kerjasama ? String(editing.nilai_kerjasama) : '',
        file_url: editing.file_url ?? '',
        parent_mou_id: editing.parent_mou_id ?? '',
      });
    } else {
      setForm({
        ...emptyForm,
        penandatangan_sekolah_id: currentGuruId,
      });
    }
    setSelectedFile(null);
  }, [open, editing, currentGuruId]);

  // Durasi auto-hitung
  const durasiBulan = useMemo(() => {
    if (!form.tanggal_mulai || !form.tanggal_selesai) return 0;
    const a = new Date(form.tanggal_mulai);
    const b = new Date(form.tanggal_selesai);
    return (
      (b.getFullYear() - a.getFullYear()) * 12 +
      (b.getMonth() - a.getMonth())
    );
  }, [form.tanggal_mulai, form.tanggal_selesai]);

  // ==========================================================================
  // UPLOAD
  // ==========================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'File maksimal 25 MB');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const uploadFile = async (file: File): Promise<{ url: string; size: number } | null> => {
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `mou-${Date.now()}-${safeName}`;
      const filePath = `${currentGuruId}/${fileName}`;

      setUploading(true);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '31536000', upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return { url: data.publicUrl, size: file.size };
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
      showToast('error', 'Judul MoU wajib diisi');
      return;
    }
    if (!form.tanggal_mulai || !form.tanggal_selesai) {
      showToast('error', 'Periode wajib diisi');
      return;
    }
    if (new Date(form.tanggal_selesai) <= new Date(form.tanggal_mulai)) {
      showToast('error', 'Tanggal selesai harus setelah tanggal mulai');
      return;
    }

    setSaving(true);
    try {
      let fileUrl: string | null = form.file_url || null;
      let fileSize: number | null = null;

      if (selectedFile) {
        const uploaded = await uploadFile(selectedFile);
        if (!uploaded) { setSaving(false); return; }
        fileUrl = uploaded.url;
        fileSize = uploaded.size;
      } else if (editing?.file_size) {
        fileSize = editing.file_size;
      }

      const payload = {
        mitra_id: form.mitra_id,
        jenis_mou: form.jenis_mou,
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim() || null,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: form.tanggal_selesai,
        status: form.status,
        penandatangan_sekolah_id: form.penandatangan_sekolah_id || null,
        penandatangan_mitra_nama: form.penandatangan_mitra_nama.trim() || null,
        penandatangan_mitra_jabatan: form.penandatangan_mitra_jabatan.trim() || null,
        lingkup_kerjasama: form.lingkup_kerjasama.trim() || null,
        nilai_kerjasama: form.nilai_kerjasama ? Number(form.nilai_kerjasama) : null,
        file_url: fileUrl,
        file_size: fileSize,
        parent_mou_id: form.parent_mou_id || null,
      };

      if (isEdit && editing?.id) {
        const { error } = await supabase.from('mou').update(payload).eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE', modul: AUDIT_MODUL.HRIS,
          targetId: editing.id, deskripsi: `Update MoU: ${payload.judul}`,
        });
        showToast('success', 'MoU diperbarui');
      } else {
        const { data, error } = await supabase
          .from('mou')
          .insert({ ...payload, created_by: currentGuruId })
          .select().single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE', modul: AUDIT_MODUL.HRIS,
          targetId: data?.id, deskripsi: `Buat MoU: ${payload.judul}`,
        });
        showToast('success', 'MoU dibuat');
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
      title={isEdit ? 'Edit MoU' : 'MoU Baru'}
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
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
              onChange={(v) => setForm({ ...form, mitra_id: v, parent_mou_id: '' })}
              placeholder="Pilih mitra..."
              searchPlaceholder="Cari mitra..."
              emptyMessage="Mitra tidak ditemukan"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Jenis Dokumen *</label>
            <select
              value={form.jenis_mou}
              onChange={(e) => setForm({ ...form, jenis_mou: e.target.value as JenisMou })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {JENIS_MOU_OPTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
        </div>

        {/* PARENT MOU — hanya kalau bukan edit & mitra dipilih */}
        {!isEdit && form.mitra_id && parentOptions.length > 0 && (
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
            <div className="flex items-start gap-2.5 mb-2">
              <History size={13} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-cyan-300">Perpanjangan / Addendum?</p>
                <p className="text-slate-400 mt-0.5">
                  Kalau MoU ini perpanjangan dari yang lama, pilih MoU induk di bawah.
                </p>
              </div>
            </div>
            <SearchableSelect
              options={[
                { value: '', label: '— MoU Baru (bukan perpanjangan) —' },
                ...parentOptions.map((m) => ({
                  value: m.id,
                  label: `${m.nomor_mou ?? '-'} · ${m.judul.slice(0, 40)}`,
                })),
              ]}
              value={form.parent_mou_id}
              onChange={(v) => setForm({ ...form, parent_mou_id: v })}
              placeholder="Pilih MoU induk (opsional)..."
              searchPlaceholder="Cari MoU..."
              emptyMessage="Tidak ditemukan"
            />
          </div>
        )}

        {/* JUDUL */}
        <div>
          <label className={LABEL_CLASS}>Judul MoU *</label>
          <input
            type="text"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            placeholder="Contoh: Kerjasama Praktik Kerja Lapangan (PKL) Siswa SMK"
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
            placeholder="Ringkasan isi MoU..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* PERIODE */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Calendar size={12} /> Periode Kerjasama
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Mulai *</label>
              <input
                type="date"
                value={form.tanggal_mulai}
                onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Tanggal Selesai *</label>
              <input
                type="date"
                value={form.tanggal_selesai}
                onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
          </div>
          {durasiBulan > 0 && (
            <p className="text-[11px] text-indigo-300 bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-2 flex items-center gap-1.5">
              <Info size={11} /> Durasi: <span className="font-bold">{durasiBulan} bulan</span>
            </p>
          )}
        </div>

        {/* STATUS */}
        <div>
          <label className={LABEL_CLASS}>Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as StatusMou })}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            {STATUS_MOU_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* PENANDATANGAN */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Building2 size={12} /> Penandatangan
          </div>
          <div>
            <label className={LABEL_CLASS}>Dari Sekolah</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: `${g.nama_lengkap}${g.nip ? ` · ${g.nip}` : ''}`,
              }))}
              value={form.penandatangan_sekolah_id}
              onChange={(v) => setForm({ ...form, penandatangan_sekolah_id: v })}
              placeholder="Pilih penandatangan..."
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Nama (dari Mitra)</label>
              <input
                type="text"
                value={form.penandatangan_mitra_nama}
                onChange={(e) => setForm({ ...form, penandatangan_mitra_nama: e.target.value })}
                placeholder="Nama direktur/manager"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Jabatan</label>
              <input
                type="text"
                value={form.penandatangan_mitra_jabatan}
                onChange={(e) => setForm({ ...form, penandatangan_mitra_jabatan: e.target.value })}
                placeholder="Direktur, HRD, dll"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        {/* LINGKUP + NILAI */}
        <div>
          <label className={LABEL_CLASS}>Lingkup Kerjasama</label>
          <textarea
            rows={3}
            value={form.lingkup_kerjasama}
            onChange={(e) => setForm({ ...form, lingkup_kerjasama: e.target.value })}
            placeholder="Contoh: PKL siswa kelas XI-XII, UKK, dan pelatihan guru produktif..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Nilai Kerjasama (opsional)</label>
          <input
            type="number"
            min={0}
            value={form.nilai_kerjasama}
            onChange={(e) => setForm({ ...form, nilai_kerjasama: e.target.value })}
            placeholder="Contoh: 50000000"
            className={INPUT_CLASS + ' font-mono'}
          />
          {form.nilai_kerjasama && Number(form.nilai_kerjasama) > 0 && (
            <p className="text-[10px] text-emerald-400 mt-1">
              {formatRupiah(Number(form.nilai_kerjasama))}
            </p>
          )}
        </div>

        {/* FILE UPLOAD */}
        <div>
          <label className={LABEL_CLASS}>File MoU (PDF)</label>

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
            <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
              <Upload size={20} className="text-indigo-400 mb-1.5" />
              <p className="text-[11px] text-slate-400">Klik untuk upload file MoU</p>
              <p className="text-[10px] text-slate-500 mt-0.5">PDF maksimal 25 MB</p>
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
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Buat MoU'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}