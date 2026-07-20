const DEFAULT_NOTIFICATION_URL = '/dashboard'

self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', function (event) {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function parsePushPayload(event) {
  if (!event.data) return {}

  try {
    return event.data.json()
  } catch {
    try {
      return JSON.parse(event.data.text())
    } catch {
      return {}
    }
  }
}

self.addEventListener('push', function (event) {
  event.waitUntil((async function () {
    const data = parsePushPayload(event)
    const title = data.title || 'ASCEND'
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-72x72.png',
      tag: data.tag || 'ascend-notification',
      renotify: Boolean(data.renotify),
      silent: false,
      timestamp: Date.now(),
      vibrate: [100, 50, 100],
      data: {
        url: data.url || DEFAULT_NOTIFICATION_URL,
      },
    }

    await self.registration.showNotification(title, options)
  })())
})

// Notification click handler
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = event.notification.data?.url || DEFAULT_NOTIFICATION_URL

  event.waitUntil((async function () {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })

    for (const client of windowClients) {
      const clientUrl = new URL(client.url)
      if (clientUrl.pathname === targetUrl && 'focus' in client) {
        return client.focus()
      }
    }

    return clients.openWindow(targetUrl)
  })())
})

// Offline fallback
self.addEventListener('fetch', function (event) {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline') || new Response('Offline', { status: 503 })
      })
    )
  }
})
