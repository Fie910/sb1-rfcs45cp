// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  
  // Ref untuk melacak urutan tombol (misal: ['g', 'd'])
  const keysPressed = useRef<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ❌ Abaikan jika user sedang mengetik di form
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // 1. Toggle Cheat Sheet dengan '?'
      if (e.key === '?') {
        setCheatSheetOpen((prev) => !prev);
        return;
      }

      // 2. Tutup Cheat Sheet dengan 'Escape'
      if (e.key === 'Escape') {
        setCheatSheetOpen(false);
      }

      // 3. Deteksi Sequence (G + Tombol)
      const key = e.key.toLowerCase();
      
      // Abaikan modifier keys (ctrl, alt, shift)
      if (['control', 'alt', 'shift', 'meta'].includes(key)) return;

      keysPressed.current.push(key);

      // Reset urutan setelah 1 detik tidak ada tombol lanjutan
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        keysPressed.current = [];
      }, 1000);

      const sequence = keysPressed.current.join(' ');

      // Map Sequence ke Route
      const shortcuts: Record<string, string> = {
        'g d': '/',
        'g a': '/agenda',
        'g i': '/izin',
        'g p': '/piket',
        'g r': '/rapat',
        'g t': '/todo',
        'g k': '/kalender_akademik',
        'g s': '/surat',
      };

      if (shortcuts[sequence]) {
        navigate(shortcuts[sequence]);
        keysPressed.current = []; // Reset
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [navigate]);

  return { cheatSheetOpen, setCheatSheetOpen };
}