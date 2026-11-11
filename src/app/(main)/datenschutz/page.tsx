import Link from "next/link";
import { DocPage, DocSection, DocSummary, DocTable, type TocItem } from "@/components/doc";

export const metadata = {
  title: "Datenschutz",
  description: "Datenschutzerklärung von Leihregal (Entwurf, Prüfung durch eine Fachperson ausstehend).",
};

const TOC: TocItem[] = [
  ["verantwortlich", "Verantwortlich"],
  ["daten", "Welche Daten"],
  ["zwecke", "Wozu"],
  ["standort", "Standort"],
  ["chat", "Chat und Moderation"],
  ["empfaenger", "Auftragsbearbeiter"],
  ["aufbewahrung", "Aufbewahrung"],
  ["rechte", "Deine Rechte"],
  ["cookies", "Cookies und Speicher"],
  ["sicherheit", "Sicherheit"],
  ["aenderungen", "Änderungen"],
];

export default function Page() {
  return (
    <DocPage eyebrow="Rechtliches" title={<>Datenschutz. <em>Nur was nötig ist.</em></>} toc={TOC} draft updated="Entwurf, November 2026"
      intro={<DocSummary eyebrow="Das Wichtigste in Kürze" title="Vier Punkte vorab" note="Die Kurzfassung erleichtert das Lesen. Massgebend ist der vollständige Text." items={[
        ["Nur die Postleitzahl", "Keine Adresse, kein Gerätestandort. Andere sehen dein Regal als Fläche von rund 300 m.", "#standort"],
        ["Keine Werbung", "Kein Verkauf von Daten, keine Analyse- oder Werbe-Cookies, keine Tracker von Dritten.", "#cookies"],
        ["Der Chat ist privat", "Die Moderation liest nur bei einer Meldung oder einem Fall. Jeder Zugriff wird protokolliert.", "#chat"],
        ["Deine Kontrolle", "Alle Daten als Datei herunterladen, Konto löschen, E-Mails pro Art abschalten.", "#rechte"],
      ]} />}
      lead="Wir bearbeiten nur, was es für Leihen, Tausch und Sicherheit braucht. Keine Werbung, kein Verkauf von Daten, keine Bewegungsdaten.">

      <DocSection id="verantwortlich" title="Verantwortlich">
        <p>
          Verantwortlich für die Bearbeitung ist [Name und Adresse der Betreiberin], erreichbar unter [E-Mail-Adresse].
          Es gilt das schweizerische Datenschutzgesetz (DSG). Für Mitglieder in der EU gilt zusätzlich die Datenschutz-Grundverordnung (DSGVO).
          [Vertretung in der EU nach Art. 27 DSGVO zu prüfen.]
        </p>
      </DocSection>

      <DocSection id="daten" title="Welche Daten">
        <DocTable head={["Bereich", "Daten"]} rows={[
          ["Konto", "E-Mail-Adresse, Vorname, Postleitzahl und Gemeinde, Mobilnummer, Bestätigung des Mindestalters (nicht das Geburtsdatum), optional ein Profilbild"],
          ["Anmeldung", "Sitzungen mit Gerätetyp, Passkeys (nur öffentlicher Schlüssel), Einmal-Codes nur als Prüfsumme"],
          ["Regal", "Deine Bücher, Zustand, Fotos, Übergabeorte, Verleihkalender"],
          ["Vorgänge", "Anfragen, Übergaben, Rückgaben, Fristen, Fälle, Bewertungen und der lückenlose Verlauf jedes Vorgangs"],
          ["Chat", "Nachrichten und Terminvorschläge innerhalb eines Vorgangs"],
          ["Nutzung", "Suchbegriffe mit Trefferzahl für die Kennzahl «Liquidität», Benachrichtigungen, Meldungen"],
          ["Missbrauchsschutz", "Zähler für Ratenbegrenzung sowie Geräte- und IP-Signale als Hinweis für die Moderation"],
        ]} />
      </DocSection>

      <DocSection id="zwecke" title="Wozu">
        <ul>
          <li>Leihen, Tausch und Geschenke durchführen, inklusive Erinnerungen und Fristen.</li>
          <li>Vertrauen ermöglichen: Stufe und Zahlen auf dem Profil.</li>
          <li>Missbrauch verhindern: Bestätigung der Mobilnummer, eine Nummer pro Konto, Moderation.</li>
          <li>Den Dienst verbessern, mit zusammengefassten Kennzahlen ohne Bezug zu einzelnen Personen.</li>
        </ul>
        <p>
          Grundlage ist der Vertrag mit dir (Nutzungsbedingungen), für den Missbrauchsschutz unser berechtigtes Interesse an einer sicheren Plattform
          (bei Mitgliedern in der EU Art. 6 Abs. 1 lit. b und f DSGVO). Wir zeigen keine Werbung und verkaufen keine Daten.
        </p>
      </DocSection>

      <DocSection id="standort" title="Standort">
        <p>
          Wir kennen nur deine Postleitzahl, nie deine Adresse und nie deinen Standort aus dem Gerät. Aus der Postleitzahl berechnen wir einen Punkt im Gebiet,
          gespeichert auf rund 100 m gerundet. Anderen zeigen wir dein Regal zusätzlich zufällig verschoben, als Fläche von rund 300 m.
          Bewegungsdaten entstehen keine.
        </p>
        <p>Den genauen Übergabeort, den du selbst eingibst, sieht die andere Seite erst nach deiner Annahme.</p>
      </DocSection>

      <DocSection id="chat" title="Chat und Moderation">
        <p>
          Der Chat ist private Kommunikation zwischen den Beteiligten eines Vorgangs. Die Moderation liest ihn nur, wenn eine Meldung oder ein Fall offen ist.
          Jeder solche Zugriff wird mit Person und Zeitpunkt protokolliert. Nachrichten mit Preisangaben werden automatisch zur Prüfung markiert.
        </p>
      </DocSection>

      <DocSection id="empfaenger" title="Auftragsbearbeiter">
        <p>Wir geben Daten nur an Dienstleister weiter, die sie in unserem Auftrag bearbeiten:</p>
        <DocTable head={["Anbieter", "Zweck", "Standort"]} rows={[
          ["Railway", "Hosting der Anwendung, Datenbank, Speicher für Fotos", "EU-Region [Rechenzentrum zu ergänzen]"],
          ["[E-Mail-Anbieter]", "Versand von Anmeldelinks und Benachrichtigungen", "[Standort]"],
          ["[SMS-Anbieter]", "Bestätigung der Mobilnummer, Aufforderungen im Streitfall", "[Standort]"],
        ]} />
        <p>
          Für Titeldaten fragen wir Bibliothekskataloge und Buchverzeichnisse ab (Deutsche Nationalbibliothek, Open Library, Google Books).
          Dabei übermitteln wir nur die ISBN oder den Suchbegriff, keine Angaben zu dir.
        </p>
        <p>Andere Mitglieder sehen deinen Vornamen, dein Profilbild (falls du eines hochlädst), deine Gemeinde, dein Regal, deine Stufe und deine Zahlen. Mobilnummer und E-Mail-Adresse sehen sie nie.</p>
      </DocSection>

      <DocSection id="aufbewahrung" title="Aufbewahrung">
        <DocTable head={["Daten", "Wie lange"]} rows={[
          ["Chat-Inhalte", "12 Monate nach Abschluss des Vorgangs, dann gelöscht"],
          ["Vorgänge", "Solange das Konto besteht. Bei Löschung anonymisiert, weil die andere Seite sie für ihre Zahlen braucht"],
          ["Verlust aus einem Streitfall", "24 Monate sichtbar auf dem Profil, ausser er wird bereinigt"],
          ["Profilbild", "Bis du es entfernst oder ersetzt oder dein Konto löschst. Dann wird es aus dem Speicher gelöscht"],
          ["Sitzungen", "60 Tage nach der Anmeldung im Browser, oder bis du dich abmeldest"],
          ["Codes für SMS und E-Mail-Link", "Wenige Minuten gültig, nur als Prüfsumme gespeichert"],
          ["Gesperrte Mobilnummern", "Solange die Sperre gilt"],
        ]} />
      </DocSection>

      <DocSection id="rechte" title="Deine Rechte">
        <ul>
          <li><strong>Auskunft.</strong> In den <Link href="/einstellungen#daten">Einstellungen</Link> lädst du alles, was wir zu dir gespeichert haben, als Datei herunter.</li>
          <li><strong>Berichtigung.</strong> Vorname und Postleitzahl änderst du selbst in den Einstellungen.</li>
          <li><strong>Löschung.</strong> Du kannst dein Konto in den Einstellungen löschen, sobald keine Leihe mehr offen ist.</li>
          <li><strong>Widerspruch und Einschränkung.</strong> E-Mail-Benachrichtigungen schaltest du pro Art ab, ausser jene zu Fällen.</li>
          <li><strong>Beschwerde.</strong> Du kannst dich an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) wenden, in der EU an die Aufsichtsbehörde deines Landes.</li>
        </ul>
      </DocSection>

      <DocSection id="cookies" title="Cookies und Speicher">
        <p>
          Wir setzen ein einziges Cookie für die Anmeldung. Es gibt keine Analyse- oder Werbe-Cookies und keine Tracker von Dritten.
          Im Speicher deines Browsers liegen nur Einstellungen wie Hell- oder Dunkelmodus und, wenn du die App installierst, Dateien für die Offline-Anzeige.
        </p>
      </DocSection>

      <DocSection id="sicherheit" title="Sicherheit">
        <p>
          Verbindungen sind verschlüsselt. Anmeldelinks, Codes und Sitzungen speichern wir nur als Prüfsumme. Anmeldung, Anfragen und Nachrichten sind in der Anzahl begrenzt.
          Fotos liegen in einem privaten Speicher und sind nur über kurzlebige Links abrufbar.
        </p>
      </DocSection>

      <DocSection id="aenderungen" title="Änderungen">
        <p>Ändert sich diese Erklärung wesentlich, informieren wir dich vorher per E-Mail.</p>
      </DocSection>
    </DocPage>
  );
}
