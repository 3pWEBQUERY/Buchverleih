"use client";
/** Web Push im Browser: Unterstützung prüfen und dieses Gerät anmelden (Einstellungen und Zustimmungs-Hinweis) */
import { api } from "@/lib/client";

export function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Service Worker abwarten; ohne (z. B. lokal in der Entwicklung) nach kurzer Zeit aufgeben */
export const swReady = () => Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Erlaubnis einholen und das Gerät anmelden. Liefert die Zahl der Geräte oder null, wenn abgelehnt. */
export async function enablePush(notReady: string): Promise<{ devices: number } | { denied: true } | null> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? { denied: true } : null;
  const { publicKey } = await api<{ publicKey: string }>("/push");
  const reg = await swReady();
  if (!reg) throw new Error(notReady);
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
  return api<{ devices: number }>("/push", { body: sub.toJSON() });
}
