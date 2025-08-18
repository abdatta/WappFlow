/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />

self.addEventListener("push", (event: any) => {
  if (!event.data) return;
  const { title, body, url } = event.data.json();
  const options: NotificationOptions = {
    body,
    data: { url },
    icon: undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        includeUncontrolled: true,
      });
      const existing = allClients.find((c) => c.url.includes(url));
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
