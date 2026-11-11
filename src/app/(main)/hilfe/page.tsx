import Link from "next/link";
import { DocCompare, DocPage, DocSection, DocSub, DocTable, type TocItem } from "@/components/doc";

export const metadata = {
  title: "So funktioniert es",
  description: "Wie Leihen, Übergabe, Fristen, Tausch und Streitfälle bei Leihregal ablaufen.",
};

const TOC: TocItem[] = [
  ["ablauf", "Eine Leihe Schritt für Schritt"],
  ["uebergabe", "Übergabe und Rückgabe"],
  ["fristen", "Fristen und Erinnerungen"],
  ["verlaengern", "Verlängern und Zurückrufen"],
  ["termin", "Terminleihe und Verleihkalender"],
  ["weitergabe", "Direkte Weitergabe"],
  ["tausch", "Tauschen und Verschenken"],
  ["stufen", "Vertrauensstufen und Limiten"],
  ["schaden", "Lesespuren oder Schaden"],
  ["streitfall", "Wenn ein Buch nicht zurückkommt"],
  ["treffen", "Sicher treffen"],
  ["alter", "Mindestalter"],
];

export default function Page() {
  return (
    <DocPage eyebrow="Hilfe" title="So funktioniert es" toc={TOC}
      lead="Du leihst Bücher aus Regalen in deiner Nähe, kostenlos. Jede Leihe hat feste Schritte und Fristen. So weiss jederzeit jede Seite, wer am Zug ist.">

      <DocSection id="ablauf" title="Eine Leihe Schritt für Schritt">
        <ol>
          <li><strong>Anfragen.</strong> Du wählst ein Exemplar und einen Zeitraum im Verleihkalender, ab heute oder später. Eine kurze Nachricht ist möglich.</li>
          <li><strong>Antwort.</strong> Wer verleiht, nimmt an oder lehnt ab, ohne Begründung. Ohne Antwort verfällt die Anfrage nach 72 Stunden.</li>
          <li><strong>Termin abmachen.</strong> Im Chat des Vorgangs schlagt ihr Ort und Zeit vor. Ein Vorschlag lässt sich mit einem Tipp annehmen.</li>
          <li><strong>Übergabe.</strong> Ein Scan des QR-Codes bestätigt die Übergabe. Ab jetzt läuft die Leihfrist.</li>
          <li><strong>Zustand festhalten.</strong> Innert 24 Stunden kannst du Mängel mit Foto notieren. Danach gilt der Zustand aus dem Inserat.</li>
          <li><strong>Lesen.</strong> 5 Tage und 1 Tag vor Ablauf erinnern wir dich.</li>
          <li><strong>Rückgabe.</strong> Wieder mit Scan. Wer verliehen hat, prüft das Buch und kann innert 48 Stunden einen Schaden melden.</li>
          <li><strong>Abschluss.</strong> Ohne Meldung ist die Leihe abgeschlossen und das Buch wieder verfügbar. Beide können mit einem Tipp sagen: «Gerne wieder» oder «Es gab Probleme».</li>
        </ol>
        <p>Der Verleiher entscheidet: wer leiht, wie lange und wo übergeben wird. Die Plattform setzt nur Standards und Obergrenzen.</p>
      </DocSection>

      <DocSection id="uebergabe" title="Übergabe und Rückgabe">
        <p>
          Die abgebende Person öffnet den Vorgang und zeigt einen QR-Code. Die empfangende Person scannt ihn mit der Kamera im Browser.
          Der Code gilt 10 Minuten. Darunter stehen sechs Ziffern: Will die Kamera nicht, tippst du diese ein.
        </p>
        <p>Klappt kein Scan, gibt es drei Wege:</p>
        <DocTable head={["Weg", "Ablauf", "Absicherung"]} rows={[
          ["Einseitig melden", "Eine Seite tippt «Übergeben» oder «Zurückgegeben». Die andere wird um Bestätigung gebeten.", "48 Stunden Einspruchsfrist, danach gilt die Meldung. Erinnerung nach 24 Stunden."],
          ["Ablage", "Milchkasten, Briefkasten oder Hausflur: Die abgebende Person hinterlegt das Buch und lädt ein Foto der Ablage hoch. Die andere bestätigt die Entnahme.", "Foto mit Zeitstempel, 48 Stunden Einspruchsfrist. Nur wenn der Verleiher die Ablage erlaubt."],
          ["Kein Treffen", "Niemand meldet etwas, der Termin verstreicht.", "Der Vorgang bleibt offen und verfällt 7 Tage nach dem geplanten Beginn."],
        ]} />
        <p>
          Die Einspruchsfrist schützt auch dich als Leiherin oder Leiher: Wer eine erfolgte Rückgabe nicht bestätigt, kann die Leihe nicht offenhalten.
        </p>
        <p>
          <strong>Übergabeorte.</strong> Wer verleiht, legt bis zu drei Orte fest, etwa «Bahnhof Bülach, Kiosk». Vor der Annahme siehst du nur diese Bezeichnung.
          Den genauen Ort zeigt der Vorgang erst nach der Annahme. Eine Adresse zeigt Leihregal nie an.
        </p>
      </DocSection>

      <DocSection id="fristen" title="Fristen und Erinnerungen">
        <p>Die meisten verspäteten Rückgaben sind Vergesslichkeit, nicht böser Wille. Deshalb geht es langsam, mit Erinnerungen statt Strafen.</p>
        <DocTable head={["Zeitpunkt", "Was passiert"]} rows={[
          ["5 Tage vorher", "Erinnerung mit den Knöpfen «Verlängern» und «Rückgabe planen»."],
          ["1 Tag vorher", "Zweite Erinnerung."],
          ["Fälligkeit", "Status «überfällig». Hinweis an beide, Terminvorschlag im Chat."],
          ["+ 3 Tage", "Erinnerung per E-Mail. Die Kulanz endet, die Leihe zählt als unpünktlich."],
          ["+ 7 Tage", "Keine neuen Anfragen mehr, bis das Buch zurück ist. Der Verleiher kann einen Fall eröffnen."],
          ["+ 21 Tage", "Der Fall wird automatisch eröffnet."],
        ]} />
        <p>Jede offene Handlung hat eine Frist und eine feste Folge. Nichts bleibt hängen.</p>
      </DocSection>

      <DocSection id="verlaengern" title="Verlängern und Zurückrufen">
        <DocTable head={["Regel", "Standard", "Wählbar durch den Verleiher"]} rows={[
          ["Leihfrist", "28 Tage", "14, 28, 42 oder 56 Tage, pro Regal oder Buch"],
          ["Verlängerung", "1 × um 14 Tage, automatisch, wenn der Kalender danach frei ist", "Nur auf Anfrage, bis 2 Verlängerungen"],
          ["Mit Folgeleihe", "Höchstens bis zum Puffer vor der nächsten Leihe", "–"],
          ["Rückruf", "Frühestens nach 14 Tagen, Rückgabe innert 7 Tagen", "Nicht abschaltbar: Es bleibt sein Buch"],
          ["Früher zurückgeben", "Jederzeit", "–"],
        ]} />
      </DocSection>

      <DocSection id="termin" title="Terminleihe und Verleihkalender">
        <p>
          Du kannst ein Buch für später buchen, auch wenn es gerade ausgeliehen ist. Jedes Exemplar hat einen Verleihkalender:
          Jede Leihe liegt als Balken auf einer Zeitachse. Freie Zeiträume tippst du direkt an, die Anfrage öffnet sich mit diesem Datum.
        </p>
        <ul>
          <li>Buchen geht bis 90 Tage im Voraus, je nach Buch 30 bis 180 Tage.</li>
          <li>Zwischen zwei Leihen liegen 3 Tage Puffer für Rückgabe und nächste Übergabe.</li>
          <li>Übergeben werden kann ab 3 Tagen vor bis 7 Tage nach dem geplanten Beginn.</li>
          <li>Andere sehen nur frei und belegt, keine Namen.</li>
        </ul>
        <p>
          Kommt das Buch früher zurück, bekommst du das Angebot, früher zu beginnen. Verspätet sich die Rückgabe vor deiner Leihe, wählst du:
          Zeitraum verschieben, kürzer leihen oder ohne Nachteil stornieren.
        </p>
        <p>
          Du kannst bis zur Übergabe jederzeit stornieren. Weniger als 48 Stunden vor Beginn zählt das in deinen Zahlen wie eine unpünktliche Leihe.
        </p>
      </DocSection>

      <DocSection id="weitergabe" title="Direkte Weitergabe">
        <p>
          Folgen zwei Leihen aufeinander, kann das Buch direkt von der ersten zur zweiten Person gehen, ohne Umweg über den Verleiher.
          Das spart zwei Treffen. Es geschieht nur, wenn alle drei zugestimmt haben.
        </p>
        <ol>
          <li>Der Verleiher wird gefragt, ob er direkt weitergeben will. Er kann das pro Buch vorab festlegen: nie, auf Anfrage, immer.</li>
          <li>Danach stimmen die beiden Leihenden zu. Erst mit drei Zustimmungen gilt die Weitergabe.</li>
          <li>Ort und Zeit sprecht ihr im Übergabe-Chat zu dritt ab.</li>
          <li>Ein Scan beendet die erste Leihe und startet die zweite im selben Moment.</li>
          <li>Wer übernimmt, hält innert 24 Stunden den Zustand mit Foto fest. Das ist hier Pflicht: Mängel, die du nicht meldest, verantwortest du selbst.</li>
        </ol>
        <p>
          Jede Leihe bleibt eine Vereinbarung mit dem Verleiher. Die erste Person haftet bis zum Scan, die zweite ab dem Scan.
          Telefonnummer und Adresse gibt Leihregal nie weiter. Platzt die Weitergabe, geht das Buch normal zurück, die Frist verlängert sich um 3 Tage.
        </p>
      </DocSection>

      <DocSection id="tausch" title="Tauschen und Verschenken">
        <p>Tausch und Geschenk sind dauerhafte Besitzwechsel. Sie laufen wie eine Leihe, nur ohne Rückgabe.</p>
        <DocSub>Tausch 1:1</DocSub>
        <p>
          Du fragst ein Tauschbuch an und bietest 1 bis 5 Bücher aus deinem Regal an. Die andere Seite wählt eines davon oder lehnt ab.
          Bei der Übergabe scannt jede Seite den Code der anderen, beide Scans innert 10 Minuten. Es gibt keinen Wertausgleich und keine Punkte:
          Ob ein Taschenbuch gegen einen Bildband fair ist, entscheidet ihr.
        </p>
        <DocSub>Verschenken</DocSub>
        <p>
          Anfrage, Annahme, Übergabe mit Scan, fertig. Bei mehreren Anfragen wählst du frei. Geschenkte Bücher können frühestens nach 30 Tagen weiterverschenkt oder getauscht werden.
        </p>
        <DocSub>Behalten statt zurückgeben</DocSub>
        <p>Gefällt dir ein geliehenes Buch, kannst du anbieten, es zu behalten und dafür eines deiner Bücher zu geben. Nimmt der Verleiher an, wird die Leihe zum Tausch.</p>
      </DocSection>

      <DocSection id="stufen" title="Vertrauensstufen und Limiten">
        <p>Neue Mitglieder können sofort leihen, aber wenig. Das begrenzt Missbrauch, ohne Ehrliche auszusperren.</p>
        <DocTable head={["Stufe", "Voraussetzung", "Leihen bei Fremden", "Offene Anfragen"]} rows={[
          ["Neu", "E-Mail und Mobilnummer bestätigt", "2 gleichzeitig", "3"],
          ["Bewährt", "3 abgeschlossene Leihen, alle pünktlich", "5 gleichzeitig", "6"],
          ["Vertraut", "10 abgeschlossene Leihen, kein Verlust in 12 Monaten", "10 gleichzeitig", "10"],
        ]} />
        <ul>
          <li>Leihen innerhalb eines Kreises zählen nicht gegen die Limite.</li>
          <li>Der Verleiher kann pro Regal festlegen: «alle», «ab Bewährt» oder «nur meine Kreise».</li>
          <li>Auf deinem Profil stehen die Stufe und drei Zahlen: verliehen, geliehen, pünktlich zurückgegeben. Keine Sterne, keine Punkte.</li>
        </ul>
      </DocSection>

      <DocSection id="schaden" title="Lesespuren oder Schaden">
        <p>
          <strong>Normale Lesespuren sind kein Schaden.</strong> Ein Buch, das gelesen wurde, sieht auch so aus. Verglichen wird immer mit dem Zustand im Inserat
          und mit der Zustandsnotiz, die bei der Übergabe festgehalten wurde.
        </p>
        <DocCompare
          left={{ title: "Lesespur – kein Schaden", items: [
            "Leseknick im Rücken eines Taschenbuchs",
            "Leicht bestossene Ecken und Kanten",
            "Umschlag etwas gewellt oder berieben",
            "Seiten vergilbt durch Licht und Alter",
            "Einzelne leichte Knicke an Seitenecken",
            "Abdruck eines Lesezeichens",
          ] }}
          right={{ title: "Schaden", items: [
            "Wasser- oder Kaffeefleck, gewellte Seiten",
            "Eingerissene, herausgetrennte oder fehlende Seiten",
            "Seiten lösen sich aus der Bindung",
            "Neue Unterstreichungen, Notizen oder Leuchtstift",
            "Gerissener Umschlag, fehlender Schutzumschlag",
            "Brand- oder Schimmelflecken, starker Rauchgeruch, Bissspuren",
          ] }}
        />
        <DocSub>Wenn doch etwas passiert ist</DocSub>
        <p>
          Der Verleiher meldet einen Schaden innert 48 Stunden nach der Rückgabe, mit Foto. Du wählst eine von drei Antworten:
          Ersatz durch ein gleiches Exemplar, Ersatz durch ein anderes Buch nach Wahl des Verleihers, oder Widerspruch.
          Bei Widerspruch entscheidet die Moderation anhand der Fotos und des Verlaufs.
        </p>
      </DocSection>

      <DocSection id="streitfall" title="Wenn ein Buch nicht zurückkommt">
        <p>
          Spätestens 21 Tage nach Ablauf der Frist wird ein Fall eröffnet. Ab dann gilt ein fester Ablauf. Wer leiht, hat drei Möglichkeiten:
          einen Rückgabetermin nennen, Ersatz anbieten oder vorschlagen, das Buch zu behalten und dafür ein eigenes zu geben.
        </p>
        <DocTable head={["Tag ab Eröffnung", "Was passiert"]} rows={[
          ["0", "Der Fall ist offen. Die drei Möglichkeiten stehen im Vorgang."],
          ["7", "Ohne Reaktion: zweite Aufforderung per E-Mail und SMS."],
          ["14", "Ohne Reaktion: Leihen und Tauschen werden gesperrt. Die Moderation prüft."],
          ["30", "Der Fall wird als «verloren» geschlossen. Das Buch verlässt das Regal. Der Verlust bleibt 24 Monate auf dem Profil sichtbar."],
        ]} />
        <p>
          Ein Verlust lässt sich nachträglich bereinigen: Kommt das Buch zurück oder wird es ersetzt, verschwinden Eintrag und Sperre.
          Leihregal kann kein Buch zurückholen und keinen Schaden bezahlen. Es sorgt dafür, dass der Weg für beide gleich und vorhersehbar ist.
        </p>
      </DocSection>

      <DocSection id="treffen" title="Sicher treffen">
        <ul>
          <li>Trefft euch an öffentlichen Orten: Bahnhof, Bibliothek, Café. Tagsüber, wenn es geht.</li>
          <li>Die Ablage ist eine Alternative ohne Treffen, wenn der Verleiher sie erlaubt.</li>
          <li>Vor der Annahme sieht niemand einen genauen Ort. Eine Adresse zeigt Leihregal nie an.</li>
          <li>Telefonnummer oder Adresse teilst du nur, wenn du willst, selbst im Chat.</li>
          <li>Fühlt sich etwas falsch an: Melde die Person oder blockiere sie mit einem Tipp. Blockierte sehen dein Regal nicht mehr.</li>
        </ul>
        <p>Mehr dazu in den <Link href="/regeln">Regeln</Link>.</p>
      </DocSection>

      <DocSection id="alter" title="Mindestalter">
        <p>
          Für ein eigenes Konto brauchst du mindestens 16 Jahre. Kinderbücher leihen die Eltern. So bleiben Treffen zwischen Fremden und Kindern aus dem Spiel.
        </p>
      </DocSection>
    </DocPage>
  );
}
