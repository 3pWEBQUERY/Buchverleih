"use client";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, isLocale, type Locale } from "./locale";

/**
 * Sprache ohne Server (Offline-Hülle, globaler Fehler): gewähltes Cookie, sonst Browsersprache.
 * Zuerst Deutsch wie beim statischen Rendern, nach dem Laden die passende Sprache.
 */
export function useClientLocale(): Locale {
  const [l, setL] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    const c = document.cookie.split("; ").find((x) => x.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
    setL(isLocale(c) ? c : fromAcceptLanguage(navigator.languages?.join(",") || navigator.language));
  }, []);
  return l;
}
