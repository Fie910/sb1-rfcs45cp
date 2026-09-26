// src/components/arsip/ModalUploadArsip.tsx
// Modal upload dokumen arsip — dengan kompresi otomatis & pilihan storage provider.

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Upload, X, FileText, Image as ImageIcon, HardDrive,
  AlertTriangle, Info, Link2, Users, Check, Sparkles, Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  compressImageToWebP, formatFileSize,
} from './shared';
import type {
  ArsipKategori, Guru, AksesLevel,
} from '@/types/database';

const BUCKET = 'arsip-files';
const MAX_FILE_SIZE = 25 * 1024 * 1024;      // 25 MB
const COMPRESS_THRESHOLD = 5 * 1024 * 1024;  // > 5 MB → offer external option

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  kategoriList: ArsipKategori[];
  guruList: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[];
  currentGuruId: string;
};

const todayStr = new Date().toISOString().slice(0, 10);

const emptyForm = {
  kategori_id: '',
  judul: '',
  deskripsi: '',
  tags_input: '',
  status: 'Draft' as 'Draft' | 'Aktif',
  akses_level: '' as '' | AksesLevel,
  tanggal_berlaku: todayStr,
  retensi_bulan: 60,
  pemilik_id: '',
  wajib_baca_enabled: false,
  wajib_baca_guru_ids: [] as string[],
  deadline_baca: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalUploadArsip({
  open, onClose, onSaved, kategoriList, guruList, currentGuruId,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    original_size: number;
    compressed_size: number;
    ratio: number;
  } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [useExternal, setUseExternal] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Peserta search
  const [pesertaSearch, setPesertaSearch] = useState('');

  const finalFile = compressedFile ?? selectedFile;
  const finalSize = finalFile?.size ?? 0;
  const needsExternalChoice = finalSize > COMPRESS_THRESHOLD;

  // ==========================================================================
  // RESET saat open
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm,
      kategori_id: kategoriList[0]?.id ?? '',
      pemilik_id: currentGuruId,
      retensi_bulan: kategoriList[0]?.retensi_default_bulan ?? 60,
    });
    setSelectedFile(null);
    setCompressedFile(null);
    setCompressionInfo(null);
    setUseExternal(false);
    setExternalUrl('');
    setPesertaSearch('');
    setUploadProgress('');
  }, [open, kategoriList, currentGuruId]);

  // Auto-fill retensi saat kategori berubah
  useEffect(() => {
    const kat = kategoriList.find((k) => k.id === form.kategori_id);
    if (kat) {
      setForm((f) => ({ ...f, retensi_bulan: kat.retensi_default_bulan }));
    }
  }, [form.kategori_id, kategoriList]);

  // ==========================================================================
  // FILE HANDLING
  // ==========================================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'Ukuran file maksimal 25 MB');
      e.target.value = '';
      return;
    }

    // Tolak TIFF
    if (file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tiff') ||
        file.name.toLowerCase().endsWith('.tif')) {
      showToast('error', 'Format TIFF tidak didukung. Silakan convert ke PDF terlebih dahulu.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setCompressedFile(null);
    setCompressionInfo(null);

    // Auto-compress kalau gambar
    if (file.type.startsWith('image/')) {
      setCompressing(true);
      try {
        const compressed = await compressImageToWebP(file, 0.8, 1600);
        setCompressedFile(compressed);
        const ratio = ((1 - compressed.size / file.size) * 100);
        setCompressionInfo({
          original_size: file.size,
          compressed_size: compressed.size,
          ratio,
        });
        if (ratio > 5) {
          showToast('success', `Kompresi hemat ${ratio.toFixed(1)}% (${formatFileSize(file.size)} → ${formatFileSize(compressed.size)})`);
        }
      } catch {
        // Fallback: pakai file asli
        setCompressedFile(null);
      } finally {
        setCompressing(false);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setCompressedFile(null);
    setCompressionInfo(null);
    setUseExternal(false);
    setExternalUrl('');
  };

  // ==========================================================================
  // UPLOAD
  // ==========================================================================
  const uploadToStorage = async (file: File): Promise<{
    url: string;
    size: number;
  } | null> => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${safeName}`;
      const filePath = `${currentGuruId}/${fileName}`;

      setUploadProgress('Uploading...');

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '31536000', upsert: false });

      if (error) {
        showToast('error', 'Upload gagal: ' + error.message);
        return null;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return { url: data.publicUrl, size: file.size };
    } catch (err: any) {
      showToast('error', 'Gagal upload: ' + (err.message || 'Error'));
      return null;
    }
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    // Validasi
    if (!form.kategori_id) {
      showToast('error', 'Kategori wajib dipilih');
      return;
    }
    if (!form.judul.trim()) {
      showToast('error', 'Judul dokumen wajib diisi');
      return;
    }
    if (useExternal && !externalUrl.trim()) {
      showToast('error', 'URL eksternal wajib diisi');
      return;
    }
    if (!useExternal && !finalFile) {
      showToast('error', 'File wajib diupload');
      return;
    }

    setSaving(true);
    setUploadProgress('Menyimpan...');

    try {
      // 1. Upload file (kalau bukan external)
      let fileUrl = '';
      let fileSize = 0;
      let storageProvider: 'supabase' | 'external' = 'supabase';

      if (useExternal) {
        fileUrl = externalUrl.trim();
        fileSize = 0;
        storageProvider = 'external';
      } else if (finalFile) {
        const uploadResult = await uploadToStorage(finalFile);
        if (!uploadResult) { setSaving(false); setUploadProgress(''); return; }
        fileUrl = uploadResult.url;
        fileSize = uploadResult.size;
      }

      // 2. Parse tags
      const tags = form.tags_input
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // 3. Insert dokumen
      setUploadProgress('Membuat dokumen...');
      const { data: dokData, error: dokErr } = await supabase
        .from('arsip_dokumen')
        .insert({
          kategori_id: form.kategori_id,
          judul: form.judul.trim(),
          deskripsi: form.deskripsi.trim() || null,
          tags,
          status: form.status,
          akses_level: form.akses_level || null,
          tanggal_berlaku: form.tanggal_berlaku || null,
          retensi_bulan: form.retensi_bulan,
          pemilik_id: form.pemilik_id || null,
          created_by: currentGuruId,
          total_versi: 1,
        })
        .select()
        .single();

      if (dokErr) throw dokErr;
      const dokId = dokData.id;

      // 4. Insert versi 1
      setUploadProgress('Menyimpan versi...');
      const { data: versiData, error: versiErr } = await supabase
        .from('arsip_versi')
        .insert({
          dokumen_id: dokId,
          versi: 1,
          nomor_revisi: 'v1.0',
          storage_provider: storageProvider,
          file_url: fileUrl,
          external_url: useExternal ? fileUrl : null,
          file_size: fileSize,
          original_size: compressionInfo?.original_size ?? fileSize,
          compression_ratio: compressionInfo?.ratio ?? 0,
          file_type: finalFile?.type ?? 'application/pdf',
          file_name: finalFile?.name ?? 'external-link',
          ringkasan_perubahan: 'Upload awal',
          is_aktif: true,
          created_by: currentGuruId,
        })
        .select()
        .single();

      if (versiErr) throw versiErr;

      // 5. Update versi_aktif_id di dokumen
      await supabase
        .from('arsip_dokumen')
        .update({ versi_aktif_id: versiData.id })
        .eq('id', dokId);

      // 6. Insert pembaca (wajib baca)
      if (form.wajib_baca_enabled && form.wajib_baca_guru_ids.length > 0) {
        setUploadProgress('Menugaskan pembaca...');
        const pembacaRows = form.wajib_baca_guru_ids.map((gid) => ({
          dokumen_id: dokId,
          versi_id: versiData.id,
          guru_id: gid,
          wajib_baca: true,
          deadline_baca: form.deadline_baca || null,
        }));
        await supabase.from('arsip_pembaca').insert(pembacaRows);
      }

      // 7. Log aktivitas
      await supabase.from('arsip_aktivitas').insert({
        dokumen_id: dokId,
        versi_id: versiData.id,
        guru_id: currentGuruId,
        aksi: 'Create',
        catatan: `Upload dokumen baru: ${form.judul}`,
      });

      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.HRIS,
        targetId: dokId,
        deskripsi: `Upload arsip: ${form.judul}`,
      });

      showToast('success', 'Dokumen berhasil diupload');
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  // ==========================================================================
  // PESERTA FILTER
  // ==========================================================================
  const filteredGuru = useMemo(() => {
    if (!pesertaSearch.trim()) return guruList;
    const q = pesertaSearch.toLowerCase();
    return guruList.filter(
      (g) =>
        g.nama_lengkap.toLowerCase().includes(q) ||
        (g.nip ?? '').toLowerCase().includes(q)
    );
  }, [guruList, pesertaSearch]);

  const toggleWajibBacaGuru = (id: string) => {
    setForm((f) => ({
      ...f,
      wajib_baca_guru_ids: f.wajib_baca_guru_ids.includes(id)
        ? f.wajib_baca_guru_ids.filter((x) => x !== id)
        : [...f.wajib_baca_guru_ids, id],
    }));
  };

  const handleSelectAllGuru = () => {
    if (form.wajib_baca_guru_ids.length === filteredGuru.length) {
      setForm((f) => ({ ...f, wajib_baca_guru_ids: [] }));
    } else {
      setForm((f) => ({ ...f, wajib_baca_guru_ids: filteredGuru.map((g) => g.id) }));
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload Dokumen Arsip"
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* INFO KOMPRESI */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
          <Sparkles size={14} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-indigo-300">Kompresi Otomatis</p>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              Gambar akan otomatis dikompres ke WebP (max 1600px). File &gt; 5 MB dapat
              disimpan via link eksternal (Google Drive, dll) untuk hemat storage.
            </p>
          </div>
        </div>

        {/* KATEGORI */}
        <div>
          <label className={LABEL_CLASS}>Kategori *</label>
          <SearchableSelect
            options={kategoriList.map((k) => ({ value: k.id, label: k.nama }))}
            value={form.kategori_id}
            onChange={(v) => setForm({ ...form, kategori_id: v })}
            placeholder="Pilih kategori..."
            searchPlaceholder="Cari kategori..."
            emptyMessage="Kategori tidak ditemukan"
          />
        </div>

        {/* JUDUL */}
        <div>
          <label className={LABEL_CLASS}>Judul Dokumen *</label>
          <input
            type="text"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            placeholder="Contoh: SOP Pengelolaan Perpustakaan 2026"
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
            placeholder="Ringkasan isi dokumen..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* TAGS */}
        <div>
          <label className={LABEL_CLASS}>Tags (pisahkan dengan koma)</label>
          <input
            type="text"
            value={form.tags_input}
            onChange={(e) => setForm({ ...form, tags_input: e.target.value })}
            placeholder="Contoh: sop, perpustakaan, 2026"
            className={INPUT_CLASS}
          />
        </div>

        {/* STATUS + AKSES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              <option value="Draft">Draft (belum publish)</option>
              <option value="Aktif">Aktif (langsung publish)</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Akses Level</label>
            <select
              value={form.akses_level}
              onChange={(e) => setForm({ ...form, akses_level: e.target.value as any })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              <option value="">— Ikut Kategori —</option>
              <option value="Public">Public</option>
              <option value="Internal">Internal</option>
              <option value="Confidential">Confidential</option>
            </select>
          </div>
        </div>

        {/* TANGGAL + RETENSI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal Berlaku</label>
            <input
              type="date"
              value={form.tanggal_berlaku}
              onChange={(e) => setForm({ ...form, tanggal_berlaku: e.target.value })}
              className={INPUT_CLASS + ' font-mono'}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Retensi (bulan)</label>
            <input
              type="number"
              min={1}
              max={600}
              value={form.retensi_bulan}
              onChange={(e) => setForm({ ...form, retensi_bulan: Number(e.target.value) })}
              className={INPUT_CLASS + ' font-mono'}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Auto dari kategori, bisa diubah
            </p>
          </div>
        </div>

        {/* PEMILIK */}
        <div>
          <label className={LABEL_CLASS}>Pemilik / PIC</label>
          <SearchableSelect
            options={guruList.map((g) => ({
              value: g.id,
              label: `${g.nama_lengkap}${g.nip ? ` · ${g.nip}` : ''}`,
            }))}
            value={form.pemilik_id}
            onChange={(v) => setForm({ ...form, pemilik_id: v })}
            placeholder="Pilih pemilik..."
            searchPlaceholder="Cari guru..."
            emptyMessage="Guru tidak ditemukan"
          />
        </div>

        {/* FILE UPLOAD */}
        <div>
          <label className={LABEL_CLASS}>File Dokumen *</label>

          {!selectedFile ? (
            <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
              <Upload size={22} className="text-indigo-400 mb-1.5" />
              <p className="text-xs text-slate-400">Klik untuk pilih file</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                PDF, JPG, PNG, WebP, DOCX, XLSX · Maks 25 MB
              </p>
              <p className="text-[10px] text-rose-400/70 mt-0.5">
                TIFF tidak didukung — convert ke PDF dulu
              </p>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-2">
              {/* Preview file */}
              <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                  selectedFile.type === 'application/pdf'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                }`}>
                  {selectedFile.type === 'application/pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {finalFile?.name ?? selectedFile.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] mt-0.5">
                    <span className="text-slate-500">
                      {formatFileSize(selectedFile.size)}
                    </span>
                    {compressionInfo && compressionInfo.ratio > 5 && (
                      <>
                        <span className="text-slate-600">→</span>
                        <span className="text-emerald-400 font-bold">
                          {formatFileSize(compressionInfo.compressed_size)}
                        </span>
                        <span className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                          -{compressionInfo.ratio.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {compressing ? (
                  <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Storage choice (kalau > 5 MB) */}
              {needsExternalChoice && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-2.5">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-amber-300">File cukup besar</p>
                      <p className="text-slate-400 mt-0.5">
                        Ukuran {formatFileSize(finalSize)} &gt; 5 MB.
                        Pilih metode penyimpanan:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseExternal(false)}
                      className={`text-left p-2.5 rounded-lg border transition cursor-pointer ${
                        !useExternal
                          ? 'bg-indigo-500/15 border-indigo-500/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          !useExternal ? 'border-indigo-500' : 'border-slate-600'
                        }`}>
                          {!useExternal && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                        </div>
                        <HardDrive size={11} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-200">Supabase</span>
                      </div>
                      <p className="text-[10px] text-slate-500 ml-5.5">
                        Upload ke storage (sisa kuota terbatas)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUseExternal(true)}
                      className={`text-left p-2.5 rounded-lg border transition cursor-pointer ${
                        useExternal
                          ? 'bg-emerald-500/15 border-emerald-500/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          useExternal ? 'border-emerald-500' : 'border-slate-600'
                        }`}>
                          {useExternal && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                        <Link2 size={11} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-200">External Link</span>
                      </div>
                      <p className="text-[10px] text-slate-500 ml-5.5">
                        Pakai Google Drive / Dropbox (hemat storage)
                      </p>
                    </button>
                  </div>

                  {useExternal && (
                    <div className="mt-2.5">
                      <label className={LABEL_CLASS}>URL Eksternal *</label>
                      <input
                        type="url"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://drive.google.com/file/d/..."
                        className={INPUT_CLASS}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Pastikan sharing di-set "Anyone with link can view"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* WAJIB BACA */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
          <label className="flex items-start gap-3 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={form.wajib_baca_enabled}
              onChange={(e) => setForm({ ...form, wajib_baca_enabled: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-indigo-500 cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Bell size={12} /> Wajib Baca
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Tandai dokumen ini sebagai wajib baca untuk guru tertentu
              </p>
            </div>
          </label>

          {form.wajib_baca_enabled && (
            <div className="mt-2 space-y-2">
              {/* Deadline */}
              <div>
                <label className={LABEL_CLASS}>Deadline Baca (opsional)</label>
                <input
                  type="date"
                  value={form.deadline_baca}
                  onChange={(e) => setForm({ ...form, deadline_baca: e.target.value })}
                  className={INPUT_CLASS + ' font-mono'}
                />
              </div>

              {/* Search + Select All */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users size={12} /> Pembaca ({form.wajib_baca_guru_ids.length})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllGuru}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  {form.wajib_baca_guru_ids.length === filteredGuru.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={pesertaSearch}
                  onChange={(e) => setPesertaSearch(e.target.value)}
                  placeholder="Cari guru..."
                  className={INPUT_CLASS + ' text-xs py-2'}
                />
              </div>

              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                {filteredGuru.map((g) => {
                  const selected = form.wajib_baca_guru_ids.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleWajibBacaGuru(g.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                        selected
                          ? 'bg-indigo-500/15 border border-indigo-500/30'
                          : 'bg-slate-900/60 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'
                      }`}>
                        {selected && <Check size={11} className="text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-200 truncate">{g.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{g.nip ?? '-'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* PROGRESS */}
        {uploadProgress && (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span className="text-xs text-indigo-300">{uploadProgress}</span>
          </div>
        )}

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
            disabled={saving || compressing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
            ) : (
              <><Upload size={14} /> Upload Dokumen</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}