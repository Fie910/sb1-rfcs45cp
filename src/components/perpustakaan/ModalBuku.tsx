// src/components/perpustakaan/ModalBuku.tsx
// Form Tambah/Edit Buku Perpustakaan.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, Book, Hash, UploadCloud, X, Paperclip,
  User, Building2, Calendar, FileText, Library,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  getKondisiBukuBadge, KONDISI_BUKU_OPTIONS, BAHASA_OPTIONS,
  generateKodeBuku,
} from './shared';
import type {
  PerpusBuku, PerpusKategori, PerpusRak, KondisiBuku,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

// =============================================================================
// HELPER — Kompres Gambar Cover
// =============================================================================
const compressCover = (file: File, quality = 0.8, maxWidth = 800): Promise<File> => {
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
          const name = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          resolve(new File([blob], name, { type: 'image/webp' }));
        },
        'image/webp',
        quality
      );
    };
    image.onerror = (err) => reject(err);
  });
};

// =============================================================================
// TYPES
// =============================================================================
type ModalBukuProps = {
  open: boolean;
  onClose: () => void;
  buku?: PerpusBuku | null;
  kategoriList: PerpusKategori[];
  rakList: PerpusRak[];
  onSaved: () => void;
};

const emptyForm = {
  kode_buku: '',
  judul: '',
  pengarang: '',
  penerbit: '',
  tahun_terbit: new Date().getFullYear().toString(),
  isbn: '',
  kategori_id: '',
  rak_id: '',
  jumlah_total: '1',
  kondisi: 'Baik' as KondisiBuku,
  sinopsis: '',
  cover_url: '',
  bahasa: 'Indonesia',
  jumlah_halaman: '',
  catatan: '',
  is_aktif: true,
};

// =============================================================================
// KOMPONEN
// =============================================================================

