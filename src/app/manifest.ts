import type { MetadataRoute } from "next";

/** PWA (PRD 2, Nicht-Ziele: installierbar, mehr nicht). Wird als /manifest.webmanifest ausgeliefert. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Leihregal",
    short_name: "Leihregal",
    description: "Bücher aus Regalen in deiner Nähe leihen, tauschen und verschenken. Kostenlos unter Privatpersonen.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2ea",
    theme_color: "#f6f2ea",
    lang: "de-CH",
    dir: "ltr",
    categories: ["books", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Suche", short_name: "Suche", url: "/suche?fokus=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Buch erfassen", short_name: "Erfassen", url: "/regal/neu", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Vorgänge", short_name: "Vorgänge", url: "/vorgaenge", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
