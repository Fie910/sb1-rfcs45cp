// src/components/SplashScreen.tsx
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Tagline } from './Tagline';
import { TAGLINE_DOA } from '@/constants/branding';
import { useSchoolBranding } from '@/hooks/useSchoolBranding';

export function SplashScreen({ isFading = false }: { isFading?: boolean }) {
  const { nama_sekolah, logo_url } = useSchoolBranding();
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center overflow-hidden
                  transition-opacity duration-500 ease-out
                  ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-fade-in-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-fade-in-slow" />
      </div>

      <div className="relative text-center space-y-6 px-6 max-w-lg">
        {/* Logo — fade in pertama */}
        {logo_url && !logoError ? (
          <img
            src={logo_url}
            alt={nama_sekolah || 'Logo Sekolah'}
            className="w-24 h-24 object-contain mx-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)] opacity-0 animate-fade-in-up"
            style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
            onError={() => setLogoError(true)}
          />
        ) : (
          <div
            className="w-24 h-24 mx-auto rounded-3xl bg-slate-900/60 border border-slate-800/60 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-indigo-500/10 opacity-0 animate-fade-in-up"
            style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
          >
            <span className="text-5xl">🏫</span>
          </div>
        )}

        {/* Nama + Heading — fade in kedua */}
        <div
          className="opacity-0 animate-fade-in-up"
          style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
        >
          {nama_sekolah && (
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-semibold mb-2">
              {nama_sekolah}
            </p>
          )}
          <h1 className="text-lg font-extrabold text-slate-100 mb-5">
            Sistem Informasi Sekolah
          </h1>
        </div>

        {/* Tagline — fade in ketiga (PALING DINANTIKAN) */}
        <div
          className="opacity-0 animate-fade-in-up"
          style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}
        >
          <Tagline variant="hero" separator="rub" className="justify-center" />
        </div>

        {/* Doa — fade in keempat */}
        <p
          className="text-[11px] text-slate-500 italic mt-6 max-w-xs mx-auto leading-relaxed opacity-0 animate-fade-in-up"
          style={{ animationDelay: '550ms', animationFillMode: 'forwards' }}
        >
          {TAGLINE_DOA}
        </p>

        {/* Loader — fade in terakhir */}
        <div
          className="flex items-center justify-center gap-2 text-slate-500 pt-2 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '700ms', animationFillMode: 'forwards' }}
        >
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span className="text-[11px]">Menyiapkan pengalaman terbaik...</span>
        </div>
      </div>
    </div>
  );
}