export function ModalBuku({
  open,
  onClose,
  buku,
  kategoriList,
  rakList,
  onSaved,
}: ModalBukuProps) {
  const isEdit = Boolean(buku?.id);

  const [form, setForm] = useState(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // ==========================================================================
  // INIT FORM
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    if (buku) {
      setForm({
        kode_buku: buku.kode_buku ?? '',
        judul: buku.judul,
        pengarang: buku.pengarang ?? '',
        penerbit: buku.penerbit ?? '',
        tahun_terbit: buku.tahun_terbit ? String(buku.tahun_terbit) : '',
        isbn: buku.isbn ?? '',
        kategori_id: buku.kategori_id ?? '',
        rak_id: buku.rak_id ?? '',
        jumlah_total: String(buku.jumlah_total),
        kondisi: buku.kondisi,
        sinopsis: buku.sinopsis ?? '',
        cover_url: buku.cover_url ?? '',
        bahasa: buku.bahasa ?? 'Indonesia',
        jumlah_halaman: buku.jumlah_halaman ? String(buku.jumlah_halaman) : '',
        catatan: buku.catatan ?? '',
        is_aktif: buku.is_aktif,
      });
    } else {
      setForm(emptyForm);
    }
    setCoverFile(null);
  }, [open, buku]);

  // ==========================================================================
  // AUTO-GENERATE KODE BUKU
  // ==========================================================================
  useEffect(() => {
    if (isEdit || !open) return;
    if (!form.kategori_id) {
      setForm((f) => ({ ...f, kode_buku: '' }));
      return;
    }

    const kategori = kategoriList.find((k) => k.id === form.kategori_id);
    if (!kategori) return;

    const kodeDewey = kategori.kode_dewey ?? '000';
    const prefix = `BKU-${kodeDewey}-`;

    (async () => {
      const { count } = await supabase
        .from('perpus_buku')
        .select('*', { count: 'exact', head: true })
        .ilike('kode_buku', `${prefix}%`);

      const seq = (count ?? 0) + 1;
      const generated = generateKodeBuku(kodeDewey, seq);
      setForm((f) => ({ ...f, kode_buku: generated }));
    })();
  }, [form.kategori_id, kategoriList, isEdit, open]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setCoverFile(null); return; }
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Cover harus berupa gambar');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Ukuran cover maksimal 5 MB');
      e.target.value = '';
      return;
    }
    setCoverFile(file);
  };

  const uploadCover = async (file: File): Promise<string | null> => {
    try {
      const compressed = await compressCover(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
      const filePath = `covers/${fileName}`;
      const { error } = await supabase.storage
        .from('perpus-cover')
        .upload(filePath, compressed, { cacheControl: '31536000', upsert: false });
      if (error) { showToast('error', 'Gagal upload cover: ' + error.message); return null; }
      const { data } = supabase.storage.from('perpus-cover').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      showToast('error', 'Gagal memproses cover: ' + (err.message || 'Error'));
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!form.judul.trim()) { showToast('error', 'Judul buku wajib diisi'); return; }
    if (!form.kode_buku.trim()) { showToast('error', 'Kode buku belum terisi — pilih kategori'); return; }
    const total = Number(form.jumlah_total);
    if (!total || total <= 0) { showToast('error', 'Jumlah total harus lebih dari 0'); return; }

    setSaving(true);
    try {
      let coverUrl = form.cover_url;
      if (coverFile) {
        setUploadingCover(true);
        const uploaded = await uploadCover(coverFile);
        setUploadingCover(false);
        if (!uploaded) { setSaving(false); return; }
        coverUrl = uploaded;
      }

      const payload: any = {
        kode_buku: form.kode_buku.trim(),
        judul: form.judul.trim(),
        pengarang: form.pengarang.trim() || null,
        penerbit: form.penerbit.trim() || null,
        tahun_terbit: form.tahun_terbit ? Number(form.tahun_terbit) : null,
        isbn: form.isbn.trim() || null,
        kategori_id: form.kategori_id || null,
        rak_id: form.rak_id || null,
        jumlah_total: total,
        kondisi: form.kondisi,
        sinopsis: form.sinopsis.trim() || null,
        cover_url: coverUrl || null,
        bahasa: form.bahasa || null,
        jumlah_halaman: form.jumlah_halaman ? Number(form.jumlah_halaman) : null,
        catatan: form.catatan.trim() || null,
        is_aktif: form.is_aktif,
      };

      // Untuk create, jumlah_tersedia = jumlah_total
      if (!isEdit) {
        payload.jumlah_tersedia = total;
      } else {
        // Saat edit, hitung ulang jumlah_tersedia = jumlah_total lama - yang sedang dipinjam
        const dipinjam = (buku?.jumlah_total ?? 0) - (buku?.jumlah_tersedia ?? 0);
        payload.jumlah_tersedia = Math.max(0, total - dipinjam);
      }

      if (isEdit && buku?.id) {
        const { error } = await supabase
          .from('perpus_buku')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', buku.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: MODUL_PERPUS,
          targetId: buku.id,
          deskripsi: `Update buku: ${payload.judul} (${payload.kode_buku})`,
        });
        showToast('success', 'Buku berhasil diperbarui');
      } else {
        const { data, error } = await supabase
          .from('perpus_buku')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: MODUL_PERPUS,
          targetId: data?.id,
          deskripsi: `Tambah buku: ${payload.judul} (${payload.kode_buku})`,
        });
        showToast('success', 'Buku berhasil ditambahkan');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      showToast(
        'error',
        err.code === '23505'
          ? 'Kode buku sudah terpakai'
          : 'Gagal menyimpan: ' + (err.message || 'Error')
      );
    } finally {
      setSaving(false);
      setUploadingCover(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Buku' : 'Tambah Buku Baru'}
      size="lg"
    >
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">

        {/* SECTION: IDENTITAS UTAMA */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
            <Book size={13} /> Identitas Buku
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Kategori (Dewey) *</label>
              <SearchableSelect
                options={kategoriList.map((k) => ({
                  value: k.id,
                  label: k.nama,
                  hint: k.kode_dewey ? `DDC ${k.kode_dewey}` : undefined,
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
                Kode Buku {!isEdit && '(Otomatis)'}
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={form.kode_buku}
                  onChange={(e) => setForm({ ...form, kode_buku: e.target.value })}
                  placeholder="Pilih kategori untuk generate..."
                  className={`${INPUT_CLASS} pl-8 font-mono`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Judul Buku *</label>
            <input
              type="text"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Contoh: Laskar Pelangi"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Pengarang</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={form.pengarang}
                  onChange={(e) => setForm({ ...form, pengarang: e.target.value })}
                  placeholder="Andrea Hirata"
                  className={`${INPUT_CLASS} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Penerbit</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={form.penerbit}
                  onChange={(e) => setForm({ ...form, penerbit: e.target.value })}
                  placeholder="Bentang Pustaka"
                  className={`${INPUT_CLASS} pl-8`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tahun Terbit</label>
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear() + 5}
                value={form.tahun_terbit}
                onChange={(e) => setForm({ ...form, tahun_terbit: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>ISBN</label>
              <input
                type="text"
                value={form.isbn}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                placeholder="978-XXX-XXX-X"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Bahasa</label>
              <select
                value={form.bahasa}
                onChange={(e) => setForm({ ...form, bahasa: e.target.value })}
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {BAHASA_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION: INVENTARIS */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
            <Library size={13} /> Data Inventaris
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Jumlah Total *</label>
              <input
                type="number"
                min={1}
                value={form.jumlah_total}
                onChange={(e) => setForm({ ...form, jumlah_total: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Lokasi Rak</label>
              <SearchableSelect
                options={rakList.map((r) => ({
                  value: r.id,
                  label: r.nama,
                  hint: r.lokasi ?? undefined,
                }))}
                value={form.rak_id}
                onChange={(v) => setForm({ ...form, rak_id: v })}
                placeholder="Pilih rak..."
                searchPlaceholder="Cari rak..."
                emptyMessage="Rak tidak ditemukan"
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Kondisi Fisik</label>
              <select
                value={form.kondisi}
                onChange={(e) => setForm({ ...form, kondisi: e.target.value as KondisiBuku })}
                className={`${INPUT_CLASS} cursor-pointer`}
              >
                {KONDISI_BUKU_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Jumlah Halaman</label>
              <input
                type="number"
                min={0}
                value={form.jumlah_halaman}
                onChange={(e) => setForm({ ...form, jumlah_halaman: e.target.value })}
                placeholder="320"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Status</label>
              <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_aktif}
                  onChange={(e) => setForm({ ...form, is_aktif: e.target.checked })}
                  className="accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300">Buku aktif & tersedia di OPAC</span>
              </label>
            </div>
          </div>
        </div>

        {/* SECTION: SINOPSIS & COVER */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
            <FileText size={13} /> Deskripsi & Cover
          </h4>

          <div>
            <label className={LABEL_CLASS}>Sinopsis</label>
            <textarea
              rows={3}
              value={form.sinopsis}
              onChange={(e) => setForm({ ...form, sinopsis: e.target.value })}
              placeholder="Ringkasan isi buku..."
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Cover Buku</label>

            {/* Preview existing */}
            {form.cover_url && !coverFile && (
              <div className="mb-2 relative w-32 h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img src={form.cover_url} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, cover_url: '' })}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Preview new file */}
            {coverFile && (
              <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs max-w-sm">
                <Paperclip size={14} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-300 truncate flex-1">{coverFile.name}</span>
                <button
                  type="button"
                  onClick={() => setCoverFile(null)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Upload button */}
            {!coverFile && !form.cover_url && (
              <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                <UploadCloud size={20} className="text-indigo-400 mb-1" />
                <p className="text-[11px] text-slate-400">Klik untuk upload cover</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  JPG, PNG, WebP · Maks 5 MB · Otomatis dikompres
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div>
            <label className={LABEL_CLASS}>Catatan</label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder="Catatan tambahan (opsional)"
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
            disabled={saving || uploadingCover || !form.judul.trim() || !form.kode_buku.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploadingCover ? (
              <><Loader2 size={14} className="animate-spin" /> Upload cover...</>
            ) : saving ? (
              <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Simpan Buku'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}