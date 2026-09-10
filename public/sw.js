// ==========================================
// 1. Event Listener Fetch (Bawaan Aplikasi Kamu)
// ==========================================
self.addEventListener('fetch', (event) => {
  // Tambahkan logika caching atau fetch handler kamu di sini
});

// ==========================================
// 2. Event Listener Push (Menangkap Notifikasi Masuk)
// ==========================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
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
// 3. Event Listener Notification Click (Aksi Saat Klik Notifikasi)
// ==========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});