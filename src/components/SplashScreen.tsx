// src/components/SplashScreen.tsx
import { Loader2 } from 'lucide-react';
import { Tagline } from './Tagline';
import { TAGLINE_DOA } from '@/constants/branding';
import { useSchoolBranding } from '@/hooks/useSchoolBranding';

export function SplashScreen() {
  const { nama_sekolah, logo_url } = useSchoolBranding();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content wrapper — animasi di sini (satu-satunya div wrapper level top) */}
      <div className="relative text-center space-y-6 px-6 max-w-lg animate-fade-in-up">
        {/* Logo sekolah */}
        <div className="w-24 h-24 mx-auto rounded-3xl bg-slate-900/60 border border-slate-800/60 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-indigo-500/10 overflow-hidden">
          {logo_url ? (
            <img
              src={logo_url}
              alt={nama_sekolah || 'Logo Sekolah'}
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                (e.target as HTMLImageElement).outerHTML =
                  '<span class="text-5xl">🏫</span>';
              }}
            />
          ) : (
            <span className="text-5xl">🏫</span>
          )}
        </div>

        {/* Text block */}
        <div>
          {nama_sekolah && (
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-semibold mb-2">
              {nama_sekolah}
            </p>
          )}
          <h1 className="text-lg font-extrabold text-slate-100 mb-5">
            Sistem Informasi Sekolah
          </h1>

          <Tagline variant="hero" separator="rub" className="justify-center" />

          <p className="text-[11px] text-slate-500 italic mt-6 max-w-xs mx-auto leading-relaxed">
            {TAGLINE_DOA}
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center gap-2 text-slate-500 pt-2">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span className="text-[11px]">Menyiapkan pengalaman terbaik...</span>
        </div>
      </div>
    </div>
  );
}