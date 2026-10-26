// src/components/TaglineBadge.tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { SEKOLAH_TAGLINE_FITRAH, SEKOLAH_TAGLINE_KARYA } from '@/constants/branding';

const STORAGE_KEY = 'smk_tagline_badge_dismissed_v1';

export function TaglineBadge() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true); // default true → cegah flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const flag = localStorage.getItem(STORAGE_KEY);
      setDismissed(flag === '1');
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  // Tidak tampil di halaman publik & sebelum mount
  if (!mounted || dismissed) return null;

  const hideOn = ['/login', '/forgot-password', '/reset-password'];
  if (hideOn.some((p) => location.pathname.startsWith(p))) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div
      className="hidden md:flex fixed bottom-4 center-0 z-[80] items-center gap-1.5
                 px-2.5 py-1 rounded-full
                 bg-slate-900/40 border border-slate-800/40
                 backdrop-blur-md opacity-70 hover:opacity-90
                 transition-opacity duration-300 group cursor-default
                 select-none"
      title="Tagline Sekolah"
    >
      <span className="text-amber-400/80 text-[10px] leading-none">۞</span>
      <span className="text-[10px] italic font-serif bg-gradient-to-r from-emerald-300/80 to-teal-300/80 bg-clip-text text-transparent">
        {SEKOLAH_TAGLINE_FITRAH}
      </span>
      <span className="text-amber-400/60 text-[8px]">·</span>
      <span className="text-[10px] font-bold bg-gradient-to-r from-amber-300/80 to-yellow-300/80 bg-clip-text text-transparent">
        {SEKOLAH_TAGLINE_KARYA}
      </span>
      <button
        onClick={handleDismiss}
        className="ml-1 p-0.5 rounded-full text-slate-600 hover:text-slate-400 hover:bg-slate-800/60
                   opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        title="Sembunyikan"
        aria-label="Sembunyikan tagline"
      >
        <X size={10} />
      </button>
    </div>
  );
}