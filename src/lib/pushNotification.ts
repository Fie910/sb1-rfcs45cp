import { supabase } from '@/lib/supabase';

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      return registration;
    } catch (error) {
      console.warn(
        'Service Worker tidak dapat didaftarkan pada lingkungan ini (misal: StackBlitz/WebContainer):',
        error
      );
      return null;
    }
  } else {
    console.warn('Browser atau lingkungan ini tidak mendukung Service Worker.');
  }
  return null;
}

export async function requestNotificationPermission(guruId: string) {
  if (!('Notification' in window)) {
    alert('Browser tidak mendukung notifikasi push');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const registration = await registerServiceWorker();
    if (registration) {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Ganti dengan Public VAPID Key dari Supabase/Web Push Service kamu jika ada
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || ''
        ),
      });

      // Simpan push subscription ke tabel guru/user
      await supabase
        .from('gurus')
        .update({ push_subscription: subscription })
        .eq('id', guruId);

      return true;
    }
  }
  return false;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}