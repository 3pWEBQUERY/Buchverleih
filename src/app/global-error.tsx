"use client";
import "./globals.css";

/** Letzter Rückfall, wenn selbst das Layout nicht lädt. Eigene html/body, keine Abhängigkeiten. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de-CH">
      <body className="min-h-dvh grid place-items-center px-4 bg-paper text-ink">
        <main className="max-w-xl py-16">
          <p className="eyebrow">Leihregal</p>
          <h1 className="display text-[32px] md:text-[44px] mt-3">Gerade geht <em>nichts.</em></h1>
          <p className="text-ink-2 text-[16px] leading-relaxed mt-4">Ein Fehler hat die ganze Seite gestoppt. Versuch es in einem Moment nochmals.</p>
          <button type="button" onClick={reset} className="mt-8 h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium">Erneut versuchen</button>
          {error.digest && <p className="mt-6 text-[13px] text-muted">Kennung: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
