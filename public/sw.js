// Service worker do Justio: só cuida das notificações no celular/computador.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Justio", {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      // Links externos (WhatsApp) abrem numa janela nova; os do Justio reaproveitam a aberta.
      if (/^https?:\/\//.test(url) && !url.startsWith(self.location.origin)) {
        await self.clients.openWindow(url);
        return;
      }
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const j of janelas) {
        if ("focus" in j) {
          await j.focus();
          if ("navigate" in j) await j.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
