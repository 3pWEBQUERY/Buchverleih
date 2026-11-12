"use client";
import { useEffect } from "react";
import Link from "next/link";

/** Fehler innerhalb der App: ruhig erklären, neu versuchen lassen, Kennung für Rückfragen zeigen */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="max-w-2xl py-6 md:py-10">
      <p className="eyebrow">Etwas ist schiefgelaufen</p>
      <h1 className="display text-[32px] md:text-[44px] mt-3">Die Seite konnte <em>nicht laden.</em></h1>
      <p className="text-ink-2 text-[16px] leading-relaxed mt-4 max-w-prose">
        Das liegt an uns, nicht an dir. Versuch es gleich nochmals. Bleibt der Fehler, hilft uns die Kennung unten bei der Suche.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button type="button" onClick={reset} className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium hover:bg-accent-hover transition-colors">Erneut versuchen</button>
        <Link href="/" className="h-11 px-5 rounded-[6px] bg-accent-soft text-accent-hover font-medium inline-flex items-center hover:bg-accent hover:text-accent-ink transition-colors">Zur Startseite</Link>
      </div>
      {error.digest && <p className="mt-6 text-[13px] text-muted tnum">Kennung: {error.digest}</p>}
    </div>
  );
}
