// src/components/PrintDisposisi.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Download, XCircle, FileCheck, RefreshCw, X, Eye } from 'lucide-react';
import { generateDisposisiPDF, type SuratDisposisiData, type DisposisiData } from '@/lib/pdf/generateDisposisiPDF';

interface PrintDisposisiProps {
  surat?: SuratDisposisiData;
  disposisi: DisposisiData;
  namaSekolah?: string;
  onClose: () => void;
}

export function PrintDisposisi({ surat, disposisi, onClose }: PrintDisposisiProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const isGeneratedRef = useRef(false);

  const generate = useCallback(async (action: 'save' | 'preview' = 'save') => {
    setStatus('loading');
    setErrorMsg('');
    try {
      await generateDisposisiPDF({ surat, disposisi }, action);
      setStatus('success');
    } catch (err: any) {
      console.error('[PrintDisposisi] generate error:', err);
      setErrorMsg(err?.message || 'Gagal membuat PDF');
      setStatus('error');
    }
  }, [surat, disposisi]);

  useEffect(() => {
    if (isGeneratedRef.current) return;
    isGeneratedRef.current = true;
    generate('preview'); // Auto preview saat dibuka
  }, [generate]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-100 truncate">
              Cetak Lembar Disposisi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              No: {surat?.no_surat || disposisi.surat?.no_surat || '-'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0">
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
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle size={32} />
            </div>
            <p className="text-sm font-bold text-rose-300">Gagal membuat PDF</p>
            <p className="text-xs text-slate-400 text-center max-w-xs break-words">{errorMsg}</p>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 pt-2">
          {status === 'error' && (
            <button onClick={() => generate('save')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer">
              <RefreshCw size={12} /> Coba Lagi
            </button>
          )}
          
          {status === 'success' && (
            <>
              <button onClick={() => generate('preview')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-indigo-600/20">
                <Eye size={12} /> Pratinjau
              </button>
              <button onClick={() => generate('save')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                <Download size={12} /> Unduh
              </button>
            </>
          )}

          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
            {status === 'loading' ? 'Batal' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}