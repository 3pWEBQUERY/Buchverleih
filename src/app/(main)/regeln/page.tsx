import Link from "next/link";
import { DocPage, DocSection, DocSummary, type TocItem } from "@/components/doc";

export const metadata = {
  title: "Regeln",
  description: "Gemeinschaftsregeln von Leihregal: kostenlos leihen, pünktlich sein, respektvoll bleiben.",
};

const TOC: TocItem[] = [
  ["kostenlos", "Leihen ist kostenlos"],
  ["preise", "Keine Preise im Chat"],
  ["puenktlich", "Pünktlich sein"],
  ["sorgfalt", "Sorgfalt mit Büchern"],
  ["respekt", "Respekt im Chat"],
  ["fotos", "Fotos und Profilbild"],
  ["konto", "Eine Person, ein Konto"],
  ["melden", "Melden und Blockieren"],
  ["folgen", "Wenn jemand die Regeln bricht"],
];

export default function Page() {
  return (
    <DocPage eyebrow="Gemeinschaft" title={<>Regeln. <em>Kurz und für alle.</em></>} toc={TOC} intro={<DocSummary eyebrow="Kurz gesagt" title="Vier Dinge, auf die sich alle verlassen" items={[
        ["Kostenlos", "Verleihen, tauschen, verschenken. Nie verkaufen, keine Preise im Chat.", "#kostenlos"],
        ["Pünktlich", "Termine halten, Bücher rechtzeitig zurückgeben, Anfragen beantworten.", "#puenktlich"],
        ["Sorgfältig", "Ein fremdes Buch lesen, wie es gemeint ist: ohne Notizen, ohne Weitergabe.", "#sorgfalt"],
        ["Respektvoll", "Freundlich schreiben, Nein akzeptieren, öffentlich treffen.", "#respekt"],
      ]} />}
      lead="Leihregal funktioniert, weil Menschen einander ihre Bücher anvertrauen. Diese Regeln halten das Vertrauen aufrecht. Sie sind kurz, und sie gelten für alle.">

      <DocSection id="kostenlos" title="Leihen ist kostenlos">
        <p>
          Bücher werden hier verliehen, getauscht oder verschenkt, nie verkauft. Keine Gebühr, keine Kaution, kein Trinkgeld als Bedingung.
          Wer Bücher verkaufen will, ist hier falsch. Kommerzielle Anbieter sind ausgeschlossen.
        </p>
        <p>
          Das ist nicht nur eine Haltung: Sobald für eine Leihe Geld fliesst, ist sie rechtlich keine Leihe mehr.
        </p>
      </DocSection>

      <DocSection id="preise" title="Keine Preise im Chat">
        <p>
          Der Chat ist für Ort, Zeit und das Buch da. Nenne keine Preise und mach keine Kaufangebote, auch nicht «nur zur Sicherheit».
          Nachrichten mit Preisangaben markiert Leihregal automatisch zur Prüfung durch die Moderation.
        </p>
      </DocSection>

      <DocSection id="puenktlich" title="Pünktlich sein">
        <ul>
          <li>Komm zum abgemachten Termin. Wenn du nicht kannst, sag früh ab oder schlag einen neuen Termin vor.</li>
          <li>Gib Bücher bis zum Ende der Leihfrist zurück, oder verlängere rechtzeitig.</li>
          <li>Beantworte Anfragen innert drei Tagen. Ablehnen ist in Ordnung, Schweigen kostet die anderen Zeit.</li>
        </ul>
        <p>Pünktlichkeit steht als Zahl auf deinem Profil. Sie ist das, worauf andere sich verlassen.</p>
      </DocSection>

      <DocSection id="sorgfalt" title="Sorgfalt mit Büchern">
        <p>
          Lies das Buch, wie du ein fremdes Buch liest: keine Notizen, keine Unterstreichungen, nicht in die Badewanne.
          Normale Lesespuren sind kein Problem. Was als Schaden gilt, steht in der <Link href="/hilfe#schaden">Hilfe</Link>.
        </p>
        <p>
          Ein geliehenes Buch gibst du nicht an andere weiter. Die einzige Ausnahme ist die direkte Weitergabe, wenn der Verleiher ausdrücklich zugestimmt hat.
        </p>
      </DocSection>

      <DocSection id="respekt" title="Respekt im Chat">
        <p>
          Schreib so, wie du am Bahnhof mit einer fremden Person reden würdest. Keine Beleidigungen, keine Anmache, kein Drängen.
          Ein Nein ist ein Nein, auch ohne Begründung.
        </p>
        <p>
          Telefonnummer und Adresse teilst du nur, wenn du willst. Frag nicht danach. Trefft euch an öffentlichen Orten.
        </p>
      </DocSection>

      <DocSection id="fotos" title="Fotos und Profilbild">
        <p>
          Fotos zeigen Bücher: das Cover, den Zustand, einen Mangel, die Ablage bei der Übergabe. Keine Personen, keine Werbung, nichts, was nicht zum Buch gehört.
        </p>
        <p>
          Die einzige Ausnahme ist dein Profilbild. Es ist freiwillig und zeigt dich oder etwas, das für dich steht. Keine anderen Personen ohne deren Einverständnis,
          keine Werbung, nichts Anstössiges. Unpassende Profilbilder entfernt die Moderation.
        </p>
      </DocSection>

      <DocSection id="konto" title="Eine Person, ein Konto">
        <p>
          Jedes Konto gehört einer Person ab 16 Jahren, mit eigener Mobilnummer. Eine Nummer, ein Konto. Zweitkonten werden gesperrt.
        </p>
      </DocSection>

      <DocSection id="melden" title="Melden und Blockieren">
        <p>
          Stimmt etwas nicht, melde es: eine Nachricht, ein Foto, ein Profil oder ein Buch. Die Moderation sieht jede Meldung.
          Den Chat eines Vorgangs liest sie nur bei einer Meldung oder einem offenen Fall, und jeder Zugriff wird protokolliert.
        </p>
        <p>
          Blockieren geht mit einem Tipp. Blockierte Personen sehen dein Regal nicht mehr und können dich nicht anfragen.
          Du kannst es in den <Link href="/einstellungen#blockiert">Einstellungen</Link> jederzeit aufheben.
        </p>
      </DocSection>

      <DocSection id="folgen" title="Wenn jemand die Regeln bricht">
        <p>
          Die Moderation entscheidet nach dem Verlauf und den Fotos. Je nach Fall erinnert sie, sperrt das Leihen oder sperrt das Konto.
          Bei einer Kontosperre wird auch die Mobilnummer gesperrt. Wer eine Sperre für falsch hält, antwortet auf die E-Mail, mit der sie mitgeteilt wurde.
        </p>
      </DocSection>
    </DocPage>
  );
}
