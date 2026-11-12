import Link from "next/link";
import { DocPage, DocSection, type TocItem } from "@/components/doc";

export const metadata = {
  title: "Impressum",
  description: "Impressum von Leihregal: wer die Plattform betreibt und wie du uns erreichst.",
};

const TOC: TocItem[] = [
  ["betreiber", "Betreiber"],
  ["kontakt", "Kontakt"],
  ["haftung", "Haftung für Inhalte"],
  ["links", "Haftung für Links"],
  ["urheberrecht", "Urheberrecht und Covers"],
  ["hosting", "Hosting"],
];

export default function Page() {
  return (
    <DocPage germanOnly eyebrow="Rechtliches" title={<>Impressum. <em>Wer hinter Leihregal steht.</em></>} toc={TOC} updated="12. November 2026"
      lead="Leihregal ist eine kostenlose Plattform, auf der Privatpersonen einander Bücher leihen, tauschen und verschenken.">

      <DocSection id="betreiber" title="Betreiber">
        <address className="not-italic">
          Alexander Sulschani<br />
          Schaffhauserstrasse 6<br />
          8180 Bülach<br />
          Schweiz
        </address>
        <p>Verantwortlich für den Inhalt dieser Website ist Alexander Sulschani, Anschrift wie oben.</p>
      </DocSection>

      <DocSection id="kontakt" title="Kontakt">
        <p>
          Am schnellsten erreichst du uns über die Funktion <em>Melden</em> in der App, wenn es um ein Buch, eine Person oder einen Vorgang geht.
          Für alles andere schreib uns per Post an die Adresse oben.
        </p>
        <p>Fragen zum Datenschutz beantworten wir gemäss der <Link href="/datenschutz">Datenschutzerklärung</Link>.</p>
      </DocSection>

      <DocSection id="haftung" title="Haftung für Inhalte">
        <p>
          Bücher, Fotos, Beschreibungen und Nachrichten stammen von den Mitgliedern. Wir prüfen Meldungen und entfernen, was gegen
          die <Link href="/regeln">Regeln</Link> oder geltendes Recht verstösst. Für die Richtigkeit von Angaben der Mitglieder übernehmen wir keine Gewähr.
        </p>
        <p>
          Leihen, Tauschen und Schenken geschehen direkt zwischen den Mitgliedern. Leihregal ist nicht Vertragspartei; Einzelheiten
          stehen in den <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>.
        </p>
      </DocSection>

      <DocSection id="links" title="Haftung für Links">
        <p>Verweise auf fremde Websites liegen ausserhalb unseres Verantwortungsbereichs. Für deren Inhalte sind allein die jeweiligen Anbieter verantwortlich.</p>
      </DocSection>

      <DocSection id="urheberrecht" title="Urheberrecht und Covers">
        <p>
          Gestaltung, Texte und Logo von Leihregal sind urheberrechtlich geschützt. Die Original-Cover der Bücher stammen von der
          Deutschen Nationalbibliothek, Open Library und Google Books und werden zur Identifikation der Bücher gezeigt.
          Die Rechte daran liegen bei den Verlagen.
        </p>
        <p>Fotos, die Mitglieder hochladen, bleiben deren Eigentum. Mit dem Hochladen erlauben sie die Anzeige auf Leihregal.</p>
      </DocSection>

      <DocSection id="hosting" title="Hosting">
        <p>
          Die Anwendung, die Datenbank und die Fotos liegen bei Railway (Railway Corporation, San Francisco, USA) in einem
          Rechenzentrum in Westeuropa (Niederlande).
        </p>
      </DocSection>
    </DocPage>
  );
}
