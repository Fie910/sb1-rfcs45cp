// src/components/profil/AvatarPickerModal.tsx
import { useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  Loader2,
  Check,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { PRESETS, PresetAvatar } from './MuslimAvatarPresets';
import {
  compressImage,
  formatBytes,
  type CompressResult,
} from '@/lib/imageCompress';

type Props = {
  open: boolean;
  onClose: () => void;
  guruId: string | null;
  currentPreset: string | null | undefined;
  currentUrl: string | null | undefined;
  onSaved: () => Promise<void> | void;
};

type PreviewState = {
  originalFile: File;
  compressed: CompressResult;
  previewUrl: string;
} | null;

export function AvatarPickerModal({
  open,
  onClose,
  guruId,
  currentPreset,
  currentUrl,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPreset = async (presetId: string) => {
    if (!guruId || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('gurus')
        .update({ avatar_preset: presetId, avatar_url: null })
        .eq('id', guruId);
      if (error) throw error;
      await onSaved();
      showToast('success', 'Avatar diperbarui');
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal simpan avatar: ' + (err?.message ?? 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset agar bisa pilih file yang sama lagi
    if (!file) return;

    // Validasi tipe
    if (!file.type.startsWith('image/')) {
      showToast('error', 'File harus berupa gambar (JPG/PNG)');
      return;
    }
    // Validasi ukuran input (sebelum kompres)
    if (file.size > 20 * 1024 * 1024) {
      showToast('error', 'Ukuran maksimal 20 MB');
      return;
    }

    setCompressing(true);
    setPreview(null);

    try {
      // Kompres + convert ke WebP
      const result = await compressImage(file, {
        maxSize: 512,
        quality: 0.85,
        format: 'auto',
      });

      // Buat preview URL dari blob hasil kompresi
      const previewUrl = URL.createObjectURL(result.file);

      setPreview({
        originalFile: file,
        compressed: result,
        previewUrl,
      });
    } catch (err: any) {
      showToast('error', 'Gagal kompres gambar: ' + (err?.message ?? 'Error'));
    } finally {
      setCompressing(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!preview || !guruId) return;
    setUploading(true);
    try {
      const { file: outFile, format } = preview.compressed;
      const path = `${guruId}/avatar.${format === 'webp' ? 'webp' : 'jpg'}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, outFile, {
          upsert: true,
          contentType: outFile.type,
          cacheControl: '3600',
        });

      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      const bustedUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from('gurus')
        .update({ avatar_url: bustedUrl, avatar_preset: null })
        .eq('id', guruId);

      if (dbErr) throw dbErr;

      URL.revokeObjectURL(preview.previewUrl);
      await onSaved();
      showToast(
        'success',
        `Foto tersimpan (${formatBytes(preview.compressed.compressedSize)})`
      );
      handleCancelPreview();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal upload: ' + (err?.message ?? 'Error'));
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    if (preview?.previewUrl) {
      URL.revokeObjectURL(preview.previewUrl);
    }
    setPreview(null);
  };

  const handleResetToInitials = async () => {
    if (!guruId || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('gurus')
        .update({ avatar_preset: null, avatar_url: null })
        .eq('id', guruId);
      if (error) throw error;
      await onSaved();
      showToast('info', 'Avatar dikembalikan ke inisial');
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal reset avatar: ' + (err?.message ?? 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || compressing || uploading;

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Pilih Avatar" size="lg">
      {/* ==================== PREVIEW MODE ==================== */}
      {preview ? (
        <div className="space-y-5 pt-1">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <Sparkles size={14} />
            Pratinjau — akan diupload setelah konfirmasi
          </div>

          {/* Preview image */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-40 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-slate-950">
              <img
                src={preview.previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-slate-100">
                {preview.compressed.width} × {preview.compressed.height} px
              </p>
              <p className="text-xs text-slate-400">
                {preview.compressed.format === 'webp' ? 'WebP' : 'JPEG'} ·{' '}
                {formatBytes(preview.compressed.compressedSize)}
              </p>
            </div>
          </div>

          {/* Compression info */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Ukuran asli</span>
              <span className="font-mono text-slate-400">
                {formatBytes(preview.compressed.originalSize)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Setelah kompresi</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatBytes(preview.compressed.compressedSize)}
              </span>
            </div>
            {preview.compressed.reductionPercent > 0 && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-500">Hemat</span>
                <span className="font-bold text-emerald-400">
                  ↓ {preview.compressed.reductionPercent}% lebih kecil
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCancelPreview}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800/60 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ArrowLeft size={14} />
              Ganti Foto
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Upload...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Simpan
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // ==================== PICKER MODE ====================
        <div className="space-y-6 pt-1">
          {/* Upload Foto */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Foto Sendiri
            </p>
            <button
              onClick={handleUploadClick}
              disabled={busy}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition-colors disabled:opacity-50 cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                {compressing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200">
                  {compressing ? 'Mengompres...' : 'Upload dari Galeri'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  JPG/PNG · otomatis dikompres ke WebP
                </p>
              </div>
              <Upload size={16} className="text-slate-500 shrink-0" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Preset Pria */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Pilih Karakter (Pria)
            </p>
            <div className="grid grid-cols-4 gap-3">
              {PRESETS.filter((p) => p.gender === 'male').map((preset) => {
                const active = currentPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    disabled={busy}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer disabled:opacity-50 ${
                      active
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-105'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                    title={preset.label}
                  >
                    <PresetAvatar config={preset} className="w-full h-full" />
                    {active && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Wanita */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Pilih Karakter (Wanita)
            </p>
            <div className="grid grid-cols-4 gap-3">
              {PRESETS.filter((p) => p.gender === 'female').map((preset) => {
                const active = currentPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    disabled={busy}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer disabled:opacity-50 ${
                      active
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-105'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                    title={preset.label}
                  >
                    <PresetAvatar config={preset} className="w-full h-full" />
                    {active && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          {(currentPreset || currentUrl) && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={handleResetToInitials}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors disabled:opacity-50 cursor-pointer text-xs font-bold"
              >
                <Trash2 size={14} />
                Gunakan Inisial Nama
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}