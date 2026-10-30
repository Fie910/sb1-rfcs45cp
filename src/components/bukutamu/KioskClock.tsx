// src/components/bukutamu/KioskClock.tsx
import { useEffect, useState } from 'react';

export function KioskClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ambil jam WIB dengan presisi
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(time);

  const hours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const seconds = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0');

  // Sudut jarum (dalam derajat)
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  // Helper: titik ujung jarum berdasarkan sudut & panjang
  const handPoint = (deg: number, length: number) => ({
    x: 50 + Math.cos(((deg - 90) * Math.PI) / 180) * length,
    y: 50 + Math.sin(((deg - 90) * Math.PI) / 180) * length,
  });

  const hourEnd = handPoint(hourDeg, 24);
  const minuteEnd = handPoint(minuteDeg, 34);
  const secondStart = handPoint(secondDeg, -8); // counterweight
  const secondEnd = handPoint(secondDeg, 40);

  // Digital
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  const dateStr = time.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col items-center sm:items-end gap-2.5">
      {/* Analog Clock */}
      <div className="relative">
        {/* Ambient glow di belakang jam */}
        <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full scale-75 pointer-events-none" />

        <svg
          viewBox="0 0 100 100"
          className="relative w-28 h-28 sm:w-32 sm:h-32 drop-shadow-2xl"
        >
          <defs>
            {/* Gradient face */}
            <radialGradient id="clockFace" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0a0e1a" />
            </radialGradient>
            {/* Gradient ring */}
            <linearGradient id="clockRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>

          {/* Face */}
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="url(#clockFace)"
            stroke="url(#clockRing)"
            strokeWidth="2.5"
          />

          {/* Inner accent ring */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#334155"
            strokeWidth="0.5"
          />

          {/* Hour markers */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = i * 30;
            const isMajor = i % 3 === 0;
            const outer = handPoint(angle, isMajor ? 41 : 42);
            const inner = handPoint(angle, isMajor ? 33 : 38);

            return (
              <line
                key={i}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={isMajor ? '#c7d2fe' : '#475569'}
                strokeWidth={isMajor ? 2.5 : 1}
                strokeLinecap="round"
              />
            );
          })}

          {/* Hour hand */}
          <line
            x1="50"
            y1="50"
            x2={hourEnd.x}
            y2={hourEnd.y}
            stroke="#e2e8f0"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Minute hand */}
          <line
            x1="50"
            y1="50"
            x2={minuteEnd.x}
            y2={minuteEnd.y}
            stroke="#e2e8f0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Second hand (dengan counterweight) */}
          <line
            x1={secondStart.x}
            y1={secondStart.y}
            x2={secondEnd.x}
            y2={secondEnd.y}
            stroke="#f43f5e"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Center hub */}
          <circle cx="50" cy="50" r="3.5" fill="#f43f5e" />
          <circle cx="50" cy="50" r="1.5" fill="#0a0e1a" />
        </svg>
      </div>

      {/* Digital time + date */}
      <div className="text-center sm:text-right">
        <p className="text-2xl sm:text-3xl font-black text-white tabular-nums leading-none">
          {hh}:{mm}
          <span className="text-base sm:text-lg text-indigo-400 ml-0.5 font-bold">
            :{ss}
          </span>
        </p>
        <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 font-semibold">
          {dateStr}
        </p>
      </div>
    </div>
  );
}