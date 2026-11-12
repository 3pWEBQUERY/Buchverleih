"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

/** Sprache für Client-Komponenten; der Server bestimmt sie (Cookie, sonst Browser) */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx);
