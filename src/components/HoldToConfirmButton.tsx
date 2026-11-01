// src/components/HoldToConfirmButton.tsx
import { useState, useRef, useEffect } from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';

type Props = {
  onConfirm: () => void;
  label?: string;
  holdDuration?: number;
  className?: string;
  disabled?: boolean;
};

export function HoldToConfirmButton({
  onConfirm,
  label = 'Tahan untuk Hapus',
  holdDuration = 1500,
  className = '',
  disabled = false,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const cancelRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startHold = (e: React.PointerEvent) => {
    if (isSuccess || disabled) return;
    e.preventDefault();
    setIsHolding(true);
    startTimeRef.current = Date.now();
    haptic('light');

    const tick = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / holdDuration) * 100);
      setProgress(pct);

      if (pct >= 100) {
        setIsSuccess(true);
        setIsHolding(false);
        cancelRaf();
        haptic('error');
        setTimeout(() => onConfirm(), 300);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    if (isSuccess) return;
    setIsHolding(false);
    setProgress(0);
    cancelRaf();
    startTimeRef.current = null;
  };

  useEffect(() => {
    return () => cancelRaf();
  }, []);

  return (
    <button
      type="button"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      disabled={disabled}
      className={`relative overflow-hidden flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border font-bold text-xs transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed touch-none ${
        isSuccess
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
          : isHolding
          ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
      } ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-rose-500/30 pointer-events-none"
        style={{
          width: `${progress}%`,
          transition: isHolding ? 'none' : 'width 0.2s ease-out',
        }}
      />
      <span className="relative z-10 flex items-center gap-2 pointer-events-none">
        {isSuccess ? <CheckCircle2 size={16} /> : <Trash2 size={16} />}
        {isSuccess ? 'Terhapus!' : isHolding ? 'Tahan...' : label}
      </span>
    </button>
  );
}