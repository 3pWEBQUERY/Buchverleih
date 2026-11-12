"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/safe-next";

/** PWA: installierbar und mit Offline-Hülle (PRD 2, Nicht-Ziele: PWA, mehr nicht) */
export function RegisterSW() {
  const router = useRouter();
  // Tippen auf eine Push-Mitteilung bei offenem Fenster ohne navigate(): der Service Worker schickt das Ziel
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type?: string; href?: string } | null;
      if (data?.type !== "navigate") return;
      // Nur eigene Pfade (kein «//», kein Backslash, gleiche Origin)
      const href = safeNext(data.href);
      if (href) router.push(href);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
