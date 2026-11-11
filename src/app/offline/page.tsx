import { StandaloneShell } from "@/components/auth/standalone";
import { RetryButton } from "./retry";

export const dynamic = "force-static";
export const metadata = { title: "Offline", robots: { index: false } };

/** Offline-Hülle der PWA. Der Service Worker liefert sie, wenn eine Seite ohne Netz nicht lädt. */
export default function Page() {
  return (
    <StandaloneShell motif={{ label: "Ohne Netz" }}>
      <p className="eyebrow anim-rise">Offline</p>
      <h1 className="display text-[52px] md:text-[84px] mt-4 anim-rise" style={{ animationDelay: "40ms" }}>Keine <em>Verbindung.</em></h1>
      <p className="text-ink-2 text-[17px] md:text-[19px] leading-relaxed mt-6 max-w-prose anim-rise" style={{ animationDelay: "80ms" }}>
        Diese Seite braucht das Netz. Sobald du wieder verbunden bist, lädt sie von selbst neu – oder mit einem Tipp.
      </p>
      <div className="mt-9 anim-rise" style={{ animationDelay: "120ms" }}><RetryButton /></div>
    </StandaloneShell>
  );
}
