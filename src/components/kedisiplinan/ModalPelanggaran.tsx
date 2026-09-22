// src/components/kedisiplinan/ModalPelanggaran.tsx
// Form Tambah/Edit Pelanggaran Siswa.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, User, Calendar, AlertCircle,
  UploadCloud, Paperclip, X, ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  getLevelPelanggaranBadge,
} from './shared';
import type {
  KesiswaanPelanggaran,
  KesiswaanKategoriPelanggaran,
  Siswa,
  Kelas,
} from '@/types/database';

const MODUL_KEDISIPLINAN = (AUDIT_MODUL as any)?.KEDISIPLINAN ?? 'Kedisiplinan';

// =============================================================================
// HELPER — Kompres & Konversi Gambar
// =============================================================================
const compressAndConvertToWebP = (
  file: File,
  quality = 0.8,
  maxWidth = 1200
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
type SiswaWithKelas = Siswa & {
  kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
};

type ModalPelanggaranProps = {
  open: boolean;
  onClose: () => void;
  pelanggaran?: KesiswaanPelanggaran | null;
  kategoriList: KesiswaanKategoriPelanggaran[];
  siswaList: SiswaWithKelas[];
  onSaved: () => void;
};

const emptyForm = {
  siswa_id: '',
  kategori_id: '',
  jenis_pelanggaran: '',
  deskripsi: '',
  poin: '',
  tanggal: new Date().toISOString().split('T')[0],
  tindakan: '',
  bukti_url: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalPelanggaran({
  open,
  onClose,
  pelanggaran,
  kategoriList,
  siswaList,
  onSaved,
}: ModalPelanggaranProps) {
  const { guru } = useAuth();
  const isEdit = Boolean(pelanggaran?.id);

  const [form, setForm] = useState(emptyForm);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBukti, setUploadingBukti] = useState(false);

  // ==========================================================================
  // INIT FORM
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    if (pelanggaran) {
      setForm({
        siswa_id: String(pelanggaran.siswa_id),
        kategori_id: pelanggaran.kategori_id ?? '',
        jenis_pelanggaran: pelanggaran.jenis_pelanggaran,
        deskripsi: pelanggaran.deskripsi ?? '',
        poin: String(pelanggaran.poin),
        tanggal: pelanggaran.tanggal,
        tindakan: pelanggaran.tindakan ?? '',
        bukti_url: pelanggaran.bukti_url ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setBuktiFile(null);
  }, [open, pelanggaran]);

  // ==========================================================================
  // AUTO-FILL dari kategori
  // ==========================================================================
  const handleKategoriChange = (kategoriId: string) => {
    const kat = kategoriList.find((k) => k.id === kategoriId);
    setForm((prev) => ({
      ...prev,
      kategori_id: kategoriId,
      jenis_pelanggaran: kat?.nama ?? prev.jenis_pelanggaran,
      poin: kat ? String(kat.poin_default) : prev.poin,
    }));
  };

  const selectedKategori = kategoriList.find((k) => k.id === form.kategori_id);
  const selectedSiswa = siswaList.find((s) => String(s.id) === form.siswa_id);

  // ==========================================================================
  // FILE HANDLER
  // ==========================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setBuktiFile(null); return; }
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Bukti harus berupa gambar (JPG, PNG, WebP)');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'Ukuran berkas maksimal 10 MB');
      e.target.value = '';
      return;
    }
    setBuktiFile(file);
  };

  const uploadCompressedImage = async (file: File): Promise<string | null> => {
    try {
      const compressed = await compressAndConvertToWebP(file, 0.8, 1200);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
      const filePath = `pelanggaran/${fileName}`;

      const { error } = await supabase.storage
        .from('kedisiplinan-bukti')
        .upload(filePath, compressed, { cacheControl: '31536000', upsert: false });

      if (error) {
        showToast('error', 'Gagal upload: ' + error.message);
        return null;
      }
      const { data } = supabase.storage.from('kedisiplinan-bukti').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      showToast('error', 'Gagal memproses gambar: ' + (err.message || 'Error'));
      return null;
    }
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.siswa_id) { showToast('error', 'Pilih siswa'); return; }
    if (!form.jenis_pelanggaran.trim()) { showToast('error', 'Jenis pelanggaran wajib diisi'); return; }
    const poinNum = Number(form.poin);
    if (!poinNum || poinNum <= 0) { showToast('error', 'Poin harus lebih dari 0'); return; }

    setSaving(true);
    try {
      let buktiUrl = form.bukti_url;

      if (buktiFile) {
        setUploadingBukti(true);
        const uploaded = await uploadCompressedImage(buktiFile);
        setUploadingBukti(false);
        if (!uploaded) { setSaving(false); return; }
        buktiUrl = uploaded;
      }

      const payload = {
        siswa_id: Number(form.siswa_id),
        kategori_id: form.kategori_id || null,
        jenis_pelanggaran: form.jenis_pelanggaran.trim(),
        deskripsi: form.deskripsi.trim() || null,
        poin: poinNum,
        tanggal: form.tanggal,
        pelapor_id: guru?.id ?? null,
        tindakan: form.tindakan.trim() || null,
        bukti_url: buktiUrl || null,
      };

      if (isEdit && pelanggaran?.id) {
        const { error } = await supabase
          .from('kesiswaan_pelanggaran')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', pelanggaran.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: MODUL_KEDISIPLINAN,
          targetId: pelanggaran.id,
          deskripsi: `Update pelanggaran: ${payload.jenis_pelanggaran} (${payload.poin} poin) — ${selectedSiswa?.nama_lengkap}`,
        });
        showToast('success', 'Pelanggaran diperbarui');
      } else {
        const { data, error } = await supabase
          .from('kesiswaan_pelanggaran')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: MODUL_KEDISIPLINAN,
          targetId: data?.id,
          deskripsi: `Catat pelanggaran: ${payload.jenis_pelanggaran} (${payload.poin} poin) — ${selectedSiswa?.nama_lengkap}`,
        });
        showToast('success', 'Pelanggaran berhasil dicatat');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
      setUploadingBukti(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Pelanggaran' : 'Catat Pelanggaran Baru'}
      size="lg"
    >
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* INFO SISWA TERPILIH */}
        {selectedSiswa && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-0.5">
                Siswa
              </p>
              <p className="font-bold text-slate-100">{selectedSiswa.nama_lengkap}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedSiswa.kelas?.nama_kelas ?? '-'} · NISN: {selectedSiswa.nisn}
              </p>
            </div>
          </div>
        )}

        {/* SISWA PICKER */}
        <div>
          <label className={LABEL_CLASS}>Siswa *</label>
          <SearchableSelect
            options={siswaList.map((s) => ({
              value: String(s.id),
              label: s.nama_lengkap,
              hint: `${s.kelas?.nama_kelas ?? '-'} · NISN: ${s.nisn}`,
            }))}
            value={form.siswa_id}
            onChange={(v) => setForm({ ...form, siswa_id: v })}
            placeholder="Pilih siswa..."
            searchPlaceholder="Cari nama / NISN..."
            emptyMessage="Siswa tidak ditemukan"
          />
        </div>

        {/* KATEGORI */}
        <div>
          <label className={LABEL_CLASS}>Kategori Pelanggaran</label>
          <SearchableSelect
            options={kategoriList.map((k) => ({
              value: k.id,
              label: k.nama,
              hint: `${k.kategori} · ${k.poin_default} poin`,
            }))}
            value={form.kategori_id}
            onChange={handleKategoriChange}
            placeholder="Pilih kategori (auto-isi jenis & poin)"
            searchPlaceholder="Cari kategori..."
            emptyMessage="Kategori tidak ditemukan"
          />
          {selectedKategori && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${getLevelPelanggaranBadge(
                  selectedKategori.kategori
                )}`}
              >
                {selectedKategori.kategori}
              </span>
              <span className="text-[11px] text-slate-500">
                Poin default: <span className="text-amber-400 font-bold">{selectedKategori.poin_default}</span>
              </span>
            </div>
          )}
        </div>

        {/* JENIS PELANGGARAN + POIN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Jenis Pelanggaran *</label>
            <input
              type="text"
              value={form.jenis_pelanggaran}
              onChange={(e) => setForm({ ...form, jenis_pelanggaran: e.target.value })}
              placeholder="Auto-terisi dari kategori, atau ketik manual"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Poin *</label>
            <input
              type="number"
              min={1}
              value={form.poin}
              onChange={(e) => setForm({ ...form, poin: e.target.value })}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* TANGGAL */}
        <div>
          <label className={LABEL_CLASS}>Tanggal Kejadian</label>
          <input
            type="date"
            value={form.tanggal}
            onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        {/* DESKRIPSI */}
        <div>
          <label className={LABEL_CLASS}>Deskripsi / Kronologi</label>
          <textarea
            rows={3}
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            placeholder="Kronologi kejadian, tempat, saksi, dll..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* TINDAKAN */}
        <div>
          <label className={LABEL_CLASS}>Tindakan / Sanksi</label>
          <input
            type="text"
            value={form.tindakan}
            onChange={(e) => setForm({ ...form, tindakan: e.target.value })}
            placeholder="Contoh: Teguran lisan, menulis surat pernyataan, dll."
            className={INPUT_CLASS}
          />
        </div>

        {/* BUKTI */}
        <div>
          <label className={LABEL_CLASS}>Bukti (Foto/Dokumen)</label>

          {form.bukti_url && !buktiFile && (
            <div className="mb-2 relative w-full h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={form.bukti_url}
                alt="Bukti"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, bukti_url: '' })}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 border border-slate-700 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {buktiFile && (
            <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs">
              <Paperclip size={14} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-300 truncate flex-1">{buktiFile.name}</span>
              <button
                type="button"
                onClick={() => setBuktiFile(null)}
                className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {!buktiFile && !form.bukti_url && (
            <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-slate-800 hover:border-rose-500/40 bg-slate-950/50 hover:bg-rose-500/5 transition-all cursor-pointer">
              <UploadCloud size={20} className="text-rose-400 mb-1" />
              <p className="text-[11px] text-slate-400">Klik untuk upload bukti</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                JPG, PNG, WebP · Otomatis dikompres
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
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
            disabled={saving || uploadingBukti}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploadingBukti ? (
              <><Loader2 size={14} className="animate-spin" /> Upload...</>
            ) : saving ? (
              <><Loader2 size={14} className="animate-spin" /> Simpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Catat Pelanggaran'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}