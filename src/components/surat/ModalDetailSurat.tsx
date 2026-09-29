// src/components/surat/ModalDetailSurat.tsx
// Modal detail surat — info lengkap + preview berkas + AI ringkasan.
// Self-contained (pakai modal custom, tidak pakai Modal dari @/components/Modal).

import { useState } from 'react';
import {
  X, FileText, Calendar, User, Paperclip, ExternalLink, Sparkles,
  Download, Image as ImageIcon, Hash, Building2,
} from 'lucide-react';
import { RingkasanAiSurat } from './RingkasanAiSurat';
import type { RingkasanSuratAI } from '@/types/database';
import type { Surat } from '@/types/surat';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  surat: Surat | null;
  onClose: () => void;
  onSaved?: () => void;
};

// =============================================================================
// HELPERS
// =============================================================================
function isImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.includes('/image/')
  );
}

function isPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('application/pdf');
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalDetailSurat({ surat, onClose, onSaved }: Props) {
  const [previewError, setPreviewError] = useState(false);

  if (!surat) return null;

  const sifat = (surat as any).sifat as string | null | undefined;
  const fileIsImage = isImage(surat.file_url);
  const fileIsPdf = isPdf(surat.file_url);
  const canPreview = fileIsImage || fileIsPdf;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* HEADER */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                Detail Surat
              </h3>
              <p className="text-xs text-indigo-400 font-mono truncate mt-0.5">
                {surat.nomor_surat}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto p-5 space-y-4">

          {/* INFO SURAT */}
          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Perihal
              </p>
              <p className="text-sm font-bold text-slate-100">{surat.perihal}</p>
            </div>

            {surat.ringkasan && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                  Ringkasan Manual
                </p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {surat.ringkasan}
                </p>
              </div>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/5">
              <MetaItem
                icon={User}
                label={surat.jenis_surat === 'MASUK' ? 'Pengirim' : 'Tujuan'}
                value={surat.pengirim_atau_tujuan}
              />
              <MetaItem
                icon={Calendar}
                label="Tanggal Surat"
                value={surat.tanggal_surat}
              />
              {surat.kategori_surat && (
                <MetaItem
                  icon={Hash}
                  label="Kategori"
                  value={`[${surat.kategori_surat.kode}] ${surat.kategori_surat.nama_kategori}`}
                />
              )}
              {sifat && (
                <MetaItem
                  icon={Building2}
                  label="Sifat"
                  value={sifat}
                />
              )}
              {surat.jenis_surat !== 'MASUK' && surat.nama_penerima_surat && (
                <MetaItem
                  icon={User}
                  label="Diterima Oleh"
                  value={surat.nama_penerima_surat}
                />
              )}
              {surat.jenis_surat !== 'MASUK' && surat.metode_pengiriman && (
                <MetaItem
                  icon={Paperclip}
                  label="Metode Kirim"
                  value={`${surat.metode_pengiriman}${
                    surat.no_resi ? ` · ${surat.no_resi}` : ''
                  }`}
                />
              )}
            </div>
          </div>

          {/* PREVIEW BERKAS */}
          {surat.file_url ? (
            <div className="bg-slate-950/60 border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-slate-900/40">
                <div className="flex items-center gap-2">
                  {fileIsPdf ? (
                    <FileText size={13} className="text-rose-400" />
                  ) : (
                    <ImageIcon size={13} className="text-indigo-400" />
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {fileIsPdf ? 'Pratinjau PDF' : fileIsImage ? 'Pratinjau Gambar' : 'Berkas Surat'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={surat.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 transition"
                  >
                    <ExternalLink size={10} /> Buka
                  </a>
                  <a
                    href={surat.file_url}
                    download
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 transition"
                  >
                    <Download size={10} /> Unduh
                  </a>
                </div>
              </div>

              {canPreview && !previewError ? (
  fileIsPdf ? (
    // ✅ Batch 12C: pakai Google Docs Viewer sebagai proxy
    // Supabase Storage kirim X-Frame-Options: DENY → tidak bisa iframe langsung
    <iframe
      src={`https://docs.google.com/viewer?url=${encodeURIComponent(
        surat.file_url
      )}&embedded=true`}
      className="w-full h-96 bg-slate-950"
      title={surat.perihal}
      onError={() => setPreviewError(true)}
    />
  ) : (
    <img
      src={surat.file_url}
      alt={surat.perihal}
      className="w-full max-h-96 object-contain bg-slate-950"
      onError={() => setPreviewError(true)}
    />
  )
) : (
                <div className="text-center py-12">
                  <FileText size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500">
                    {previewError
                      ? 'Gagal memuat pratinjau. Gunakan tombol Buka / Unduh.'
                      : 'Format berkas tidak dapat dipratinjau langsung.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-dashed border-white/10 rounded-2xl p-8 text-center">
              <Paperclip size={28} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">
                Surat ini belum memiliki berkas scan.
              </p>
            </div>
          )}

          {/* AI RINGKASAN */}
          <RingkasanAiSurat
            suratId={surat.id ?? ''}
            fileUrl={surat.file_url ?? null}
            sifat={sifat}
            existingRingkasan={
              ((surat as any).ai_ringkasan as RingkasanSuratAI | null) ?? null
            }
            onSaved={onSaved}
          />

          {/* FOOTER */}
          <div className="flex justify-end pt-3 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB
// =============================================================================
function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-lg bg-slate-900 border border-white/10 text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={11} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
        <p className="text-xs text-slate-200 truncate">{value || '-'}</p>
      </div>
    </div>
  );
}