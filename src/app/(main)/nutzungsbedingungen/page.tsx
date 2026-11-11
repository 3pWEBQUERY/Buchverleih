import Link from "next/link";
import { DocPage, DocSection, type TocItem } from "@/components/doc";

export const metadata = {
  title: "Nutzungsbedingungen",
  description: "Nutzungsbedingungen von Leihregal (Entwurf, Prüfung durch eine Fachperson ausstehend).",
};

const TOC: TocItem[] = [
  ["geltung", "1. Geltung"],
  ["plattform", "2. Was Leihregal tut"],
  ["mitglied", "3. Mitgliedschaft"],
  ["leihe", "4. Die Leihe"],
  ["weitergabe", "5. Direkte Weitergabe"],
  ["tausch", "6. Tausch und Geschenk"],
  ["fristen", "7. Fristen, Schaden, Streitfall"],
  ["unentgeltlich", "8. Unentgeltlichkeit"],
  ["inhalte", "9. Inhalte und Fotos"],
  ["haftung", "10. Haftung"],
  ["sperre", "11. Sperren"],
  ["ende", "12. Kündigung und Löschung"],
  ["aenderungen", "13. Änderungen"],
  ["recht", "14. Recht und Gerichtsstand"],
];

export default function Page() {
  return (
    <DocPage eyebrow="Rechtliches" title="Nutzungsbedingungen" toc={TOC} draft updated="Entwurf, November 2026"
      lead="Die Regeln für die Nutzung von Leihregal und für Leihen, Tausch und Geschenke zwischen Mitgliedern.">

      <DocSection id="geltung" title="1. Geltung">
        <p>
          Diese Bedingungen gelten für die Nutzung von Leihregal im Web und in künftigen Apps. Betreiberin ist [Name und Adresse der Betreiberin].
          Mit der Registrierung stimmst du ihnen zu. Ergänzend gelten die <Link href="/regeln">Gemeinschaftsregeln</Link> und
          die <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </DocSection>

      <DocSection id="plattform" title="2. Was Leihregal tut">
        <p>
          Leihregal vermittelt Kontakte zwischen Privatpersonen, die Bücher verleihen, tauschen oder verschenken wollen. Die Plattform stellt Regale,
          Suche, Verleihkalender, Chat und einen festen Ablauf für Übergabe, Rückgabe und Streitfälle bereit.
        </p>
        <p>
          <strong>Leihregal ist nicht Partei der Leihe.</strong> Jede Leihe, jeder Tausch und jedes Geschenk ist eine Vereinbarung zwischen den beteiligten
          Mitgliedern. Leihregal besitzt keine der Bücher, übernimmt keine Gewähr für deren Zustand und holt keine Bücher zurück.
        </p>
      </DocSection>

      <DocSection id="mitglied" title="3. Mitgliedschaft">
        <ul>
          <li>Ein eigenes Konto ist ab 16 Jahren möglich.</li>
          <li>Jede Person hat ein Konto. Vor der ersten Anfrage bestätigst du E-Mail und Mobilnummer. Eine Nummer gehört zu einem Konto.</li>
          <li>Deine Angaben müssen stimmen. Du hältst deine Anmeldung geheim und meldest Missbrauch deines Kontos.</li>
          <li>Leihregal ist für Privatpersonen. Gewerbliche Nutzung ist ausgeschlossen.</li>
        </ul>
      </DocSection>

      <DocSection id="leihe" title="4. Die Leihe">
        <p>
          Eine Leihe über Leihregal ist eine Gebrauchsleihe nach schweizerischem Obligationenrecht (Art. 305–311 OR):
          Der Verleiher überlässt ein Buch unentgeltlich zum Gebrauch, wer leiht, gibt es nach Ablauf der vereinbarten Zeit zurück.
        </p>
        <ul>
          <li><strong>Rückgabe.</strong> Das Buch kommt bis zum Ende der Leihfrist zurück, in dem Zustand, in dem es übergeben wurde, abgesehen von normalen Lesespuren.</li>
          <li><strong>Sorgfalt.</strong> Wer leiht, behandelt das Buch sorgfältig und nutzt es nur zum Lesen.</li>
          <li><strong>Kein Weiterverleihen.</strong> Wer leiht, überlässt das Buch keiner anderen Person. Ausnahme ist die direkte Weitergabe nach Ziffer 5.</li>
          <li><strong>Ersatz.</strong> Bei Verlust oder Schaden leistet, wer geliehen hat, Ersatz: durch ein gleiches Exemplar oder durch ein anderes Buch nach Wahl des Verleihers.</li>
          <li><strong>Rückruf.</strong> Der Verleiher kann ein Buch frühestens nach 14 Tagen zurückrufen. Es kommt dann innert 7 Tagen zurück.</li>
        </ul>
        <p>Leihfrist, Verlängerung und Übergabeort legt der Verleiher im Rahmen der Standards der Plattform fest.</p>
      </DocSection>

      <DocSection id="weitergabe" title="5. Direkte Weitergabe">
        <p>
          Bei zwei aufeinanderfolgenden Leihen kann das Buch direkt von der ersten zur zweiten Person gehen. Die zweite Person hat dabei eine eigene Leihe
          mit dem Verleiher. Die Weitergabe gilt nur, wenn der Verleiher und beide Leihenden ausdrücklich zugestimmt haben.
          Die erste Person haftet bis zur bestätigten Übergabe, die zweite ab dann. [Formulierung mit Blick auf Art. 306 OR zu prüfen.]
        </p>
      </DocSection>

      <DocSection id="tausch" title="6. Tausch und Geschenk">
        <p>
          Bei einem Tausch oder Geschenk geht das Eigentum am Buch mit der bestätigten Übergabe auf die empfangende Person über.
          Es gibt keinen Wertausgleich. Geschenkte Bücher dürfen frühestens nach 30 Tagen weiterverschenkt oder getauscht werden.
        </p>
      </DocSection>

      <DocSection id="fristen" title="7. Fristen, Schaden, Streitfall">
        <p>
          Übergabe und Rückgabe gelten, wenn beide Seiten sie bestätigt haben oder eine Einspruchsfrist von 48 Stunden abgelaufen ist.
          Jede offene Handlung hat eine Frist mit fester Folge. Die Fristen sind in der <Link href="/hilfe#fristen">Hilfe</Link> beschrieben und Teil dieser Bedingungen.
        </p>
        <p>
          Einen Schaden meldet der Verleiher innert 48 Stunden nach der Rückgabe mit Foto. Bleibt die Rückgabe aus, wird ein Fall eröffnet.
          Bei Widerspruch entscheidet die Moderation anhand der Fotos und des Verlaufs. Dieser Entscheid regelt nur die Folgen auf der Plattform,
          etwa Sperren und die Anzeige auf dem Profil. Ansprüche zwischen den Mitgliedern bleiben davon unberührt.
        </p>
      </DocSection>

      <DocSection id="unentgeltlich" title="8. Unentgeltlichkeit">
        <p>
          Leihen ist für Mitglieder kostenlos. Zwischen Mitgliedern fliesst kein Geld: keine Leihgebühr, keine Kaution, kein Verkauf.
          Leihregal verlangt keine Gebühr pro Leihe. Allfällige spätere Zusatzleistungen werden vorher angekündigt und betreffen nie die Leihe selbst.
        </p>
      </DocSection>

      <DocSection id="inhalte" title="9. Inhalte und Fotos">
        <p>
          Du lädst nur Fotos hoch, die Bücher zeigen und an denen du die Rechte hast. Du räumst Leihregal das Recht ein, sie für den Betrieb der Plattform
          anzuzeigen. Titeldaten stammen aus Bibliothekskatalogen und anderen Quellen und können Fehler enthalten. Korrekturen kannst du melden.
        </p>
      </DocSection>

      <DocSection id="haftung" title="10. Haftung">
        <p>
          Leihregal haftet nicht für Verlust, Beschädigung oder Zustand von Büchern und nicht für das Verhalten von Mitgliedern.
          Die Haftung für Schäden aus dem Betrieb der Plattform ist im gesetzlich zulässigen Rahmen ausgeschlossen, ausser bei Vorsatz oder grober Fahrlässigkeit.
          [Umfang zu prüfen.]
        </p>
      </DocSection>

      <DocSection id="sperre" title="11. Sperren">
        <p>
          Bei Verstössen gegen diese Bedingungen oder die Regeln kann Leihregal das Leihen einschränken oder ein Konto sperren, zusammen mit der Mobilnummer.
          Ein Verlust aus einem Streitfall bleibt 24 Monate auf dem Profil sichtbar, ausser er wird durch Rückgabe oder Ersatz bereinigt.
        </p>
      </DocSection>

      <DocSection id="ende" title="12. Kündigung und Löschung">
        <p>
          Du kannst dein Konto jederzeit in den <Link href="/einstellungen#daten">Einstellungen</Link> löschen, sobald keine Leihe mehr offen ist.
          Abgeschlossene Vorgänge bleiben ohne deinen Namen erhalten, weil sie für die Zahlen der anderen Seite nötig sind.
        </p>
      </DocSection>

      <DocSection id="aenderungen" title="13. Änderungen">
        <p>Änderungen dieser Bedingungen kündigen wir mindestens 30 Tage vorher per E-Mail an. Laufende Leihen gelten zu den Bedingungen, unter denen sie angenommen wurden.</p>
      </DocSection>

      <DocSection id="recht" title="14. Recht und Gerichtsstand">
        <p>Es gilt schweizerisches Recht. Gerichtsstand ist [Ort], soweit das Gesetz nichts anderes zwingend vorsieht.</p>
      </DocSection>
    </DocPage>
  );
}
