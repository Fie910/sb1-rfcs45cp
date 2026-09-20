// src/hooks/useInstallPrompt.ts
// Hook untuk mendeteksi & mengelola PWA install prompt.
//
// Menyediakan:
//   - canPrompt      : browser support beforeinstallprompt (Android/Chrome/Edge)
//   - isIOS          : iOS Safari (butuh instruksi manual)
//   - isStandalone   : aplikasi sudah terinstall (dibuka sebagai app)
//   - isDismissed    : user sudah pernah dismiss, belum 7 hari
//   - promptInstall  : trigger install dialog (Android/Chrome/Edge)
//   - dismiss        : user dismiss, sembunyikan 7 hari

import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. Deteksi apakah sudah standalone (terinstall)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // 2. Deteksi iOS (termasuk iPad dengan iPadOS 13+ yang menyamar sebagai Mac)
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    // 3. Cek apakah user pernah dismiss belum 7 hari
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysAgo =
        (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24);
      setIsDismissed(daysAgo < DISMISS_DAYS);
    }

    // 4. Listen beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. Listen appinstalled (kalau user install via browser menu)
    const handleInstalled = () => {
      setDeferredEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleInstalled);

    setIsReady(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredEvent) return null;
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return choice.outcome;
  }, [deferredEvent]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setIsDismissed(true);
  }, []);

  return {
    canPrompt: !!deferredEvent,
    isIOS,
    isStandalone,
    isDismissed,
    isReady,
    promptInstall,
    dismiss,
  };
}