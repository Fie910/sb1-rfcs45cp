// Service Worker — SMK KH. A. Wahab Muhsin Sukahideng
// ✅ App Shell Cache + Push Notification Handler

const APP_SHELL_CACHE = 'smk-app-shell-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-72.png',
];

// ============================================================================
// INSTALL — Cache app shell
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        console.warn('[sw] sebagian aset app shell gagal di-cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ============================================================================
// ACTIVATE — Bersihkan cache lama
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('smk-') && key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ============================================================================
// FETCH — Strategy: network-first untuk API, cache-first untuk aset statis
// ============================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip Supabase & AI & eksternal — biar app yang handle
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    return;
  }

  // Navigasi HTML → network-first, fallback ke cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // Aset statis (JS/CSS/img) → cache-first
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.webp') ||
      url.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// ============================================================================
// PUSH NOTIFICATION
// ============================================================================
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
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notifikasi Guru', options)
  );
});

// ============================================================================
// NOTIFICATION CLICK
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});