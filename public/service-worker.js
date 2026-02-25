// Service Worker for Garage Management System PWA
// AUTO-UPDATE SYSTEM - v79 (fix calendar active effect)
const CACHE_VERSION = 79;
const CACHE_NAME = `garage-system-v${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-48.png',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-152.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/account.html',
  '/privacy.html',
  '/terms.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/cars.js',
  '/js/search.js',
  '/js/calendar.js',
  '/js/dashboard.js',
  '/js/spare-parts.js',
  '/js/backup.js',
  '/js/ui.js',
  '/js/notifications.js',
  '/js/reminders.js',
  '/js/onboarding.js'
];

// External resources to cache
const externalResources = [
  'https://cdn.tailwindcss.com/3.4.1',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache resources and activate immediately
self.addEventListener('install', event => {
  console.log(`[SW] Installing v${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache local files first
        const localCaching = cache.addAll(urlsToCache).catch(err => {
          console.error('[SW] Local cache failed:', err);
          // Try caching files individually
          return Promise.all(
            urlsToCache.map(url =>
              cache.add(url).catch(e => console.log(`[SW] Failed to cache ${url}:`, e))
            )
          );
        });

        // Cache external resources (don't fail if these don't work)
        const externalCaching = Promise.all(
          externalResources.map(url =>
            fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(() => console.log(`[SW] External resource not cached: ${url}`))
          )
        );

        return Promise.all([localCaching, externalCaching]);
      })
      .then(() => {
        console.log('[SW] Skip waiting - activating immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches and take control
self.addEventListener('activate', event => {
  console.log(`[SW] Activating v${CACHE_VERSION}...`);
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activated - notifying clients');
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// Fetch event - Smart caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle Firebase/API requests - network only, no cache
  if (url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('firebasestorage.googleapis.com') ||
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('onesignal.com') ||
      url.hostname.includes('paypal.com')) {
    return;
  }

  // For same-origin requests
  if (url.origin === self.location.origin) {
    // HTML files - NETWORK FIRST with offline fallback
    if (event.request.destination === 'document' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        url.pathname === '') {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            // Cache the new version
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return response;
          })
          .catch(async () => {
            // Offline - try cache first
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache, show offline page
            const offlinePage = await caches.match(OFFLINE_PAGE);
            if (offlinePage) {
              return offlinePage;
            }
            // Ultimate fallback
            return new Response(generateOfflineHTML(), {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          })
      );
      return;
    }

    // Images - Cache first with network fallback
    if (event.request.destination === 'image') {
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              // Update cache in background
              fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse);
                  });
                }
              }).catch(() => {});
              return cachedResponse;
            }

            return fetch(event.request).then(response => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
              return response;
            }).catch(() => {
              // Return placeholder for images
              return new Response(generatePlaceholderSVG(), {
                headers: { 'Content-Type': 'image/svg+xml' }
              });
            });
          })
      );
      return;
    }

    // Other static files - Cache first
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // Update in background
            fetch(event.request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse);
                });
              }
            }).catch(() => {});
            return response;
          }

          return fetch(event.request).then(response => {
            if (!response || response.status !== 200) {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return response;
          });
        })
        .catch(() => {
          return new Response('', { status: 503 });
        })
    );
    return;
  }

  // External resources (CDN, etc.) - Cache first with network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(response => {
          // Cache successful responses
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // For CSS files, return empty stylesheet
        if (event.request.destination === 'style') {
          return new Response('/* Offline */', {
            headers: { 'Content-Type': 'text/css' }
          });
        }
        // For JS files, return empty script
        if (event.request.destination === 'script') {
          return new Response('// Offline', {
            headers: { 'Content-Type': 'application/javascript' }
          });
        }
        return new Response('', { status: 503 });
      })
  );
});

// Generate inline offline HTML as fallback
function generateOfflineHTML() {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>אין חיבור - DRVN</title>
  <style>
    body { font-family: sans-serif; background: linear-gradient(135deg, #0d9488, #115e59); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; color: #fff; text-align: center; padding: 20px; }
    .container { max-width: 300px; }
    h1 { font-size: 24px; margin-bottom: 15px; }
    p { opacity: 0.9; margin-bottom: 25px; }
    button { background: #fff; color: #0d9488; border: none; padding: 12px 30px; font-size: 16px; border-radius: 25px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h1>אין חיבור לאינטרנט</h1>
    <p>בדוק את החיבור שלך ונסה שוב</p>
    <button onclick="location.reload()">נסה שוב</button>
  </div>
</body>
</html>`;
}

// Generate placeholder SVG for images
function generatePlaceholderSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect fill="#e5e7eb" width="200" height="200"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="14">אין חיבור</text>
  </svg>`;
}

// Listen for messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }

  // Clear all caches on demand
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }

  // Get cache status
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        event.ports[0].postMessage({
          version: CACHE_VERSION,
          cachedFiles: keys.length,
          cacheName: CACHE_NAME
        });
      });
    });
  }
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when back online
async function syncOfflineData() {
  // This will be triggered when the app comes back online
  // The app can store pending actions in IndexedDB and sync them here
  console.log('[SW] Syncing offline data...');

  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE'
    });
  });
}

// Push notification handler
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'עדכון חדש זמין',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    dir: 'rtl',
    lang: 'he',
    tag: 'garage-notification',
    renotify: true
  };
  event.waitUntil(
    self.registration.showNotification('DRVN - מערכת ניהול מוסך', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if app is already open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not
      return clients.openWindow('/');
    })
  );
});

console.log(`[SW] Service Worker v${CACHE_VERSION} loaded`);
