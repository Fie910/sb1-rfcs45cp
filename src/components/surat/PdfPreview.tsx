// src/components/surat/PdfPreview.tsx
// Preview PDF client-side pakai pdfjs-dist — render setiap halaman ke canvas.
// 100% lokal, tidak butuh server, tidak kena X-Frame-Options.

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, Download } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  url: string;
  className?: string;
  maxHeight?: string;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function PdfPreview({ url, className = '', maxHeight = '400px' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setTotalPages(0);

        // 1. Dynamic import pdfjs-dist
        const pdfjs = await import('pdfjs-dist');

        // 2. Worker setup
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

        // 3. Load PDF
        const loadingTask = pdfjs.getDocument({
          url,
          // CORS: Supabase public bucket sudah support
          withCredentials: false,
        });
        const pdf = await loadingTask.promise;

        if (cancelled || !container) return;

        setTotalPages(pdf.numPages);
        container.innerHTML = '';

        // 4. Render setiap halaman
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.className = 'rounded-lg border border-white/10';

          const wrapper = document.createElement('div');
          wrapper.className = 'mb-3 relative';
          wrapper.appendChild(canvas);

          // Page number indicator
          const pageLabel = document.createElement('div');
          pageLabel.className =
            'absolute top-2 right-2 text-[10px] font-bold text-slate-200 ' +
            'px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur border border-white/10';
          pageLabel.textContent = `${i} / ${pdf.numPages}`;
          wrapper.appendChild(pageLabel);

          container.appendChild(wrapper);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Fill white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
          }).promise;
        }

        if (!cancelled) setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[PdfPreview]', err);
          setError(
            err.message || 'Gagal memuat PDF. Coba tombol Unduh untuk membuka manual.'
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // ==========================================================================
  // ERROR STATE
  // ==========================================================================
  if (error) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle size={32} className="mx-auto text-rose-400 mb-2" />
        <p className="text-xs text-slate-400 mb-3">{error}</p>
        <a
          href={url}
          download
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-white/10 transition"
        >
          <Download size={12} /> Unduh PDF
        </a>
      </div>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div
      className={`relative bg-slate-900 overflow-y-auto custom-scrollbar ${className}`}
      style={{ maxHeight }}
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-10">
          <Loader2 className="animate-spin text-indigo-400 mb-2" size={28} />
          <p className="text-xs text-slate-400">Memuat pratinjau PDF...</p>
        </div>
      )}

      <div ref={containerRef} className="p-3" />

      {!loading && totalPages > 0 && (
        <div className="sticky bottom-0 left-0 right-0 text-center text-[10px] text-slate-500 py-1.5 bg-slate-950/80 backdrop-blur border-t border-white/5">
          {totalPages} halaman
        </div>
      )}
    </div>
  );
}