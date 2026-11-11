"use client";
import { useEffect } from "react";

/** PWA: installierbar und mit Offline-Hülle (PRD 2, Nicht-Ziele: PWA, mehr nicht) */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
