import { LinkButton } from "@/components/ui";

/** 404 innerhalb der App (Buch, Vorgang, Kreis, Profil): ohne zweite Kopfzeile, in der normalen Hülle */
export default function NotFound() {
  return (
    <div className="max-w-2xl py-6 md:py-10">
      <p className="eyebrow">Fehler 404</p>
      <h1 className="display text-[32px] md:text-[44px] mt-3">Hier steht <em>nichts.</em></h1>
      <p className="text-ink-2 text-[16px] leading-relaxed mt-4 max-w-prose">
        Diese Seite gibt es nicht oder nicht mehr. Vielleicht wurde das Buch aus dem Regal genommen, der Vorgang ist nicht deiner, oder der Link ist unvollständig.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <LinkButton href="/" variant="primary">Zur Startseite</LinkButton>
        <LinkButton href="/suche" variant="secondary">Bücher suchen</LinkButton>
      </div>
    </div>
  );
}
