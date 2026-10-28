// src/components/TimeOfDayHero.tsx
import { useMemo, useEffect } from 'react';
import { getTimePhase, PHASE_IMAGES, type TimePhase } from '@/constants/timeOfDay';

type TimeOfDayHeroProps = {
  /** Konten di kiri (teks) */
  children: React.ReactNode;
  /** Konten di kanan (tanggal/jam) */
  trailing?: React.ReactNode;
  /** Override phase (untuk testing) */
  forcePhase?: TimePhase;
};

/**
 * Hero card dengan background foto sesuai waktu.
 * - Teks di kiri (dengan gradient overlay gelap).
 * - Gambar terlihat jelas di kanan.
 */
export function TimeOfDayHero({
  children,
  trailing,
  forcePhase,
}: TimeOfDayHeroProps) {
  // 1️⃣ Deklarasi phase DULU
  const phase = useMemo(() => forcePhase ?? getTimePhase(), [forcePhase]);
  const bgImage = PHASE_IMAGES[phase];

  // 2️⃣ Baru useEffect memakai `phase`
  useEffect(() => {
    // Preload gambar fase berikutnya agar transisi mulus saat jam berubah
    const phases: TimePhase[] = ['dawn', 'morning', 'day', 'golden', 'evening', 'night'];
    const currentIdx = phases.indexOf(phase);
    const nextPhase = phases[(currentIdx + 1) % phases.length];

    const img = new Image();
    img.src = PHASE_IMAGES[nextPhase];
  }, [phase]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 shadow-lg">
      {/* Layer 1: Background image */}
      <div
  className="absolute inset-0 bg-contain bg-no-repeat bg-center"
  style={{
    backgroundImage: `url('${bgImage}')`,
    backgroundColor: '#0f172a', // warna gelap solid sbg isi area kosong
  }}
  aria-hidden="true"
/>

      {/* Layer 2: Dark gradient overlay — gelap di kiri, transparan di kanan */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/30 md:to-transparent"
        aria-hidden="true"
      />

      {/* Layer 3: Content */}
      <div className="relative px-4 py-3 md:py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Konten utama (kiri) */}
          <div className="min-w-0 flex-1">{children}</div>

          {/* Trailing (kanan) */}
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
      </div>
    </div>
  );
}