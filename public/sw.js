self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'Notification', body: 'You have a new message.' };
  
  const options = {
    body: data.body,
    icon: '/icon.png', // Make sure this exists or use a generic one
    badge: '/badge.png',
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
