// src/components/dashboard/PengumumanCarousel.tsx
// Carousel pengumuman — swipe horizontal, 1 card per view.

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PengumumanCard } from './PengumumanCard';

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

  // ==========================================================================
  // TRACK ACTIVE INDEX (dari scroll position)
  // ==========================================================================
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const itemWidth = el.offsetWidth + 12; // +gap
      const idx = Math.round(scrollLeft / itemWidth);
      setActiveIndex(Math.min(idx, items.length - 1));
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [items.length]);

  // ==========================================================================
  // SCROLL TO INDEX
  // ==========================================================================
  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.offsetWidth + 12;
    el.scrollTo({ left: itemWidth * idx, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (activeIndex > 0) scrollToIndex(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < items.length - 1) scrollToIndex(activeIndex + 1);
  };

  if (items.length === 0) return null;

  return (
    <div className="relative">
      {/* ARROW NAV — desktop only */}
      {items.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 items-center justify-center shadow-lg hover:bg-slate-700 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            disabled={activeIndex === items.length - 1}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 items-center justify-center shadow-lg hover:bg-slate-700 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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
          <div
            key={item.id}
            className="snap-center shrink-0 w-full"
          >
            <PengumumanCard
              item={item}
              onClick={() => onItemClick(item)}
            />
          </div>
        ))}
      </div>

      {/* DOT INDICATORS */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeIndex === i
                  ? 'w-6 bg-indigo-500'
                  : 'w-1.5 bg-slate-700 hover:bg-slate-600'
              }`}
              aria-label={`Ke pengumuman ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* COUNTER (kecil, di kanan atas) */}
      {items.length > 1 && (
        <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur border border-slate-800">
          {activeIndex + 1} / {items.length}
        </div>
      )}
    </div>
  );
}