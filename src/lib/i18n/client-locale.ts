"use client";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, isLocale, type Locale } from "./locale";

/**
 * Sprache ohne Server (Offline-Hülle, globaler Fehler): gewähltes Cookie, sonst Browsersprache.
 * Zuerst Deutsch wie beim statischen Rendern, nach dem Laden die passende Sprache.
 */
export function useClientLocale(): Locale {
  const [l, setL] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => setL(clientLocale()), []);
  return l;
}

/** Sprache synchron im Browser bestimmen (auch ausserhalb von React, z. B. in lib/client.ts). Auf dem Server: Deutsch. */
export function clientLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  // Die Seite trägt die vom Server gewählte Sprache in <html lang>
  const html = document.documentElement.lang?.slice(0, 2);
  if (isLocale(html)) return html;
  const c = document.cookie.split("; ").find((x) => x.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
  return isLocale(c) ? c : fromAcceptLanguage(navigator.languages?.join(",") || navigator.language);
}
