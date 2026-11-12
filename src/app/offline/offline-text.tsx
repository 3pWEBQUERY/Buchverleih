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
    <>
      <p className="eyebrow anim-rise">{t.eyebrow}</p>
      <h1 className="display text-[32px] md:text-[44px] mt-4 anim-rise" style={{ animationDelay: "40ms" }}>{t.heading[0]}<em>{t.heading[1]}</em></h1>
      <p className="text-ink-2 text-[17px] md:text-[19px] leading-relaxed mt-6 max-w-prose anim-rise" style={{ animationDelay: "80ms" }}>{t.text}</p>
      <div className="mt-9 anim-rise" style={{ animationDelay: "120ms" }}><RetryButton retry={t.retry} waiting={t.waiting} /></div>
    </>
  );
}

/** Beschriftung des Regalmotivs, ebenfalls in der Sprache des Browsers */
export function OfflineMotif() {
  return <>{COMMON[useClientLocale()].offline.motif}</>;
}
