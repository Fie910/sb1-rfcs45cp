// src/components/perpustakaan/QRScanner.tsx
// Reusable QR Scanner menggunakan html5-qrcode.

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff, Loader2, ScanLine } from 'lucide-react';

interface QRScannerProps {
  onScan: (text: string) => void;
  hint?: string;
  /** Kalau true, scanner akan pause sebentar setelah scan berhasil */
  pauseAfterScan?: boolean;
}

export function QRScanner({
  onScan,
  hint = 'Posisikan QR di dalam kotak',
  pauseAfterScan = false,
}: QRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const onScanRef = useRef(onScan);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  // Keep callback fresh
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    const scanner = new Html5Qrcode(container);
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Debounce — hindari scan berulang dalam 1.5 detik
            const now = Date.now();
            if (
              lastScanRef.current.text === decodedText &&
              now - lastScanRef.current.at < 1500
            ) return;
            lastScanRef.current = { text: decodedText, at: now };

            onScanRef.current(decodedText);

            if (pauseAfterScan) {
              try {
                scanner.pause(true);
                setTimeout(() => {
                  try { scanner.resume(); } catch { /* ignore */ }
                }, 1500);
              } catch { /* ignore */ }
            }
          },
          () => { /* ignore frame errors */ }
        );
        if (!cancelled) setStatus('ready');
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        const name = err?.name ?? '';
        const msg = err?.message ?? '';
        if (name === 'NotAllowedError' || msg.includes('NotAllowed')) {
          setError('Akses kamera ditolak. Izinkan akses di browser.');
        } else if (name === 'NotFoundError' || msg.includes('NotFound')) {
          setError('Kamera tidak ditemukan.');
        } else if (name === 'NotReadableError' || msg.includes('NotReadable')) {
          setError('Kamera sedang digunakan aplikasi lain.');
        } else {
          setError(msg || 'Gagal mengakses kamera.');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try { s.stop().catch(() => {}); } catch { /* ignore */ }
        try { s.clear(); } catch { /* ignore */ }
      }
      scannerRef.current = null;
    };
  }, [pauseAfterScan]);

  return (
    <>
      <div
        className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 qr-scanner-wrap"
        style={{ aspectRatio: '1 / 1' }}
      >
        <div ref={containerRef} className="w-full h-full" />

        {/* LOADING */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10">
            <Loader2 className="animate-spin text-indigo-400 mb-2" size={28} />
            <p className="text-xs text-slate-400">Menyiapkan kamera...</p>
          </div>
        )}

        {/* ERROR */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center z-10">
            <CameraOff className="text-rose-400 mb-2" size={32} />
            <p className="text-xs font-bold text-slate-300 mb-1">Kamera tidak tersedia</p>
            <p className="text-[11px] text-slate-500 max-w-xs">{error}</p>
          </div>
        )}

        {/* READY overlay */}
        {status === 'ready' && (
          <>
            {/* Corner markers */}
            <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg pointer-events-none" />
            <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-indigo-400 rounded-br-lg pointer-events-none" />

            {/* Hint bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <p className="text-[11px] text-slate-100 font-medium text-center flex items-center justify-center gap-1.5">
                <ScanLine size={12} className="text-indigo-400" />
                {hint}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Scoped CSS untuk video yang di-inject html5-qrcode */}
      <style>{`
        .qr-scanner-wrap video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        .qr-scanner-wrap canvas {
          display: none !important;
        }
      `}</style>
    </>
  );
}