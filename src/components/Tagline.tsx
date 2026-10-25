// src/components/Tagline.tsx
import {
  SEKOLAH_TAGLINE_FITRAH,
  SEKOLAH_TAGLINE_KARYA,
} from '@/constants/branding';

type TaglineVariant = 'inline' | 'hero' | 'footer';
export type TaglineSeparator = 'rub' | 'star4' | 'diamond' | 'flower' | 'dot';

type TaglineProps = {
  variant?: TaglineVariant;
  separator?: TaglineSeparator;
  className?: string;
};

const SEPARATORS: Record<TaglineSeparator, string> = {
  rub: '۞',
  star4: '✦',
  diamond: '❖',
  flower: '❋',
  dot: '•',
};

/**
 * Tagline sekolah dengan separator simetris.
 * - "Merawat Fitrah" → italic serif, gradient emerald (rahmah, pertumbuhan)
 * - Separator → aksen emas dengan subtle glow
 * - "Mengukir Karya" → bold sans, gradient amber (karya, legacy)
 */
export function Tagline({
  variant = 'inline',
  separator = 'rub',
  className = '',
}: TaglineProps) {
  const sizeMap: Record<TaglineVariant, string> = {
    inline: 'text-xs gap-2',
    hero: 'text-lg md:text-2xl gap-3',
    footer: 'text-[10px] gap-1.5',
  };

  const separatorSizeMap: Record<TaglineVariant, string> = {
    inline: 'text-sm',
    hero: 'text-xl md:text-3xl',
    footer: 'text-[11px]',
  };

  return (
    <span
      className={`inline-flex items-baseline ${sizeMap[variant]} ${className}`}
    >
      <span className="italic font-serif bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
        {SEKOLAH_TAGLINE_FITRAH}
      </span>
      <span
        aria-hidden="true"
        className={`leading-none select-none text-amber-400 ${separatorSizeMap[variant]} drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]`}
        style={{ fontWeight: 400 }}
      >
        {SEPARATORS[separator]}
      </span>
      <span className="bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent font-bold">
        {SEKOLAH_TAGLINE_KARYA}
      </span>
    </span>
  );
}