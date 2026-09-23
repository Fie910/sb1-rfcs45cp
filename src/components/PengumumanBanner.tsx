// /src/components/PengumumanBanner.tsx
// Komponen carousel pengumuman resmi sekolah dengan dot indicator + swipe gesture.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ExternalLink,
  CalendarDays,
  Link2,
} from 'lucide-react';
import { Modal } from '@/components/Modal';

// =============================================================================
// KONFIGURASI
// =============================================================================
const AUTO_ROTATE_MS = 6000;      // Auto-rotate interval
const SWIPE_THRESHOLD_PX = 50;    // Minimal jarak swipe untuk ganti slide
const SWIPE_LOCK_PX = 10;         // Minimal jarak untuk "kunci" gesture horizontal

// =============================================================================
// HELPER — Ubah URL teks menjadi tautan aktif
// =============================================================================
const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all font-semibold transition-colors inline-flex items-center gap-1 mx-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink size={12} className="inline shrink-0" />
        </a>
      );
    }
    return part;
  });
};

// =============================================================================
// PROPS
// =============================================================================
interface PengumumanBannerProps {
  pengumumanList: any[];
}

// =============================================================================
// KOMPONEN
// =============================================================================
export function PengumumanBanner({ pengumumanList }: PengumumanBannerProps) {
  const [current, setCurrent] = useState(0);
  const [detail, setDetail] = useState<any | null>(null);

  // Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Ref untuk track gesture lock (horizontal vs vertical)
  const gestureLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  const totalSlides = pengumumanList.length;
  const hasMultiple = totalSlides > 1;

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================
  const goTo = useCallback(
    (idx: number) => {
      if (totalSlides === 0) return;
      const normalized = ((idx % totalSlides) + totalSlides) % totalSlides;
      setCurrent(normalized);
    },
    [totalSlides]
  );

  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);
  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);

  // ==========================================================================
  // AUTO-ROTATE — pause saat dragging
  // ==========================================================================
  useEffect(() => {
    if (!hasMultiple) return;
    if (isDragging) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % totalSlides);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [hasMultiple, totalSlides, isDragging, current]);

  // Reset current kalau list berubah & current out of bounds
  useEffect(() => {
    if (current >= totalSlides && totalSlides > 0) {
      setCurrent(0);
    }
  }, [totalSlides, current]);

  // ==========================================================================
  // KEYBOARD NAV (bonus accessibility)
  // ==========================================================================
  useEffect(() => {
    if (!hasMultiple) return;
    const handler = (e: KeyboardEvent) => {
      // Skip kalau user sedang mengetik di input
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasMultiple, goPrev, goNext]);

  // ==========================================================================
  // SWIPE HANDLERS
  // ==========================================================================
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultiple) return;
    const t = e.touches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
    gestureLockedRef.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !hasMultiple) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;

    // Kalau belum ada lock, tentukan arah gesture
    if (gestureLockedRef.current === null) {
      if (Math.abs(dx) > SWIPE_LOCK_PX || Math.abs(dy) > SWIPE_LOCK_PX) {
        gestureLockedRef.current =
          Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
    }

    // Kalau gesture vertical → biarkan user scroll halaman
    if (gestureLockedRef.current === 'vertical') return;

    // Kalau horizontal → track offset (kasih elastic resistance di edge)
    if (gestureLockedRef.current === 'horizontal') {
      const isFirstAtLeft = current === 0 && dx > 0;
      const isLastAtRight = current === totalSlides - 1 && dx < 0;
      const resistance = isFirstAtLeft || isLastAtRight ? 0.35 : 1;
      setTouchOffset(dx * resistance);
    }
  };

  const handleTouchEnd = () => {
    if (!hasMultiple) {
      setTouchStart(null);
      setIsDragging(false);
      return;
    }

    const offset = touchOffset;

    if (Math.abs(offset) > SWIPE_THRESHOLD_PX) {
      if (offset < 0) goNext();
      else goPrev();
    }

    setTouchOffset(0);
    setTouchStart(null);
    setIsDragging(false);
    gestureLockedRef.current = null;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <>
      <div className="relative group overflow-hidden rounded-3xl bg-slate-900 p-4 md:p-6 text-white shadow-xl border border-slate-800">
        {/* Dekorasi blur */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
              <Megaphone size={16} />
            </div>
            <div>
              <h2 className="font-extrabold text-xs tracking-wide text-slate-100 uppercase">
                PENGUMUMAN RESMI SEKOLAH
              </h2>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                {hasMultiple ? 'Geser atau klik titik untuk navigasi' : 'Klik banner untuk melihat rincian'}
              </p>
            </div>
          </div>

          {/* NAV ARROWS — desktop only (mobile pakai swipe) */}
          {hasMultiple && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={goPrev}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Sebelumnya (←)"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goNext}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Selanjutnya (→)"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* CAROUSEL BODY */}
        <div className="relative z-10 w-full">
          {totalSlides > 0 ? (
            <div
              className="relative overflow-hidden select-none"
              style={{
                // Izinkan scroll vertical halaman, handle horizontal oleh JS
                touchAction: 'pan-y',
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <div
                className="flex"
                style={{
                  transform: `translateX(calc(${-current * 100}% + ${touchOffset}px))`,
                  transition: isDragging
                    ? 'none'
                    : 'transform 400ms cubic-bezier(0.25, 0.8, 0.25, 1)',
                  willChange: 'transform',
                }}
              >
                {pengumumanList.map((p) => {
                  const imageUrl = p.gambar_url || p.image_url;
                  return (
                    <div
                      key={p.id}
                      className="w-full shrink-0"
                    >
                      <button
                        onClick={() => setDetail(p)}
                        className="w-full text-left group/item cursor-pointer overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 shadow-lg relative flex flex-col justify-end"
                      >
                        <div className="relative w-full aspect-video overflow-hidden bg-slate-950 flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={p.judul}
                              draggable={false}
                              className="w-full h-full object-contain transition-transform duration-500 group-hover/item:scale-[1.02]"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 text-slate-400 p-6 text-center">
                              <Megaphone size={48} className="mb-2 text-indigo-400/50" />
                              <p className="text-xs font-semibold text-slate-400">
                                Pengumuman Bergambar
                              </p>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

                          <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5 flex items-end justify-between gap-3 z-10">
                            <div className="flex-1 pr-2">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-1">
                                <Sparkles size={10} /> Informasi Resmi
                              </span>
                              <h3 className="font-extrabold text-sm sm:text-base md:text-xl text-slate-100 group-hover/item:text-indigo-300 transition-colors line-clamp-1 drop-shadow-md">
                                {p.judul}
                              </h3>
                            </div>
                            <span className="shrink-0 text-[11px] sm:text-xs font-bold px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center gap-1.5 transition-colors">
                              Lihat Detail <ArrowRight size={14} />
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-full py-10 flex flex-col items-center justify-center text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
              <Megaphone size={36} className="text-slate-600 mb-2" />
              <h3 className="font-bold text-sm text-slate-200">Tidak Ada Pengumuman Aktif</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Saat ini belum ada pengumuman baru yang diterbitkan.
              </p>
            </div>
          )}
        </div>

        {/* DOT INDICATORS */}
        {hasMultiple && (
          <div className="relative z-10 flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-slate-800/60">
            {pengumumanList.map((_, idx) => {
              const isActive = idx === current;
              return (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  aria-label={`Ke pengumuman ${idx + 1} dari ${totalSlides}`}
                  className={`rounded-full transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'w-6 h-1.5 bg-indigo-400 shadow-sm shadow-indigo-500/40'
                      : 'w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              );
            })}

            {/* Counter slide — small helper text */}
            <span className="ml-2 text-[10px] font-mono text-slate-500 tabular-nums">
              {current + 1}/{totalSlides}
            </span>
          </div>
        )}
      </div>

      {/* MODAL DETAIL */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.judul ?? ''}
        size="lg"
      >
        {detail && (
          <div className="space-y-4 pt-1">
            {(detail.gambar_url || detail.image_url) && (
              <div className="w-full max-h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-2">
                <img
                  src={detail.gambar_url || detail.image_url}
                  alt={detail.judul}
                  className="w-full h-full object-contain max-h-80 mx-auto rounded-xl"
                />
              </div>
            )}

            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 w-fit">
              <CalendarDays size={14} />
              <span>
                Berlaku: {new Date(detail.tanggal_mulai).toLocaleDateString('id-ID')} -{' '}
                {new Date(detail.tanggal_selesai).toLocaleDateString('id-ID')}
              </span>
            </div>

            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {renderTextWithLinks(detail.isi)}
            </div>

            {(detail.url || detail.link) && (
              <div className="pt-2">
                <a
                  href={detail.url || detail.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <Link2 size={16} /> Buka Tautan Terkait
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}