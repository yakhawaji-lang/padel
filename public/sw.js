/* Playtix — Web Push (scope /app/) — يُنسخ إلى dist/sw.js ويُطلب كـ /app/sw.js */
self.addEventListener('push', (event) => {
  let data = { title: 'Playtix', body: '', tag: 'playtix', url: '/app/' }
  try {
    const t = event.data && typeof event.data.text === 'function' ? event.data.text() : ''
    if (t) Object.assign(data, JSON.parse(t))
  } catch (_) {}

  const path = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/app/'
  event.waitUntil(
    self.registration.showNotification(data.title || 'Playtix', {
      body: data.body || '',
      tag: data.tag || 'playtix-push',
      data: { url: path },
      silent: false,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path =
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/app/'
  const fullUrl = new URL(path, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if (c.url && 'focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})
