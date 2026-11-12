import type { MetadataRoute } from "next";
import { getLocale } from "@/lib/i18n/server";
import { htmlLang } from "@/lib/i18n/locale";
import { COMMON } from "@/lib/i18n/messages/common";

/** PWA (PRD 2, Nicht-Ziele: installierbar, mehr nicht). Wird als /manifest.webmanifest ausgeliefert. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const l = await getLocale();
  const t = COMMON[l].manifest;
  return {
    id: "/",
    name: "Leihregal",
    short_name: "Leihregal",
    description: t.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#faf8f4",
    lang: htmlLang[l],
    dir: "ltr",
    categories: ["books", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: t.search[0], short_name: t.search[1], url: "/suche?fokus=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.add[0], short_name: t.add[1], url: "/regal/neu", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.loans[0], short_name: t.loans[1], url: "/vorgaenge", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
