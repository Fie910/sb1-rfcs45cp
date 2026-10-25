// src/components/SplashScreen.tsx
import { Loader2 } from 'lucide-react';
import { Tagline } from './Tagline';
import { TAGLINE_DOA } from '@/constants/branding';

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center space-y-6 px-6 max-w-lg">
        {/* Logo placeholder — ganti dengan logo sekolah */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
          <span className="text-4xl">🏫</span>
        </div>

        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-semibold mb-2">
            Selamat Datang di
          </p>
          <h1 className="text-lg font-extrabold text-slate-100 mb-4">
            Sistem Informasi Sekolah
          </h1>

          {/* Tagline dengan gaya hero */}
          <Tagline variant="hero" className="block" />

          <p className="text-[11px] text-slate-500 italic mt-6 max-w-xs mx-auto leading-relaxed">
            {TAGLINE_DOA}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-500 pt-2">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span className="text-[11px]">Menyiapkan pengalaman terbaik...</span>
        </div>
      </div>
    </div>
  );
}