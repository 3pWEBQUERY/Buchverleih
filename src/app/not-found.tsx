import { StandaloneShell } from "@/components/auth/standalone";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Nicht gefunden", robots: { index: false } };

/** 404: Seite, Buch, Vorgang oder Profil gibt es nicht (mehr) oder ist nicht sichtbar */
export default function NotFound() {
  return (
    <StandaloneShell motif={{ label: "Lücke im Regal", gap: 6 }}>
      <p className="eyebrow anim-rise">Fehler 404</p>
      <h1 className="display text-[32px] md:text-[44px] mt-4 anim-rise" style={{ animationDelay: "40ms" }}>Hier steht <em>nichts.</em></h1>
      <p className="text-ink-2 text-[17px] md:text-[19px] leading-relaxed mt-6 max-w-prose anim-rise" style={{ animationDelay: "80ms" }}>
        Diese Seite gibt es nicht oder nicht mehr. Vielleicht wurde das Buch aus dem Regal genommen, oder der Link ist unvollständig.
      </p>
      <div className="mt-9 flex flex-wrap gap-2 anim-rise" style={{ animationDelay: "120ms" }}>
        <LinkButton href="/" variant="primary" size="lg">Zur Startseite</LinkButton>
        <LinkButton href="/suche" variant="secondary" size="lg">Bücher suchen</LinkButton>
      </div>
    </StandaloneShell>
  );
}
