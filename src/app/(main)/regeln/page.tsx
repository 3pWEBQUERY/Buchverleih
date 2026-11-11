import Link from "next/link";
import { DocPage, DocSection, type TocItem } from "@/components/doc";
import { IconArrowRight } from "@/components/icons";

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
  ["fotos", "Fotos nur von Büchern"],
  ["konto", "Eine Person, ein Konto"],
  ["melden", "Melden und Blockieren"],
  ["folgen", "Wenn jemand die Regeln bricht"],
];

export default function Page() {
  return (
    <DocPage eyebrow="Gemeinschaft" title={<>Regeln. <em>Kurz und für alle.</em></>} toc={TOC} intro={<InShort />}
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

      <DocSection id="fotos" title="Fotos nur von Büchern">
        <p>
          Fotos zeigen Bücher: das Cover, den Zustand, einen Mangel, die Ablage bei der Übergabe. Keine Personen, keine Werbung, nichts, was nicht zum Buch gehört.
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

const SHORT: [n: string, title: string, text: string, href: string][] = [
  ["01", "Kostenlos", "Verleihen, tauschen, verschenken. Nie verkaufen, keine Preise im Chat.", "#kostenlos"],
  ["02", "Pünktlich", "Termine halten, Bücher rechtzeitig zurückgeben, Anfragen beantworten.", "#puenktlich"],
  ["03", "Sorgfältig", "Ein fremdes Buch lesen, wie es gemeint ist: ohne Notizen, ohne Weitergabe.", "#sorgfalt"],
  ["04", "Respektvoll", "Freundlich schreiben, Nein akzeptieren, öffentlich treffen.", "#respekt"],
];

/** Kurz gesagt: die vier wichtigsten Regeln als Karten */
function InShort() {
  return (
    <section aria-labelledby="kurz">
      <p className="eyebrow">Kurz gesagt</p>
      <h2 id="kurz" className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] mt-2 mb-5 md:mb-6">Vier Dinge, auf die sich alle verlassen</h2>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SHORT.map(([n, title, text, href], i) => (
          <li key={n} className="anim-rise" style={{ animationDelay: `${80 + i * 50}ms` }}>
            <a href={href} className="group rounded-[10px] border border-line p-5 flex flex-col h-full min-h-[176px] hover:border-accent transition-colors duration-150">
              <span className="text-[13px] tnum text-accent-hover font-medium">{n}</span>
              <span className="font-medium text-[17px] mt-3">{title}</span>
              <span className="text-muted text-[14px] mt-1.5 leading-relaxed">{text}</span>
              <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-hover">
                Mehr dazu <IconArrowRight width={15} height={15} className="transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
