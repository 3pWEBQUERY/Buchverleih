/*
 * Leihregal Service Worker (PRD 2: installierbare PWA, mehr nicht).
 * - Seitenaufrufe: immer Netz, ohne Netz die Offline-Hülle. Seiten mit persönlichen
 *   Daten werden nie gespeichert (geteilte Geräte, veraltete Fristen).
 * - /_next/static/*: unveränderliche Dateien mit Hash im Namen, deshalb zuerst Cache.
 * - /api/*: nie aus dem Cache. Daten sind immer live.
 * Neue Version: VERSION erhöhen, alte Caches werden beim Aktivieren gelöscht.
 */
const VERSION = "v1";
const STATIC = `leihregal-static-${VERSION}`;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    const res = await fetch(OFFLINE, { cache: "reload" });
    if (res.ok) {
      // Offline-Hülle samt Stylesheets und Skripten vorhalten
      const html = await res.clone().text();
      await cache.put(OFFLINE, res);
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
      await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));
    }
    await cache.addAll(["/icons/icon-192.png", "/icons/icon.svg"]).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // nie cachen

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        return (await caches.match(OFFLINE)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(STATIC).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    })());
  }
});
