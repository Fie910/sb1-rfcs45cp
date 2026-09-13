// Service Worker — SMK KH. A. Wahab Muhsin Sukahideng
// Menangani push notification & klik notifikasi.
// (Fetch handler sengaja tidak dipasang — tidak ada strategi caching saat ini.)

// ==========================================
// 1. Event Listener Push (Menangkap Notifikasi Masuk)
// ==========================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Notifikasi', body: event.data.text() };
  }

  const options = {
    body: data.body || 'Ada pemberitahuan baru',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notifikasi Guru', options)
  );
});

// ==========================================
// 2. Event Listener Notification Click (Aksi Saat Klik Notifikasi)
// ==========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Kalau ada tab yang sudah buka aplikasi ini → fokus
        for (const client of windowClients) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Kalau tidak ada → buka tab baru
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});