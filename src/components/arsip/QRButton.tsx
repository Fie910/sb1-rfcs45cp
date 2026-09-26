// src/components/arsip/QRButton.tsx
// Tombol reusable untuk generate/preview/download/print QR arsip.

import { useState } from 'react';
import {
  QrCode, Loader2, Download, Printer, Eye, X,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import {
  generateArsipQRDataUrl,
  downloadArsipQR,
  printArsipQR,
  buildArsipVerifyUrl,
} from '@/lib/generateArsipQR';

type Props = {
  verificationToken: string;
  contentHash: string | null;
  nomorDokumen: string | null;
  judul: string;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
};

export function QRButton({
  verificationToken,
  contentHash,
  nomorDokumen,
  judul,
  variant = 'outline',
  size = 'md',
  className = '',
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // ==========================================================================
  // OPEN PREVIEW
  // ==========================================================================
  const handleOpenPreview = async () => {
    setPreviewOpen(true);
    if (qrDataUrl) return;

    setLoading(true);
    try {
      const url = await generateArsipQRDataUrl(verificationToken, contentHash, 600);
      setQrDataUrl(url);
    } catch (err: any) {
      showToast('error', 'Gagal generate QR: ' + (err.message || 'Error'));
      setPreviewOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // DOWNLOAD PNG
  // ==========================================================================
  const handleDownload = async () => {
    setBusy('download');
    try {
      await downloadArsipQR(verificationToken, contentHash, nomorDokumen, judul);
      showToast('success', 'QR berhasil didownload');
    } catch (err: any) {
      showToast('error', 'Gagal download: ' + (err.message || 'Error'));
    } finally {
      setBusy(null);
    }
  };

  // ==========================================================================
  // PRINT
  // ==========================================================================
  const handlePrint = async () => {
    setBusy('print');
    try {
      await printArsipQR(verificationToken, contentHash, nomorDokumen, judul);
    } catch (err: any) {
      showToast('error', 'Gagal print: ' + (err.message || 'Error'));
    } finally {
      setBusy(null);
    }
  };

  // ==========================================================================
  // STYLE
  // ==========================================================================
  const variantClass =
    variant === 'solid'
      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
      : variant === 'outline'
      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
      : 'bg-transparent text-indigo-400 hover:bg-indigo-500/10';

  const sizeClass =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-[10px] gap-1.5'
      : 'px-3 py-2 text-[11px] gap-1.5';

  const verifyUrl = buildArsipVerifyUrl(verificationToken, contentHash);

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPreview}
        className={`inline-flex items-center justify-center rounded-xl font-bold transition cursor-pointer ${variantClass} ${sizeClass} ${className}`}
      >
        <QrCode size={size === 'sm' ? 11 : 12} /> QR Code
      </button>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="QR Verifikasi Dokumen"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          {/* QR IMAGE */}
          <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
            {loading ? (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-64 h-64"
              />
            ) : null}
          </div>

          {/* INFO */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
              Nomor Dokumen
            </p>
            <p className="text-xs font-mono font-bold text-slate-100">
              {nomorDokumen ?? '-'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              Scan QR ini untuk memverifikasi keaslian dokumen. Sistem akan
              membandingkan hash content untuk deteksi perubahan.
            </p>
          </div>

          {/* URL */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              URL Verifikasi
            </p>
            <p className="text-[10px] font-mono text-slate-400 break-all">
              {verifyUrl}
            </p>
          </div>

          {/* HASH */}
          {contentHash && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                SHA-256 Hash (16 char pertama)
              </p>
              <p className="text-[10px] font-mono text-slate-400 break-all">
                {contentHash.slice(0, 16)}
              </p>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy === 'download'}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {busy === 'download' ? (
                <><Loader2 size={14} className="animate-spin" /> Download...</>
              ) : (
                <><Download size={14} /> Download PNG</>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={busy === 'print'}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {busy === 'print' ? (
                <><Loader2 size={14} className="animate-spin" /> Print...</>
              ) : (
                <><Printer size={14} /> Cetak QR</>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}