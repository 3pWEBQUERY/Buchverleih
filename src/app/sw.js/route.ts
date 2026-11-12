import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Service Worker unter /sw.js. Die Version wechselt mit jedem Deploy, damit installierte Apps
 * neue Offline-Hülle, Icons und Dateien bekommen (vorher fest «v1»).
 */
export const dynamic = "force-dynamic";

function version() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 12);
  try {
    return readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "dev";
  }
}

// Quelltext als JSON-String, damit Regex-Backslashes unverändert bleiben
const SOURCE: string = "/*\n * Leihregal Service Worker (PRD 2: installierbare PWA, mehr nicht).\n * - Seitenaufrufe: immer Netz, ohne Netz die Offline-Hülle. Seiten mit persönlichen\n *   Daten werden nie gespeichert (geteilte Geräte, veraltete Fristen).\n * - /_next/static/*: unveränderliche Dateien mit Hash im Namen, deshalb zuerst Cache.\n * - /api/*: nie aus dem Cache. Daten sind immer live.\n * Die Version setzt der Server pro Deploy (Commit bzw. Build-ID), alte Caches werden beim Aktivieren gelöscht.\n */\nconst VERSION = \"__VERSION__\";\nconst STATIC = `leihregal-static-${VERSION}`;\nconst OFFLINE = \"/offline\";\n\nself.addEventListener(\"install\", (event) => {\n  event.waitUntil((async () => {\n    const cache = await caches.open(STATIC);\n    const res = await fetch(OFFLINE, { cache: \"reload\" });\n    if (res.ok) {\n      // Offline-Hülle samt Stylesheets und Skripten vorhalten\n      const html = await res.clone().text();\n      await cache.put(OFFLINE, res);\n      const assets = [...new Set(html.match(/\\/_next\\/static\\/[^\"'\\s)]+/g) || [])];\n      await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));\n    }\n    await cache.addAll([\"/icons/icon-192.png\", \"/icons/icon.svg\"]).catch(() => {});\n    await self.skipWaiting();\n  })());\n});\n\nself.addEventListener(\"activate\", (event) => {\n  event.waitUntil((async () => {\n    const keep = new Set([STATIC]);\n    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);\n    await self.clients.claim();\n  })());\n});\n\nself.addEventListener(\"fetch\", (event) => {\n  const req = event.request;\n  if (req.method !== \"GET\") return;\n  const url = new URL(req.url);\n  if (url.origin !== self.location.origin) return;\n  if (url.pathname.startsWith(\"/api/\")) return; // nie cachen\n\n  if (req.mode === \"navigate\") {\n    event.respondWith((async () => {\n      try {\n        return await fetch(req);\n      } catch {\n        return (await caches.match(OFFLINE)) || Response.error();\n      }\n    })());\n    return;\n  }\n\n  // Icons und Logos: aus dem Cache sofort, im Hintergrund aktualisieren (neues Logo kommt beim nächsten Aufruf)\n  if (url.pathname.startsWith(\"/icons/\") || url.pathname.startsWith(\"/brand/\")) {\n    event.respondWith((async () => {\n      const cache = await caches.open(STATIC);\n      const hit = await cache.match(req);\n      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);\n      return hit || fresh;\n    })());\n    return;\n  }\n\n  if (url.pathname.startsWith(\"/_next/static/\")) {\n    event.respondWith((async () => {\n      const hit = await caches.match(req);\n      if (hit) return hit;\n      const res = await fetch(req);\n      if (res.ok) {\n        const copy = res.clone();\n        caches.open(STATIC).then((c) => c.put(req, copy)).catch(() => {});\n      }\n      return res;\n    })());\n  }\n});\n";

export function GET() {
  return new Response(SOURCE.replace("__VERSION__", version()), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
}
