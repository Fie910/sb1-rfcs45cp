// src/components/perpustakaan/QRScanner.tsx
// Reusable QR & Barcode Scanner menggunakan html5-qrcode.

import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff, Loader2, ScanLine } from 'lucide-react';

interface QRScannerProps {
  onScan: (text: string) => void;
  hint?: string;
  pauseAfterScan?: boolean;
}

export function QRScanner({
  onScan,
  hint = 'Posisikan QR / Barcode di dalam kotak',
  pauseAfterScan = false,
}: QRScannerProps) {
  const rawId = useId();
  const containerId = `qr-${rawId.replace(/:/g, '_')}`;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const onScanRef = useRef(onScan);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
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
          setError('Akses kamera ditolak. Izinkan akses di browser Anda.');
        } else if (name === 'NotFoundError' || msg.includes('NotFound')) {
          setError('Kamera tidak ditemukan pada perangkat ini.');
        } else if (name === 'NotReadableError' || msg.includes('NotReadable')) {
          setError('Kamera sedang digunakan aplikasi lain.');
        } else {
          setError(msg || 'Gagal mengakses kamera.');
        }
      }
    };

    const timer = setTimeout(start, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      if (s) {
        try { s.stop().catch(() => {}); } catch { /* ignore */ }
        try { s.clear(); } catch { /* ignore */ }
      }
      scannerRef.current = null;
    };
  }, [containerId, pauseAfterScan]);

  return (
    <>
      <div
        className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 qr-scanner-wrap"
        style={{ aspectRatio: '1 / 1' }}
      >
        <div id={containerId} className="w-full h-full" />

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 pointer-events-none">
            <Loader2 className="animate-spin text-indigo-400 mb-2" size={28} />
            <p className="text-xs text-slate-400">Menyiapkan kamera...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center z-10">
            <CameraOff className="text-rose-400 mb-2" size={32} />
            <p className="text-xs font-bold text-slate-300 mb-1">Kamera tidak tersedia</p>
            <p className="text-[11px] text-slate-500 max-w-xs">{error}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg pointer-events-none" />
            <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-indigo-400 rounded-br-lg pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <p className="text-[11px] text-slate-100 font-medium text-center flex items-center justify-center gap-1.5">
                <ScanLine size={12} className="text-indigo-400" />
                {hint}
              </p>
            </div>
          </>
        )}
      </div>

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