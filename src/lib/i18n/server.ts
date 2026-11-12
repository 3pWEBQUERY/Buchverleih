import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, isLocale, type Locale } from "./locale";

/** Sprache der Anfrage: gewählte Sprache (Cookie), sonst Browser-Sprache, sonst Deutsch */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(c)) return c;
    return fromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
});
