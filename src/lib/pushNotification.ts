//src/lib/pushNotification.ts
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
  if (permission !== 'granted') return false;

  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  if (!publicKey) {
    console.error(
      'VITE_WEB_PUSH_PUBLIC_KEY belum diisi di .env — subscription tidak bisa dibuat.'
    );
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    console.warn('Service Worker gagal register — push tidak bisa dibuat.');
    return false;
  }

  // Unsubscribe subscription lama (kalau ada) untuk menghindari duplikat endpoint
  const existingSub = await registration.pushManager.getSubscription();
  if (existingSub) {
    await existingSub.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const subJson = subscription.toJSON();
  const keys = subJson.keys;

  if (!subJson.endpoint || !keys?.p256dh || !keys?.auth) {
    console.error('Subscription tidak lengkap:', subJson);
    return false;
  }

  // Simpan ke tabel push_subscriptions (bukan gurus)
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      guru_id: guruId,
      endpoint: subJson.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('Gagal menyimpan push subscription:', error.message);
    return false;
  }

  return true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}