import { Wordmark } from "@/components/shell";
import { RetryButton } from "./retry";

export const dynamic = "force-static";
export const metadata = { title: "Offline", robots: { index: false } };

/** Offline-Hülle der PWA. Der Service Worker liefert sie, wenn eine Seite ohne Netz nicht lädt. */
export default function Page() {
  return (
    <div className="min-h-dvh flex flex-col px-4 md:px-10">
      <header className="h-16 flex items-center border-b border-line -mx-4 px-4 md:-mx-10 md:px-10">
        <Wordmark />
      </header>
      <main id="inhalt" className="flex-1 w-full max-w-xl mx-auto py-16 md:py-24">
        <h1 className="display text-4xl md:text-6xl">Keine Verbindung</h1>
        <p className="text-ink-2 text-[17px] mt-5 max-w-prose">Diese Seite braucht das Netz. Sobald du wieder verbunden bist, lädt sie mit einem Tipp neu.</p>
        <div className="mt-8"><RetryButton /></div>
      </main>
    </div>
  );
}
