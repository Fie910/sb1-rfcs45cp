// src/components/sarpras/ModalAsetSarpras.tsx
// Modal form Tambah/Edit Aset Inventaris — dengan upload foto ke Supabase Storage.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, Package, Hash, ImageIcon, UploadCloud, X,
  Paperclip, MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SATUAN_OPTIONS,
  SUMBER_DANA_OPTIONS,
} from './shared';
import type {
  InventarisSarpras,
  InventarisLokasi,
  KategoriSarpras,
  Guru,
  KondisiAset,
  StatusAset,
} from '@/types/database';

// =============================================================================
// KONSTANTA
// =============================================================================
const KONDISI_OPTIONS: KondisiAset[] = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
const STATUS_OPTIONS: StatusAset[] = ['Aktif', 'Dipinjam', 'Perbaikan', 'Hilang', 'Dihapus'];
const BUCKET_NAME = 'sarpras-foto';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// =============================================================================
// HELPER — Kompres & Konversi WebP
// =============================================================================
const compressAndConvertToWebP = (
  file: File,
  quality = 0.8,
  maxWidth = 800
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      const canvas = document.createElement('canvas');
      let { width, height } = image;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Gagal memuat Canvas')); return; }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Gagal kompres')); return; }
          const webpName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          resolve(new File([blob], webpName, { type: 'image/webp' }));
        },
        'image/webp',
        quality
      );
    };
    image.onerror = (error) => reject(error);
  });
};

// =============================================================================
// TYPES
// =============================================================================
type ModalAsetSarprasProps = {
  open: boolean;
  onClose: () => void;
  aset?: InventarisSarpras | null;
  kategoriList: KategoriSarpras[];
  lokasiList: InventarisLokasi[];
  guruList: Guru[];
  onSaved: () => void;
};

