"use client";
import { useEffect } from "react";
import { useClientLocale } from "@/lib/i18n/client-locale";
import { htmlLang } from "@/lib/i18n/locale";
import { COMMON } from "@/lib/i18n/messages/common";
import { RetryButton } from "./retry";

/** Text der Offline-Hülle; die Seite ist statisch, die Sprache kommt aus Cookie oder Browser */
export function OfflineText() {
  const l = useClientLocale();
  const t = COMMON[l].offline;
  // Die statische Seite trägt «de-CH»; Vorleseprogramme sollen die angezeigte Sprache kennen
  useEffect(() => { document.documentElement.lang = htmlLang[l]; }, [l]);
  return (
    <div className="stagger">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="display text-display mt-4">{t.heading[0]}<em>{t.heading[1]}</em></h1>
      <p className="text-ink-2 text-lead leading-relaxed mt-6 max-w-prose">{t.text}</p>
      <div className="mt-9"><RetryButton retry={t.retry} waiting={t.waiting} /></div>
    </div>
  );
}

/** Beschriftung des Regalmotivs, ebenfalls in der Sprache des Browsers */
export function OfflineMotif() {
  return <>{COMMON[useClientLocale()].offline.motif}</>;
}
