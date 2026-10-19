// src/components/kedisiplinan/PrintSP.tsx
// Modal wrapper — auto-generate PDF Surat Peringatan dan download.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Download,
  XCircle,
  FileCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  generateSPPDF,
  type SPLevel,
} from '@/lib/pdf/generateSPPDF';

// =============================================================================
// TYPES
// =============================================================================
type SuratPeringatanData = {
  nomor_sp: string;
  level: SPLevel;
  tanggal_terbit: string;
  batas_waktu: string | null;
  alasan: string;
  total_poin_pelanggaran: number;
  total_poin_prestasi: number;
  catatan: string | null;
};

type SiswaData = {
  nisn: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  kelas: string;
};

type PenandatanganData = {
  nama: string;
  nip?: string | null;
  jabatan?: string;
};

type PrintSPProps = {
  sp: SuratPeringatanData;
  siswa: SiswaData;
  penandatangan: PenandatanganData;
  verification_token?: string | null;
  content_hash?: string | null;
  onClose: () => void;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function PrintSP({
  sp,
  siswa,
  penandatangan,
  verification_token,
  content_hash,
  onClose,
}: PrintSPProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const generate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      await generateSPPDF({
        sp,
        siswa,
        penandatangan,
        verification_token,
        content_hash,
      });
      setStatus('success');
    } catch (err: any) {
      console.error('[PrintSP] generate error:', err);
      setErrorMsg(err?.message || 'Gagal membuat PDF');
      setStatus('error');
    }
  }, [sp, siswa, penandatangan, verification_token, content_hash]);

  // Auto-generate saat modal dibuka
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-100 truncate">
              Cetak Surat Peringatan
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {sp.level} · {sp.nomor_sp}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* CONTENT */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={36} className="animate-spin text-indigo-400" />
            <p className="text-sm font-semibold text-slate-200">Membuat PDF...</p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              Mohon tunggu sebentar. File akan otomatis ter-download.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck size={32} />
            </div>
            <p className="text-sm font-bold text-emerald-300">PDF berhasil dibuat!</p>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              File sudah ter-download ke folder <strong>Downloads</strong> Anda.
              Buka file untuk melihat hasil.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle size={32} />
            </div>
            <p className="text-sm font-bold text-rose-300">Gagal membuat PDF</p>
            <p className="text-xs text-slate-400 text-center max-w-xs break-words">
              {errorMsg}
            </p>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 pt-2">
          {status === 'error' && (
            <button
              onClick={generate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw size={12} /> Coba Lagi
            </button>
          )}
          {status === 'success' && (
            <button
              onClick={generate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              <Download size={12} /> Unduh Lagi
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            {status === 'loading' ? 'Batal' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}