const emptyForm = {
  kode_aset: '',
  nama_aset: '',
  kategori_id: '',
  lokasi_id: '',
  jumlah: '1',
  satuan: 'unit',
  kondisi: 'Baik' as KondisiAset,
  status: 'Aktif' as StatusAset,
  tanggal_perolehan: '',
  sumber_dana: '',
  harga_perolehan: '',
  nilai_residu: '',
  umur_ekonomis_bulan: '',
  nomor_seri: '',
  merek: '',
  model: '',
  vendor: '',
  pic_id: '',
  foto_url: '',
  keterangan: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalAsetSarpras({
  open,
  onClose,
  aset,
  kategoriList,
  lokasiList,
  guruList,
  onSaved,
}: ModalAsetSarprasProps) {
  const isEdit = Boolean(aset?.id);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [autoKode, setAutoKode] = useState('');

  // State khusus foto
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // ==========================================================================
  // INIT
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    if (aset) {
      setForm({
        kode_aset: aset.kode_aset ?? '',
        nama_aset: aset.nama_aset ?? '',
        kategori_id: aset.kategori_id ?? '',
        lokasi_id: aset.lokasi_id ?? '',
        jumlah: String(aset.jumlah ?? 1),
        satuan: aset.satuan ?? 'unit',
        kondisi: aset.kondisi ?? 'Baik',
        status: aset.status ?? 'Aktif',
        tanggal_perolehan: aset.tanggal_perolehan ?? '',
        sumber_dana: aset.sumber_dana ?? '',
        harga_perolehan: aset.harga_perolehan != null ? String(aset.harga_perolehan) : '',
        nilai_residu: aset.nilai_residu != null ? String(aset.nilai_residu) : '',
        umur_ekonomis_bulan:
          aset.umur_ekonomis_bulan != null ? String(aset.umur_ekonomis_bulan) : '',
        nomor_seri: aset.nomor_seri ?? '',
        merek: aset.merek ?? '',
        model: aset.model ?? '',
        vendor: aset.vendor ?? '',
        pic_id: aset.pic_id ?? '',
        foto_url: aset.foto_url ?? '',
        keterangan: aset.keterangan ?? '',
      });
    } else {
      setForm(emptyForm);
      setAutoKode('');
    }
    setFotoFile(null);
  }, [open, aset]);

  // ==========================================================================
  // AUTO-GENERATE KODE
  // ==========================================================================
  useEffect(() => {
    if (isEdit || !open) return;
    const kategori = kategoriList.find((k) => k.id === form.kategori_id);
    if (!kategori) { setAutoKode(''); return; }

    const prefix = `SMK-${kategori.nama.slice(0, 3).toUpperCase().replace(/\s+/g, '')}`;
    (async () => {
      const { count } = await supabase
        .from('inventaris_sarpras')
        .select('*', { count: 'exact', head: true })
        .ilike('kode_aset', `${prefix}%`);
      const seq = (count ?? 0) + 1;
      const generated = `${prefix}-${String(seq).padStart(3, '0')}`;
      setAutoKode(generated);
      setForm((f) => ({ ...f, kode_aset: generated }));
    })();
  }, [form.kategori_id, kategoriList, isEdit, open]);

  // ==========================================================================
  // HANDLER — Foto Upload
  // ==========================================================================
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setFotoFile(null); return; }

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Foto harus berupa gambar (JPG, PNG, WebP)');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'Ukuran foto maksimal 5 MB');
      e.target.value = '';
      return;
    }
    setFotoFile(file);
  };

  const uploadFoto = async (file: File): Promise<string | null> => {
    try {
      const compressed = await compressAndConvertToWebP(file, 0.8, 800);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
      const filePath = `aset/${fileName}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressed, {
          cacheControl: '31536000',
          upsert: false,
        });

      if (error) {
        showToast('error', 'Gagal upload foto: ' + error.message);
        return null;
      }

      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      showToast('error', 'Gagal memproses foto: ' + (err.message || 'Error'));
      return null;
    }
  };

  const handleRemoveFoto = async () => {
    const currentUrl = form.foto_url;
    setForm((f) => ({ ...f, foto_url: '' }));
    setFotoFile(null);

    // Kalau foto lama di Supabase Storage, hapus dari storage
    if (currentUrl && currentUrl.includes(BUCKET_NAME)) {
      try {
        const path = currentUrl.split(`${BUCKET_NAME}/`)[1]?.split('?')[0];
        if (path) {
          await supabase.storage.from(BUCKET_NAME).remove([path]);
        }
      } catch (err) {
        console.warn('Gagal hapus file lama:', err);
      }
    }
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.nama_aset.trim()) { showToast('error', 'Nama aset wajib diisi'); return; }
    if (!form.kategori_id) { showToast('error', 'Kategori wajib dipilih'); return; }
    if (!form.kode_aset.trim()) {
      showToast('error', 'Kode aset belum terisi — pilih kategori terlebih dahulu');
      return;
    }

    setSaving(true);
    try {
      // Upload foto baru kalau ada
      let finalFotoUrl = form.foto_url;
      if (fotoFile) {
        setUploadingFoto(true);
        const uploaded = await uploadFoto(fotoFile);
        setUploadingFoto(false);
        if (!uploaded) { setSaving(false); return; }
        finalFotoUrl = uploaded;
      }

      const payload = {
        kode_aset: form.kode_aset.trim(),
        nama_aset: form.nama_aset.trim(),
        kategori_id: form.kategori_id || null,
        lokasi_id: form.lokasi_id || null,
        lokasi: null,
        jumlah: Number(form.jumlah) || 1,
        satuan: form.satuan || 'unit',
        kondisi: form.kondisi,
        status: form.status,
        tanggal_perolehan: form.tanggal_perolehan || null,
        sumber_dana: form.sumber_dana || null,
        harga_perolehan: form.harga_perolehan ? Number(form.harga_perolehan) : null,
        nilai_residu: form.nilai_residu ? Number(form.nilai_residu) : null,
        umur_ekonomis_bulan: form.umur_ekonomis_bulan
          ? Number(form.umur_ekonomis_bulan)
          : null,
        nomor_seri: form.nomor_seri.trim() || null,
        merek: form.merek.trim() || null,
        model: form.model.trim() || null,
        vendor: form.vendor.trim() || null,
        pic_id: form.pic_id || null,
        foto_url: finalFotoUrl || null,
        keterangan: form.keterangan.trim() || null,
      };

      if (isEdit && aset?.id) {
        const { error } = await supabase
          .from('inventaris_sarpras')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', aset.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.SARPRAS,
          targetId: aset.id,
          deskripsi: `Update aset: ${payload.nama_aset} (${payload.kode_aset})`,
        });
        showToast('success', 'Aset berhasil diperbarui');
      } else {
        const { data, error } = await supabase
          .from('inventaris_sarpras')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.SARPRAS,
          targetId: data?.id,
          deskripsi: `Tambah aset: ${payload.nama_aset} (${payload.kode_aset})`,
        });
        showToast('success', 'Aset baru berhasil ditambahkan');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      if (err.code === '23505') {
        showToast('error', 'Kode aset sudah terpakai. Ganti kode atau pilih kategori lain.');
      } else {
        showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
      }
    } finally {
      setSaving(false);
      setUploadingFoto(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Aset Inventaris' : 'Tambah Aset Inventaris'}
      size="lg"
    >
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">

        {/* SECTION 1: IDENTITAS */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
            <Package size={14} /> Identitas Aset
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Kategori *</label>
              <SearchableSelect
                options={kategoriList.map((k) => ({
                  value: k.id,
                  label: k.nama,
                }))}
                value={form.kategori_id}
                onChange={(v) => setForm({ ...form, kategori_id: v })}
                placeholder="Pilih kategori..."
                searchPlaceholder="Cari kategori..."
                emptyMessage="Kategori tidak ditemukan"
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>
                Kode Aset {!isEdit && '(Otomatis)'}
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={form.kode_aset}
                  onChange={(e) => setForm({ ...form, kode_aset: e.target.value })}
                  placeholder="Pilih kategori untuk generate..."
                  className={`${INPUT_CLASS} pl-8 font-mono`}
                />
              </div>
              {!isEdit && autoKode && (
                <p className="text-[10px] text-emerald-400 mt-1">
                  Kode otomatis: {autoKode}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Nama Aset *</label>
            <input
              type="text"
              value={form.nama_aset}
              onChange={(e) => setForm({ ...form, nama_aset: e.target.value })}
              placeholder="Contoh: Laptop Asus VivoBook 14"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Jumlah</label>
              <input
                type="number"
                min={1}
                value={form.jumlah}
                onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Satuan</label>
              <select
                value={form.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {SATUAN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Lokasi</label>
              <SearchableSelect
                options={lokasiList.map((l) => ({
                  value: l.id,
                  label: l.nama,
                  hint: l.tipe,
                }))}
                value={form.lokasi_id}
                onChange={(v) => setForm({ ...form, lokasi_id: v })}
                placeholder="Pilih lokasi..."
                searchPlaceholder="Cari lokasi..."
                emptyMessage="Lokasi tidak ditemukan"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: SPESIFIKASI */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            Spesifikasi & Identitas Fisik
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Merek</label>
              <input
                type="text"
                value={form.merek}
                onChange={(e) => setForm({ ...form, merek: e.target.value })}
                placeholder="Asus, Epson, dll."
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="VivoBook 14"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Nomor Seri</label>
              <input
                type="text"
                value={form.nomor_seri}
                onChange={(e) => setForm({ ...form, nomor_seri: e.target.value })}
                placeholder="SN-XXXX"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Kondisi *</label>
              <select
                value={form.kondisi}
                onChange={(e) =>
                  setForm({ ...form, kondisi: e.target.value as KondisiAset })
                }
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {KONDISI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Status *</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as StatusAset })
                }
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Penanggung Jawab (PIC)</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: g.nama_lengkap,
                hint: g.nip ? `NIP: ${g.nip}` : undefined,
              }))}
              value={form.pic_id}
              onChange={(v) => setForm({ ...form, pic_id: v })}
              placeholder="Pilih guru PIC (opsional)"
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
        </div>

        {/* SECTION 3: PENGADAAN */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            Data Pengadaan
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Perolehan</label>
              <input
                type="date"
                value={form.tanggal_perolehan}
                onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Sumber Dana</label>
              <select
                value={form.sumber_dana}
                onChange={(e) => setForm({ ...form, sumber_dana: e.target.value })}
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                <option value="">-- Tidak disebutkan --</option>
                {SUMBER_DANA_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Harga Perolehan</label>
              <input
                type="number"
                min={0}
                value={form.harga_perolehan}
                onChange={(e) => setForm({ ...form, harga_perolehan: e.target.value })}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Nilai Residu</label>
              <input
                type="number"
                min={0}
                value={form.nilai_residu}
                onChange={(e) => setForm({ ...form, nilai_residu: e.target.value })}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Umur Ekonomis (bulan)</label>
              <input
                type="number"
                min={0}
                value={form.umur_ekonomis_bulan}
                onChange={(e) => setForm({ ...form, umur_ekonomis_bulan: e.target.value })}
                placeholder="60"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Vendor / Supplier</label>
            <input
              type="text"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Nama toko / supplier"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* SECTION 4: FOTO & KETERANGAN — UPDATED */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
            <ImageIcon size={14} /> Foto & Keterangan
          </h4>

          {/* FOTO */}
          <div>
            <label className={LABEL_CLASS}>Foto Aset</label>

            {/* Preview foto existing (dari Supabase Storage) */}
            {form.foto_url && !fotoFile && (
              <div className="mb-2 relative w-full max-w-xs h-40 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={form.foto_url}
                  alt="Foto aset"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveFoto}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 border border-slate-700 transition cursor-pointer"
                  title="Hapus foto"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Preview file baru */}
            {fotoFile && (
              <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs max-w-xs">
                <Paperclip size={14} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-300 truncate flex-1">
                  {fotoFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFotoFile(null)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Upload dropzone */}
            {!fotoFile && !form.foto_url && (
              <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                <UploadCloud size={22} className="text-indigo-400 mb-1" />
                <p className="text-[11px] text-slate-400 font-medium">
                  Klik untuk upload foto aset
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  JPG, PNG, WebP · Maks 5 MB · Otomatis dikompres ke WebP
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />
              </label>
            )}

            {/* Ganti foto button */}
            {form.foto_url && !fotoFile && (
              <label className="inline-flex items-center gap-1.5 mt-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition cursor-pointer">
                <UploadCloud size={12} /> Ganti Foto
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* KETERANGAN */}
          <div>
            <label className={LABEL_CLASS}>Keterangan</label>
            <textarea
              rows={2}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Catatan tambahan tentang aset ini..."
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploadingFoto || !form.nama_aset.trim() || !form.kategori_id}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploadingFoto ? (
              <><Loader2 size={14} className="animate-spin" /> Upload foto...</>
            ) : saving ? (
              <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Simpan Aset'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}