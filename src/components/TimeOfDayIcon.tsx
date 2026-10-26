// src/components/TimeOfDayIcon.tsx
import { Sunrise, Sun, Sunset, Moon } from 'lucide-react';

type TimePhase = 'dawn' | 'morning' | 'day' | 'golden' | 'evening' | 'night';

function getTimePhase(): TimePhase {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 6) return 'dawn';
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'day';
  if (hour >= 15 && hour < 17) return 'golden';
  if (hour >= 17 && hour < 19) return 'evening';
  return 'night';
}

const PHASE_CONFIG: Record<
  TimePhase,
  {
    icon: typeof Sunrise;
    colorClass: string;
    glowClass: string;
    animationClass: string;
  }
> = {
  dawn: {
    icon: Sunrise,
    colorClass: 'text-amber-400',
    glowClass: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]',
    animationClass: '', // statis, belum terbit
  },
  morning: {
    icon: Sun,
    colorClass: 'text-yellow-400',
    glowClass: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.6)]',
    animationClass: 'animate-sun-slow',
  },
  day: {
    icon: Sun,
    colorClass: 'text-amber-300',
    glowClass: 'drop-shadow-[0_0_18px_rgba(252,211,77,0.7)]',
    animationClass: 'animate-sun-slow',
  },
  golden: {
    icon: Sunset,
    colorClass: 'text-orange-400',
    glowClass: 'drop-shadow-[0_0_14px_rgba(251,146,60,0.6)]',
    animationClass: 'animate-sun-slow',
  },
  evening: {
    icon: Sunset,
    colorClass: 'text-rose-400',
    glowClass: 'drop-shadow-[0_0_14px_rgba(251,113,133,0.5)]',
    animationClass: '',
  },
  night: {
    icon: Moon,
    colorClass: 'text-indigo-300',
    glowClass: '',
    animationClass: 'animate-moon-glow',
  },
};

export function TimeOfDayIcon({ size = 32 }: { size?: number }) {
  const phase = getTimePhase();
  const { icon: Icon, colorClass, glowClass, animationClass } = PHASE_CONFIG[phase];

  return (
    <Icon
      size={size}
      className={`${colorClass} ${glowClass} ${animationClass}`}
      aria-hidden="true"
    />
  );
}