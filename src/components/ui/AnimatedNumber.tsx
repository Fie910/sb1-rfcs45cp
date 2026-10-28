// src/components/ui/AnimatedNumber.tsx
import { useEffect, useState } from 'react';

export function AnimatedNumber({ 
  value, 
  duration = 1000, 
  decimals = 0 
}: { 
  value: number; 
  duration?: number; 
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = display;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Ease-out cubic untuk efek melambat di akhir
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;
      
      setDisplay(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}