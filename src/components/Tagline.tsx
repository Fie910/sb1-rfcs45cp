// src/components/Tagline.tsx
import {
  SEKOLAH_TAGLINE_FITRAH,
  SEKOLAH_TAGLINE_KARYA,
} from '@/constants/branding';

type TaglineVariant = 'inline' | 'hero' | 'footer';

type TaglineProps = {
  variant?: TaglineVariant;
  className?: string;
};

/**
 * Komponen tagline sekolah dengan sentuhan visual:
 * - "Merawat Fitrah" → italic serif, gradient emerald (rahmah, pertumbuhan)
 * - "Mengukir Karya" → bold sans, gradient amber (karya, legacy)
 * - Comma di tengah → aksen emas (penghubung)
 */
export function Tagline({ variant = 'inline', className = '' }: TaglineProps) {
  const sizeMap: Record<TaglineVariant, string> = {
    inline: 'text-xs',
    hero: 'text-lg md:text-2xl',
    footer: 'text-[10px]',
  };

  return (
    <span
      className={`inline-flex items-baseline gap-1 font-bold tracking-tight ${sizeMap[variant]} ${className}`}
    >
      <span className="italic font-serif bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
        {SEKOLAH_TAGLINE_FITRAH}
      </span>
      <span className="text-amber-400 font-serif">,</span>
      <span className="bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent">
        {SEKOLAH_TAGLINE_KARYA}
      </span>
    </span>
  );
}