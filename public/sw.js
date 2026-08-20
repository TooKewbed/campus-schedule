/*
 * Skedge's service worker.
 *
 * Two jobs, and deliberately not a third.
 *
 * 1. Offline. The app is local-first already — the schedule lives in
 *    localStorage and is only mirrored to an account — so the one thing
 *    standing between it and working on a train was fetching the shell.
 *
 * 2. Showing notifications. `new Notification()` throws outright on Android
 *    Chrome, which is where a student actually is when a deadline matters, so
 *    reminders now go through the registration instead.
 *
 * What it does NOT do is wake up on its own to remind you. A service worker
 * only runs when something wakes it, and nothing here can schedule that: real
 * push needs a server holding a subscription and sending at the right moment.
 * Rather than pretend otherwise with Periodic Background Sync — Chromium-only,
 * fires at the browser's discretion, and would need a second copy of every task
 * in IndexedDB for the worker to read — the app says plainly that reminders
 * arrive while it is open.
 */

const VERSION = 'skedge-v1';
const SHELL = '/';

/**
 * The cache, or null where there isn't one.
 *
 * CacheStorage is not always available even when service workers are: private
 * browsing modes withhold it, storage pressure can fail it, and it errors
 * outright in some headless environments. Anything that rejects inside
 * `install` kills the worker — which would take notifications down with it,
 * even though those need no cache at all. So every use of the cache is
 * optional, and losing it costs offline support and nothing else.
 */
async function openCache() {
  try {
    return await caches.open(VERSION);
  } catch {
    return null;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await openCache();
      if (cache) {
        // Only the shell and the icons. The hashed asset filenames change every
        // build and are picked up by the fetch handler on first use instead.
        await cache
          .addAll([SHELL, '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'])
          .catch(() => {
            // A missing icon must not stop the worker installing.
          });
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
      } catch {
        // Nothing to tidy, or no storage to tidy it in.
      }
      await self.clients.claim();
    })(),
  );
});

/** Cache lookup that treats an unavailable cache as a miss. */
async function cacheMatch(request) {
  try {
    return await caches.match(request);
  } catch {
    return undefined;
  }
}

async function cachePut(request, response) {
  const cache = await openCache();
  if (!cache) return;
  try {
    await cache.put(request, response);
  } catch {
    // Quota, or a response that cannot be stored. Not worth failing over.
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same-origin only. Supabase calls must always go to the network — a cached
  // schedule from another device would be worse than an error.
  if (url.origin !== self.location.origin) return;

  // The page itself: fresh when we can reach the server, cached when we cannot.
  // Network-first matters because a stale shell would point at asset names that
  // no longer exist after a deploy.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          await cachePut(SHELL, fresh.clone());
          return fresh;
        } catch {
          return (await cacheMatch(SHELL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Build output is content-hashed, so a hit can never be stale: a changed file
  // is a different URL.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const hit = await cacheMatch(request);
        if (hit) return hit;

        const fresh = await fetch(request);
        if (fresh.ok) await cachePut(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Icons and the manifest: serve what we have, refresh in the background.
  event.respondWith(
    (async () => {
      const hit = await cacheMatch(request);
      if (hit) {
        void fetch(request)
          .then((fresh) => (fresh.ok ? cachePut(request, fresh.clone()) : undefined))
          .catch(() => {});
        return hit;
      }

      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cachePut(request, fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })(),
  );
});

/**
 * Reminders are handed over from the page, which is what knows the deadlines.
 * The worker only draws them, so nothing here needs a copy of the schedule.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'notify') return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/favicon-48.png',
      data: { url: '/' },
    }),
  );
});

/** Tapping one should land in the app, reusing a tab if there is one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.startsWith(self.location.origin)) return client.focus();
      }
      return self.clients.openWindow('/');
    })(),
  );
});
