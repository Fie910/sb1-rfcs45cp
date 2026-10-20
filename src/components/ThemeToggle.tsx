import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'app-theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const isLight = theme === 'light';

  return (
    <button
      onClick={toggle}
      className="relative p-2.5 rounded-2xl border transition-all cursor-pointer group"
      style={{
        background: isLight
          ? 'rgba(240,233,214,0.6)'
          : 'rgba(15,23,42,0.6)',
        borderColor: isLight
          ? 'rgba(221,208,181,0.8)'
          : 'rgba(30,41,59,0.8)',
      }}
      title={isLight ? 'Beralih ke mode gelap' : 'Beralih ke mode terang hangat'}
      aria-label="Toggle theme"
    >
      {isLight ? (
        <Moon size={18} className="text-amber-700" />
      ) : (
        <Sun size={18} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
      )}
    </button>
  );
}
