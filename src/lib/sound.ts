// src/lib/sound.ts
// Menggunakan Web Audio API — tanpa perlu file asset .mp3

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/** Cek apakah user mengaktifkan suara (default: false) */
export function isSoundEnabled(): boolean {
  return localStorage.getItem('smk_sound_enabled') === '1';
}

/** Toggle status suara */
export function toggleSound(enable: boolean) {
  localStorage.setItem('smk_sound_enabled', enable ? '1' : '0');
}

// Play simple tone
function playTone(freq: number, type: OscillatorType, duration: number, delay: number, volume: number) {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export function playSuccess() {
  if (!isSoundEnabled()) return;
  // Suara "ding" ceria: C5 -> E5 -> G5
  playTone(523.25, 'sine', 0.1, 0, 0.05);
  playTone(659.25, 'sine', 0.1, 0.05, 0.05);
  playTone(783.99, 'sine', 0.2, 0.1, 0.05);
}

export function playError() {
  if (!isSoundEnabled()) return;
  // Suara "buzz" rendah: A3 -> G3
  playTone(220.00, 'triangle', 0.15, 0, 0.05);
  playTone(196.00, 'triangle', 0.3, 0.1, 0.05);
}