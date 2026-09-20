// src/components/InstallPWA.tsx
// Banner floating di pojok bawah untuk mendorong user install aplikasi sebagai PWA.
//
// - Android/Chrome/Edge: trigger install dialog native via beforeinstallprompt
// - iOS Safari          : tampilkan modal instruksi manual (Share → Add to Home Screen)
//
// Auto-hide kalau:
//   - sudah install (standalone)
//   - user dismiss (7 hari)
//   - bukan Android/Chrome/Edge dan bukan iOS

import { useState } from 'react';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallPWA() {
  const {
    canPrompt,
    isIOS,
    isStandalone,
    isDismissed,
    isReady,
    promptInstall,
    dismiss,
  } = useInstallPrompt();

  const [showIOSModal, setShowIOSModal] = useState(false);

  // Guard: jangan render apapun kalau:
  if (!isReady) return null;
  if (isStandalone) return null;
  if (isDismissed) return null;
  if (!canPrompt && !isIOS) return null;

  const handleInstallClick = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      // Kalau user dismiss di dialog native, jangan tandai dismissed
      // supaya banner tetap muncul kalau mereka berubah pikiran.
      if (outcome === 'accepted') {
        // Installed — state akan terupdate oleh event appinstalled
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* Fixed Banner di Pojok Bawah */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-40">
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-500/10 p-4 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Download size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Smartphone size={14} className="text-indigo-400" />
                Install Aplikasi
              </p>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                Akses lebih cepat & notifikasi tetap muncul meski aplikasi ditutup.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
                >
                  Install Sekarang
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Nanti
                </button>
              </div>
            </div>

            <button
              onClick={dismiss}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Instruksi iOS */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowIOSModal(false)}
          />

          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-100 text-lg">
                  Install ke iPhone / iPad
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ikuti langkah berikut untuk menambahkan aplikasi:
                </p>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <ol className="space-y-4 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="leading-relaxed">
                  Tap tombol{' '}
                  <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-semibold">
                    <Share size={12} /> Bagikan
                  </span>{' '}
                  di Safari (bawah layar)
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="leading-relaxed">
                  Scroll dan pilih{' '}
                  <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-semibold">
                    <Plus size={12} /> Tambah ke Layar Utama
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="leading-relaxed">
                  Tap <strong className="text-slate-100">Tambah</strong> di pojok kanan atas
                </div>
              </li>
            </ol>

            <div className="mt-6 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
              Setelah ditambahkan, aplikasi akan muncul di layar utama seperti aplikasi biasa.
              Notifikasi push juga akan bekerja lebih optimal.
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}