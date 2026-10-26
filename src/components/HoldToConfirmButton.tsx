// src/components/HoldToConfirmButton.tsx
import { useState, useRef, useEffect } from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';

type Props = {
  onConfirm: () => void;
  label?: string;
  holdDuration?: number; // ms
  className?: string;
};

export function HoldToConfirmButton({
  onConfirm,
  label = 'Tahan untuk Hapus',
  holdDuration = 1500,
  className = '',
}: Props) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startHold = () => {
    if (isSuccess) return;
    setIsHolding(true);
    startTimeRef.current = Date.now();

    const updateProgress = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / holdDuration) * 100);
      
      setProgress(pct);

      if (pct >= 100) {
        setIsSuccess(true);
        setIsHolding(false);
        if (timerRef.current) cancelAnimationFrame(timerRef.current);
        onConfirm();
      } else {
        timerRef.current = requestAnimationFrame(updateProgress);
      }
    };

    timerRef.current = requestAnimationFrame(updateProgress);
  };

  const cancelHold = () => {
    if (isSuccess) return;
    setIsHolding(false);
    setProgress(0);
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    startTimeRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      className={`relative overflow-hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all select-none cursor-pointer ${
        isSuccess
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
          : isHolding
          ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
      } ${className}`}
    >
      {/* Progress Background */}
      <div
        className="absolute inset-y-0 left-0 bg-rose-500/30 transition-none"
        style={{ width: `${progress}%` }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {isSuccess ? <CheckCircle2 size={16} /> : <Trash2 size={16} />}
        {isSuccess ? 'Terhapus!' : isHolding ? 'Tahan...' : label}
      </span>
    </button>
  );
}