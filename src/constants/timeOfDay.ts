// src/constants/timeOfDay.ts
export type TimePhase = 'dawn' | 'morning' | 'day' | 'golden' | 'evening' | 'night';

export function getTimePhase(hour?: number): TimePhase {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 9) return 'dawn';
  if (h >= 9 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'day';
  if (h >= 15 && h < 17) return 'golden';
  if (h >= 17 && h < 18) return 'evening';
  return 'night';
}

export const PHASE_IMAGES: Record<TimePhase, string> = {
  dawn:    '/images/time-of-day/dawn.jpg',
  morning: '/images/time-of-day/morning.jpg',
  day:     '/images/time-of-day/day.jpg',
  golden:  '/images/time-of-day/golden.jpg',
  evening: '/images/time-of-day/evening.jpg',
  night:   '/images/time-of-day/night.jpg',
};