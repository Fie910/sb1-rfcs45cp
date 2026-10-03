// src/components/dashboard/PengumumanCarousel.tsx
// Carousel pengumuman — swipe horizontal, 1 card per view.
// ✅ Auto-rotate 5 detik + unlimited items + pause on hover/touch.

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { PengumumanCard } from './PengumumanCard';

// =============================================================================
// KONFIGURASI
// =============================================================================
const AUTO_ROTATE_MS = 5000; // 5 detik
const GAP_PX = 12;

// =============================================================================
// TYPES
// =============================================================================
type Pengumuman = {
  id: number;
  judul: string;
  isi: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  gambar_url?: string | null;
  url?: string | null;
  prioritas?: string | null;
};

type Props = {
  items: Pengumuman[];
  onItemClick: (item: Pengumuman) => void;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function PengumumanCarousel({ items, onItemClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showPlayControl, setShowPlayControl] = useState(false);

  // ==========================================================================
  // SCROLL TO INDEX
  // ==========================================================================
  const scrollToIndex = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.offsetWidth + GAP_PX;
    el.scrollTo({ left: itemWidth * idx, behavior: 'smooth' });
  }, []);

  // ==========================================================================
  // TRACK ACTIVE INDEX DARI SCROLL POSITION
  // ==========================================================================
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const itemWidth = el.offsetWidth + GAP_PX;
      const idx = Math.round(scrollLeft / itemWidth);
      setActiveIndex(Math.min(Math.max(idx, 0), items.length - 1));
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [items.length]);

  // ==========================================================================
  // ✅ AUTO-ROTATE 5 DETIK
  // Reset otomatis setiap kali activeIndex berubah (manual / auto).
  // Berhenti saat user hover (desktop) atau sedang sentuh (mobile).
  // ==========================================================================
  useEffect(() => {
    if (items.length <= 1) return;
    if (isPaused) return;

    const timer = setTimeout(() => {
      const next = (activeIndex + 1) % items.length;
      scrollToIndex(next);
    }, AUTO_ROTATE_MS);

    return () => clearTimeout(timer);
  }, [activeIndex, items.length, isPaused, scrollToIndex]);

  // ==========================================================================
  // NAVIGASI MANUAL
  // ==========================================================================
  const handlePrev = () => {
    const prev = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    scrollToIndex(prev);
  };

  const handleNext = () => {
    const next = (activeIndex + 1) % items.length;
    scrollToIndex(next);
  };

  const handleDotClick = (idx: number) => {
    scrollToIndex(idx);
  };

  // ==========================================================================
  // PAUSE HANDLERS
  // ==========================================================================
  const pause = () => setIsPaused(true);
  const resume = () => setIsPaused(false);

  if (items.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={() => {
        // Resume setelah 3 detik user selesai sentuh
        setTimeout(resume, 3000);
      }}
      onFocus={pause}
      onBlur={resume}
    >
      {/* ARROW NAV — desktop only */}
      {items.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 items-center justify-center shadow-lg hover:bg-slate-700 transition cursor-pointer"
            aria-label="Sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 items-center justify-center shadow-lg hover:bg-slate-700 transition cursor-pointer"
            aria-label="Berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* SCROLL CONTAINER */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-1
          [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {items.map((item) => (
          <div key={item.id} className="snap-center shrink-0 w-full">
            <PengumumanCard item={item} onClick={() => onItemClick(item)} />
          </div>
        ))}
      </div>

      {/* CONTROL BAR — dot indicators + counter + pause toggle */}
      {items.length > 1 && (
        <div className="flex items-center justify-between gap-3 mt-3">
          {/* Kiri: Counter + Play/Pause toggle (desktop only) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPlayControl((v) => !v)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              title={isPaused ? 'Auto-rotate dijeda' : 'Auto-rotate aktif'}
              aria-label={isPaused ? 'Lanjutkan auto-rotate' : 'Jeda auto-rotate'}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
            </button>
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">
              {activeIndex + 1} / {items.length}
            </span>
          </div>

          {/* Tengah: Dots */}
          <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap">
            {items.length <= 15 ? (
              // Dot penuh — untuk ≤ 15 item
              items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleDotClick(i)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeIndex === i
                      ? 'w-6 bg-indigo-500'
                      : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                  }`}
                  aria-label={`Ke pengumuman ${i + 1}`}
                />
              ))
            ) : (
              // Dot ringkas — untuk > 15 item (dot aktif + total)
              <>
                <button
                  onClick={() => handleDotClick(0)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeIndex === 0 ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-700'
                  }`}
                  aria-label="Ke pengumuman pertama"
                />
                <span className="text-[10px] font-bold text-slate-500 px-1 tabular-nums">
                  {activeIndex + 1} / {items.length}
                </span>
                <button
                  onClick={() => handleDotClick(items.length - 1)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeIndex === items.length - 1
                      ? 'w-6 bg-indigo-500'
                      : 'w-1.5 bg-slate-700'
                  }`}
                  aria-label="Ke pengumuman terakhir"
                />
              </>
            )}
          </div>

          {/* Kanan: spacer untuk balance */}
          <div className="hidden md:block w-16 shrink-0" />
        </div>
      )}

      {/* PROGRESS INDICATOR — garis tipis yang berjalan saat auto-rotate */}
      {items.length > 1 && !isPaused && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-800/50 overflow-hidden rounded-t-2xl">
          <div
            key={activeIndex}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            style={{
              animation: `carouselProgress ${AUTO_ROTATE_MS}ms linear forwards`,
            }}
          />
        </div>
      )}

      {/* Inject keyframes (hanya sekali) */}
      <style>{`
        @keyframes carouselProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}