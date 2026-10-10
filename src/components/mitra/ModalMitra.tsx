// src/components/mitra/ModalMitra.tsx
// Form create/edit mitra dengan tab sections.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, Building2, MapPin, User, Star, X, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  INPUT_CLASS, LABEL_CLASS, formatFileSize,
} from './shared';
import {
  JENIS_MITRA_OPTIONS, SKALA_MITRA_OPTIONS, STATUS_MITRA_OPTIONS,
  KATEGORI_KERJASAMA_OPTIONS,
} from '@/types/database';
import type {
  MitraWithRelations, JenisMitra, SkalaMitra, StatusMitra,
} from '@/types/database';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const BUCKET = 'mitra-files';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: MitraWithRelations | null;
  currentGuruId: string;
};

const emptyForm = {
  nama: '',
  jenis_mitra: 'PT' as JenisMitra,
  bidang_industri: '',
  deskripsi: '',
  kategori_kerjasama: [] as string[],
  alamat: '',
  kota: '',
  provinsi: '',
  kode_pos: '',
  website: '',
  telepon: '',
  email: '',
  pic_nama: '',
  pic_jabatan: '',
  pic_no_hp: '',
  pic_email: '',
  skala: '' as '' | SkalaMitra,
  rating: 3,
  status: 'Aktif' as StatusMitra,
  catatan: '',
  logo_url: '',
};

