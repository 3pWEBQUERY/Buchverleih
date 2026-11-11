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
```

Ohne Mail- und SMS-Anbieter zeigt `DEV_SHOW_CODES=true` den Anmeldelink und den SMS-Code direkt an.

## Railway

Projekt «Leihregal», Region EU (europe-west4 / ams):

- **Postgres** (Template `postgres`), **Bucket** `Dateien`
- **web**: Build `npm run build`, Start `npm start`, Pre-Deploy `npm run migrate`, Healthcheck `/api/v1/health`
- **worker**: Start `npm run worker`

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
```

Vor dem Start: Point-in-Time Recovery für Postgres aktivieren und eine Wiederherstellung üben (PRD 10.4).

## Offene Entscheide (PRD 14)

Name und Domain, Startregion und Schwelle, E-Mail- und SMS-Anbieter, Cover-Lizenzen
(`COVERS_OPENLIBRARY`), rechtliche Prüfung von Nutzungsbedingungen und Datenschutzerklärung
(als Entwurf unter `/nutzungsbedingungen` und `/datenschutz`).
