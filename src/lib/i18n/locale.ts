/**
 * Sprachen der Oberfläche. Deutsch ist die Ausgangssprache; Französisch und Italienisch
 * folgen derselben Struktur. Rechtstexte bleiben verbindlich auf Deutsch.
 */
export const LOCALES = ["de", "fr", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "lr_lang";

export const htmlLang: Record<Locale, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH" };
export const localeName: Record<Locale, string> = { de: "Deutsch", fr: "Français", it: "Italiano" };

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

/** Erste unterstützte Sprache aus Accept-Language («fr-CH,fr;q=0.9,de;q=0.8») */
export function fromAcceptLanguage(h: string | null | undefined): Locale {
  if (!h) return DEFAULT_LOCALE;
  const langs = h.split(",")
    .map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.map((x) => x.trim()).find((x) => x.startsWith("q="));
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of langs) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

/** Wählt den Eintrag zur Sprache, fällt auf Deutsch zurück */
export function pick<T>(l: Locale, m: Record<Locale, T>): T {
  return m[l] ?? m.de;
}