export function ModalMitra({
  open, onClose, onSaved, editing, currentGuruId,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        nama: editing.nama,
        jenis_mitra: editing.jenis_mitra,
        bidang_industri: editing.bidang_industri ?? '',
        deskripsi: editing.deskripsi ?? '',
        kategori_kerjasama: editing.kategori_kerjasama ?? [],
        alamat: editing.alamat ?? '',
        kota: editing.kota ?? '',
        provinsi: editing.provinsi ?? '',
        kode_pos: editing.kode_pos ?? '',
        website: editing.website ?? '',
        telepon: editing.telepon ?? '',
        email: editing.email ?? '',
        pic_nama: editing.pic_nama ?? '',
        pic_jabatan: editing.pic_jabatan ?? '',
        pic_no_hp: editing.pic_no_hp ?? '',
        pic_email: editing.pic_email ?? '',
        skala: (editing.skala ?? '') as '' | SkalaMitra,
        rating: editing.rating ?? 3,
        status: editing.status,
        catatan: editing.catatan ?? '',
        logo_url: editing.logo_url ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setSelectedLogo(null);
  }, [open, editing]);

  const toggleKategori = (kat: string) => {
    setForm((f) => ({
      ...f,
      kategori_kerjasama: f.kategori_kerjasama.includes(kat)
        ? f.kategori_kerjasama.filter((x) => x !== kat)
        : [...f.kategori_kerjasama, kat],
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE) {
      showToast('error', 'Logo maksimal 2 MB');
      e.target.value = '';
      return;
    }
    setSelectedLogo(file);
  };

  const handleSubmit = async () => {
    if (!form.nama.trim()) {
      showToast('error', 'Nama mitra wajib diisi');
      return;
    }

    setSaving(true);
    try {
      let logoUrl: string | null = form.logo_url || null;

      // Upload logo kalau ada
      if (selectedLogo) {
        const ext = selectedLogo.name.split('.').pop() || 'png';
        const fileName = `logo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const filePath = `${currentGuruId}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, selectedLogo, { cacheControl: '31536000', upsert: false });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;
      }

      const payload = {
        nama: form.nama.trim(),
        jenis_mitra: form.jenis_mitra,
        bidang_industri: form.bidang_industri.trim() || null,
        deskripsi: form.deskripsi.trim() || null,
        kategori_kerjasama: form.kategori_kerjasama,
        alamat: form.alamat.trim() || null,
        kota: form.kota.trim() || null,
        provinsi: form.provinsi.trim() || null,
        kode_pos: form.kode_pos.trim() || null,
        website: form.website.trim() || null,
        telepon: form.telepon.trim() || null,
        email: form.email.trim() || null,
        pic_nama: form.pic_nama.trim() || null,
        pic_jabatan: form.pic_jabatan.trim() || null,
        pic_no_hp: form.pic_no_hp.trim() || null,
        pic_email: form.pic_email.trim() || null,
        skala: form.skala || null,
        rating: form.rating,
        status: form.status,
        catatan: form.catatan.trim() || null,
        logo_url: logoUrl,
      };

      if (isEdit && editing?.id) {
        const { error } = await supabase.from('mitra').update(payload).eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE', modul: AUDIT_MODUL.HRIS,
          targetId: editing.id, deskripsi: `Update mitra: ${payload.nama}`,
        });
        showToast('success', 'Mitra diperbarui');
      } else {
        const { data, error } = await supabase
          .from('mitra')
          .insert({ ...payload, created_by: currentGuruId })
          .select().single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE', modul: AUDIT_MODUL.HRIS,
          targetId: data?.id, deskripsi: `Buat mitra: ${payload.nama}`,
        });
        showToast('success', 'Mitra dibuat');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Mitra' : 'Mitra Baru'}
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* IDENTITAS */}
        <Section title="Identitas Perusahaan" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nama Mitra *">
              <input
                type="text"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="PT Teknologi Nusantara"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Jenis Mitra">
              <select
                value={form.jenis_mitra}
                onChange={(e) => setForm({ ...form, jenis_mitra: e.target.value as JenisMitra })}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {JENIS_MITRA_OPTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Bidang Industri">
              <input
                type="text"
                value={form.bidang_industri}
                onChange={(e) => setForm({ ...form, bidang_industri: e.target.value })}
                placeholder="Teknologi Informasi, Otomotif, dll"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Skala">
              <select
                value={form.skala}
                onChange={(e) => setForm({ ...form, skala: e.target.value as any })}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                <option value="">-- Pilih --</option>
                {SKALA_MITRA_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Deskripsi">
            <textarea
              rows={2}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Deskripsi singkat tentang mitra..."
              className={INPUT_CLASS + ' resize-none'}
            />
          </Field>

          <Field label="Logo (maks 2 MB)">
            <div className="space-y-2">
              {form.logo_url && !selectedLogo && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2">
                  <img src={form.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <span className="text-xs text-emerald-300 flex-1 truncate">Logo tersimpan</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: '' })}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:text-indigo-300 file:font-bold file:text-xs file:cursor-pointer hover:file:bg-indigo-500/30"
              />
              {selectedLogo && (
                <p className="text-[10px] text-slate-500">
                  {selectedLogo.name} · {formatFileSize(selectedLogo.size)}
                </p>
              )}
            </div>
          </Field>
        </Section>

        {/* KATEGORI KERJASAMA */}
        <Section title="Kategori Kerjasama">
          <div className="flex flex-wrap gap-2">
            {KATEGORI_KERJASAMA_OPTIONS.map((kat) => {
              const sel = form.kategori_kerjasama.includes(kat);
              return (
                <button
                  key={kat}
                  type="button"
                  onClick={() => toggleKategori(kat)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                    sel
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sel && <Check size={11} />}
                  {kat}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ALAMAT */}
        <Section title="Alamat" icon={MapPin}>
          <Field label="Alamat Lengkap">
            <textarea
              rows={2}
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
              className={INPUT_CLASS + ' resize-none'}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Kota">
              <input
                type="text"
                value={form.kota}
                onChange={(e) => setForm({ ...form, kota: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Provinsi">
              <input
                type="text"
                value={form.provinsi}
                onChange={(e) => setForm({ ...form, provinsi: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Kode Pos">
              <input
                type="text"
                value={form.kode_pos}
                onChange={(e) => setForm({ ...form, kode_pos: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Website">
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Telepon">
              <input
                type="text"
                value={form.telepon}
                onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </Section>

        {/* PIC */}
        <Section title="PIC / Kontak Person" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nama PIC">
              <input
                type="text"
                value={form.pic_nama}
                onChange={(e) => setForm({ ...form, pic_nama: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Jabatan PIC">
              <input
                type="text"
                value={form.pic_jabatan}
                onChange={(e) => setForm({ ...form, pic_jabatan: e.target.value })}
                placeholder="HRD Manager, Direktur, dll"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="No. HP PIC">
              <input
                type="tel"
                value={form.pic_no_hp}
                onChange={(e) => setForm({ ...form, pic_no_hp: e.target.value })}
                placeholder="08123456789"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Email PIC">
              <input
                type="email"
                value={form.pic_email}
                onChange={(e) => setForm({ ...form, pic_email: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </Section>

        {/* RATING & STATUS */}
        <Section title="Rating & Status" icon={Star}>
          <Field label={`Rating (${form.rating}/5)`}>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  className={`text-2xl transition cursor-pointer ${
                    n <= form.rating ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400/50'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusMitra })}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {STATUS_MITRA_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Catatan Internal">
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className={INPUT_CLASS + ' resize-none'}
            />
          </Field>
        </Section>

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
              <><Loader2 size={14} className="animate-spin" /> Simpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Buat Mitra'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// SUB
// =============================================================================
function Section({ title, icon: Icon, children }: {
  title: string; icon?: any; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}