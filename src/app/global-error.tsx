"use client";
import "./globals.css";
import { useClientLocale } from "@/lib/i18n/client-locale";
import { htmlLang } from "@/lib/i18n/locale";
import { COMMON } from "@/lib/i18n/messages/common";

/** Letzter Rückfall, wenn selbst das Layout nicht lädt. Eigene html/body, keine Abhängigkeiten. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const l = useClientLocale();
  const t = COMMON[l].error;
  return (
    <html lang={htmlLang[l]}>
      <body className="min-h-dvh grid place-items-center px-4 bg-paper text-ink">
        <main className="max-w-xl py-16">
          <p className="eyebrow">Leihregal</p>
          <h1 className="display text-[32px] md:text-[44px] mt-3">{t.globalHeading[0]}<em>{t.globalHeading[1]}</em></h1>
          <p className="text-ink-2 text-[16px] leading-relaxed mt-4">{t.globalText}</p>
          <button type="button" onClick={reset} className="mt-8 h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium">{t.retry}</button>
          {error.digest && <p className="mt-6 text-[13px] text-muted">{t.id}{error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
