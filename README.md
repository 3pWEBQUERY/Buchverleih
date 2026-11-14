# Leihregal

Bücher aus Regalen in der Nähe leihen, tauschen und verschenken – kostenlos unter Privatpersonen.
Umsetzung der PRD «Buchverleih & Tauschbörse».

## Aufbau

| Baustein | Ort | Aufgabe |
| --- | --- | --- |
| Web | `src/app` (Next.js 16, React 19, Tailwind 4) | Oberfläche mit Server-Rendering, PWA |
| API | `src/app/api/v1` | Einzige Schreibschnittstelle, Beschreibung unter `/api/v1/openapi.json` |
| Zustandsmaschine | `src/lib/loans/machine.ts` | Alle erlaubten Wechsel eines Vorgangs an einer Stelle |
| Vorgänge | `src/lib/loans/*` | Leihe, Terminleihe, Tausch, Geschenk, direkte Weitergabe, QR-Übergabe, Streitfall |
| Worker | `src/worker` | Fristenlauf (alle 10 Min.), E-Mail/SMS, Bildvarianten (AVIF/WebP), Titelalarm, Tauschtreffer |
| Datenbank | `db/migrations` | Postgres mit `btree_gist`-Kalender, `pg_trgm`, `earthdistance`, Warteschlange |
| Dateien | `src/lib/storage.ts` | Railway Storage Bucket, vorsignierte Uploads |
| Design-Tokens | `src/app/globals.css`, `src/styles/tokens.json` | Gemeinsam für Web und spätere iOS-App |

Die Regeln aus PRD Abschnitt 4 sind als Datenbank-Constraints umgesetzt: Kalenderüberschneidungen
(`23P01`), doppelte Anfragen (`23505`) und «aktiv ohne Übergabe» (`23514`) scheitern an Postgres.

## Lokal

```bash
cp .env.example .env
npm install
npm run migrate
SEED_CONFIRM=yes npm run seed   # Beispieldaten, nie in Produktion
npm run dev                     # Web auf :3000
npm run worker                  # Fristen, Mails, Bilder
npm test                        # Zustandsmaschine + Abläufe gegen Postgres (TEST_DATABASE_URL)
npm run tokens:check            # globals.css ↔ tokens.json
npm run a11y                    # axe gegen die laufende Instanz (Beispieldaten nötig)
```

Ohne Mail- und SMS-Anbieter zeigt `DEV_SHOW_CODES=true` den Anmeldelink und den SMS-Code direkt an.

## Railway

Projekt «Leihregal», Region EU (europe-west4 / ams):

- **Postgres** (Template `postgres`), **Bucket** `Dateien`
- **web**: Build `npm run build`, Start `node_modules/.bin/next start -p $PORT`, Pre-Deploy `npm run migrate`, Healthcheck `/api/v1/health`
- **worker**: Start `node_modules/.bin/tsx src/worker/index.ts` (wartet beim Start, bis alle Migrationen eingespielt sind)

Startbefehle direkt statt über `npm start`/`npm run worker`: npm meldet sonst bei jedem Deploy
«npm error … signal SIGTERM», obwohl der Prozess sauber beendet wird. Die Variable
`NPM_CONFIG_PRODUCTION` kann entfernt werden (erzeugt nur die Warnung «Use --omit=dev»).

Migrationen laufen je Datei in einer Transaktion. Für `CREATE INDEX CONCURRENTLY` beginnt die
Datei mit der Zeile `-- no-transaction`; dann laufen die Anweisungen (getrennt an «;» am Zeilenende)
einzeln. Solche Dateien müssen wiederholbar sein (`if not exists`).

