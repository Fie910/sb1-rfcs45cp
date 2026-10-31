// src/lib/haptics.ts
export type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection';

/**
 * Durasi getaran (ms) untuk tiap jenis feedback.
 * Kalau array, artinya getar-pause-getar.
 */
const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 40, 10],
  warning: [20, 15, 20],
  error: [30, 20, 30, 20, 30],
  selection: 5,
};

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * iOS tidak punya navigator.vibrate. Tapi Taptic Engine bisa dipicu
 * dengan trik `<input type="checkbox" switch>` (iOS 17.4+).
 */
function iosHaptic() {
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.style.cssText =
      'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    setTimeout(() => label.remove(), 500);
  } catch {
    // abaikan — kalau tidak didukung, ya tidak ada getaran
  }
}

/**
 * Picu haptic feedback. Aman dipanggil di mana saja (no-op di desktop).
 */
export function haptic(pattern: HapticPattern = 'light') {
  if (typeof navigator === 'undefined') return;

  if (isIOS()) {
    iosHaptic();
    return;
  }

  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // abaikan
    }
  }
}