"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { COMMON } from "@/lib/i18n/messages/common";

/** Fehler innerhalb der App: ruhig erklären, neu versuchen lassen, Kennung für Rückfragen zeigen */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = COMMON[useLocale()].error;
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="max-w-2xl py-6 md:py-10">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="display text-[32px] md:text-[44px] mt-3">{t.heading[0]}<em>{t.heading[1]}</em></h1>
      <p className="text-ink-2 text-[16px] leading-relaxed mt-4 max-w-prose">{t.text}</p>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button type="button" onClick={reset} className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium hover:bg-accent-hover transition-colors">{t.retry}</button>
        <Link href="/" className="h-11 px-5 rounded-[6px] bg-accent-soft text-accent-hover font-medium inline-flex items-center hover:bg-accent hover:text-accent-ink transition-colors">{t.home}</Link>
      </div>
      {error.digest && <p className="mt-6 text-[13px] text-muted tnum">{t.id}{error.digest}</p>}
    </div>
  );
}