Variablen pro Dienst (Referenzen statt kopierter Werte):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
S3_BUCKET=${{Dateien.BUCKET}}
S3_ENDPOINT=${{Dateien.ENDPOINT}}
S3_REGION=${{Dateien.REGION}}
S3_ACCESS_KEY_ID=${{Dateien.ACCESS_KEY_ID}}
S3_SECRET_ACCESS_KEY=${{Dateien.SECRET_ACCESS_KEY}}
APP_URL=https://<öffentliche Domain>
SMTP_URL=smtp://…        # E-Mail-Anbieter mit EU-Standort
MAIL_FROM="Leihregal <hallo@…>"
SMS_PROVIDER=webhook     # plus SMS_WEBHOOK_URL / SMS_WEBHOOK_TOKEN
DEV_SHOW_CODES=false     # in Produktion zwingend aus
GOOGLE_BOOKS_API_KEY=…   # nur auf «web»; «worker» referenziert ${{web.GOOGLE_BOOKS_API_KEY}}
COVERS=true              # Original-Cover (DNB, Open Library, Google Books)
ADMIN_EMAILS=…           # kommagetrennt; Admin beim nächsten Seitenaufruf, entfernt = Rolle wieder weg
```

Vor dem Start: Point-in-Time Recovery für Postgres aktivieren und eine Wiederherstellung üben (PRD 10.4).

## Designsystem

Haltung: Papier, Tinte, **eine** Akzentfarbe (sie gehört allein dem nächsten Schritt). Die Bücher liefern die Farbe.
Keine Schatten, keine Verläufe, Host Grotesk für Bedienung, Literata für Buchtitel.

**Eine Quelle.** `src/app/globals.css` (`@theme`) und `src/styles/tokens.json` (für iOS) tragen dieselben Werte;
`npm run tokens:check` vergleicht beide und läuft in der CI. `tests/design-lint.test.ts` lehnt Arbiträrwerte
(`text-[13.5px]`, `rounded-[10px]`, `font-[560]`, `duration-200`, `transition-all`, Schatten) ausserhalb einer
begründeten Allowlist (Cover, Buchrücken, QR-Ansicht) ab. `tests/contrast.test.ts` rechnet alle Text/Fläche-Paare
in hell und dunkel nach WCAG 2.2 AA.

| Schrift | Grösse (ab 768 px) | Verwendung |
| --- | --- | --- |
| `text-caption` | 12 | Marken, Achsen, Zähler |
| `text-meta` | 13 | Nebenangaben, Eyebrows |
| `text-body-sm` | 14 | Sekundärtext, kleine Knöpfe |
| `text-body` | 15 (16) | Fliesstext |
| `text-body-lg` | 16 | Eingabefelder (nie kleiner, sonst zoomt iOS) |
| `text-lead` | 17 | Einleitungen, Titel in Zeilen |
| `text-title-sm` | 20 | Zwischentitel |
| `text-title` | 24 (28) | Abschnittstitel, Kennzahlen |
| `text-display` | 32 (44) | Seitentitel |
| `text-hero` | 52 (68) | Bühne der Startseite |

Radien `rounded-xs 3 · sm 6 · md 10 · lg 12 · full`. Gewichte `font-medium · font-title (560) · font-semibold`.
Laufweiten `tracking-ui · title · display · caps · code`. Feldränder `border-field` (≥ 3:1), Haarlinien `border-line`.

### Bewegung

Tokens: `--dur-instant 90 ms` (Druck) · `--dur-fast 160 ms` (Chips, Austritt) · `--dur-base 240 ms` (Flächen) ·
`--dur-slow 420 ms` (Seitenübergang, Morph); `ease-out` (Eintritt), `ease-in` (Austritt), `ease-spring` (echte Feder
per `linear()`, Bezier als Rückfall).

Regeln:
- Animiert werden nur `transform`, `opacity`, `clip-path`, `background-size` – nie Layout.
- Austritt ≈ 70 % der Eintrittsdauer mit `ease-in` (`.anim-out`, `Presence` in `components/motion.tsx`).
- Staffelung nur über `.stagger > *` und die Variable `--i`: höchstens 8 Elemente, zusammen höchstens 240 ms. Keine Inline-Delays.
- Eintritt (`.anim-rise`) nur im ersten Sichtbereich oder als Antwort auf eine Handlung; darunter `.reveal`
  (`animation-timeline: view()`, ohne Unterstützung statisch). Listenzeilen animieren nicht.
- `prefers-reduced-motion`: Bewegung wird durch eine Überblendung ≤ 120 ms ersetzt; Marquee, Federn, Morphs, Zähler und Dauerbewegungen entfallen.
- Jede Animation beantwortet eine Frage: *Woher kommt das? Was hat sich geändert? Was ist als Nächstes dran?*

Die acht Signatur-Momente – genau diese, nicht mehr:
1. **Buch aus dem Regal ziehen:** das Cover wandert als gemeinsames Element in den Kopf der Detailseite (React `<ViewTransition>`, `CoverMorph` in `components/cover.tsx`; Name nur am Hauptregal einer Seite). Der Rest blendet 160 ms über.
2. **Die Übergabe:** Schritt füllt sich, Status blättert um, Stempel setzt auf, kurze Vibration (`celebrateHandover`). Der einzige feierliche Moment.
3. **Kalender:** Balken wachsen in Zeitreihenfolge, die Auswahl schnappt mit Feder, nur der Heute-Strich bewegt sich dauerhaft.
4. **Navigation:** eine Marke gleitet zum aktiven Eintrag (`NavRail`).
5. **Toasts:** Austritt nach unten, der Stapel rückt per `transform` nach, die Rückgängig-Frist läuft sichtbar ab.
6. **Zahlen:** Kennzahlen und Ungelesen-Marke rollen nur bei Live-Änderung (`RollingNumber`), nie beim Laden.
7. **Druck:** Knöpfe `scale(0.98)` (`.press`), Karten `translateY(1px)` (`.press-card`), das Buch setzt beim Drücken wieder auf.
8. **Skelett → Inhalt:** Überblendung; der Puls erscheint erst nach 300 ms.

Zugänglichkeit: `npm run a11y` prüft mit axe Start, Suche, Exemplar, Vorgang, Kreis und Einstellungen in hell/dunkel
und 390/1440 px gegen eine laufende Instanz mit Beispieldaten (CI-Job `a11y`).

## Gemeinschaft

Kreise haben neben Regal und Regeln einen Ort, an dem etwas passiert – ohne Follower, Direktnachrichten,
öffentliche Lese-Historie, Ranglisten, Abzeichen oder Streaks.

| Baustein | Tabellen (Migration `0022_gemeinschaft.sql`) | Code |
| --- | --- | --- |
| Pinnwand: Suche, Empfehlung, Ankündigung | `circle_posts`, `circle_post_reactions`, `circle_post_comments`, `circle_post_offers` | `lib/pinboard.ts`, `/api/v1/circles/:id/posts…`, SSE `/circles/:id/stream` |
| Wünsche im Kreis | `wishlist_items.share_circles` | `lib/wishlist.ts` (`wishersInMyCircles`, `circleHitsForWishlist`, `wantedInCircle`) |
| Weg eines Buches, Zettel im Buch | `book_notes` (Weg aus `loans` abgeleitet) | `lib/book-path.ts`, `/copies/:id/path`, `/copies/:id/notes`, `/loans/:id/note` |
| Puls | `users.pulse_show_new_books`, `users.pinboard_notify` | `lib/pulse.ts`, `/me/pulse` |
| Lesestand im Chat | `thread_reads` (`0023`) | `lib/chat.ts` (`markRead`, `threadReads`) |

Privatsphäre-Regeln (als Constraints und Trigger in der Datenbank, zusätzlich im Code):
- Pinnwand nur für aktive Mitglieder; Ankündigungen nur Admins; Empfehlungen nur mit eigenem Exemplar im Kreisregal.
- Blockierungen gelten überall: Inhalte Blockierter sind unsichtbar, Angebote und Antworten nicht möglich. Gesperrte Konten schreiben nicht.
- «Ich hab's» ist ein **Angebot**: die suchende Person stellt danach die normale Anfrage – kein Weg an der Zustandsmaschine vorbei.
- Genau zwei Reaktionen («Danke», «Will ich auch lesen»), Kommentare eine Ebene; der Preisfilter des Chats gilt auch hier.
- Zettel verschwinden nach 60 Tagen aus der Ansicht, Suchen sobald erfüllt.
- Der Weg eines Buches ist anonym: Gemeinde und Monat, keine Namen, keine genauen Daten, erst ab zwei abgeschlossenen Leihen.
- Zettel im Buch: nur die leihende Person, nur nach Abschluss, einer pro Leihe, mit Vorname oder anonym; die Besitzerin kann ausblenden, alle können melden.
- Der Puls zeigt nur Aggregiertes («7 Bücher gewandert») oder selbst Veröffentlichtes – nie «X hat Y von Z geliehen». Neue eigene Bücher lassen sich in den Einstellungen ausnehmen.
- Gewünschte Titel sind nur sichtbar, wenn der Wunsch ausdrücklich «im Kreis gezeigt» wird; Namen sieht nur, wer das Buch besitzt, und erst nach Antippen.
- Datenexport und Kontolöschung (`lib/account.ts`) umfassen alle neuen Tabellen; Zettel im Buch bleiben anonymisiert beim Buch.

## Offene Entscheide (PRD 14)

Name und Domain, Startregion und Schwelle, E-Mail- und SMS-Anbieter, Cover-Lizenzen
(`COVERS_OPENLIBRARY`), rechtliche Prüfung von Nutzungsbedingungen und Datenschutzerklärung
(als Entwurf unter `/nutzungsbedingungen` und `/datenschutz`).
