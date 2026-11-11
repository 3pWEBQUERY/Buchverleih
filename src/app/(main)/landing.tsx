import Link from "next/link";
import { sql } from "@/lib/db";
import { PlzExplorer } from "./plz-explorer";

/**
 * Startseite abgemeldet (PRD 8.4): Echte Bücher aus der Region statt Werbetext,
 * Postleitzahl eingeben und Bestand sehen. Kein Hero mit Feature-Kacheln (PRD 8.2).
 */
export async function Landing() {
  const [stats] = await sql<{ copies: number; members: number; places: number }[]>`
    select (select count(*)::int from copies c join users u on u.id = c.owner_id where c.removed_at is null and cardinality(c.offers) > 0 and c.visibility = 'all' and u.deleted_at is null) as copies,
           (select count(*)::int from users where onboarded_at is not null and deleted_at is null) as members,
           (select count(distinct municipality)::int from users where onboarded_at is not null and deleted_at is null) as places`;
  return (
    <div>
      <section className="grid md:grid-cols-12 gap-x-10 gap-y-8 items-end pb-10 md:pb-14 border-b border-line">
        <h1 className="display md:col-span-8 text-[44px] leading-[0.95] sm:text-6xl md:text-7xl lg:text-[88px] anim-rise">
          Das Buch, das du suchst, steht vielleicht <em className="italic">zwei Strassen weiter.</em>
        </h1>
        <div className="md:col-span-4 text-ink-2 text-[17px] leading-relaxed anim-rise" style={{ animationDelay: "60ms" }}>
          <p>
            Leihregal verbindet die Bücherregale einer Nachbarschaft. Du leihst, was andere schon gelesen haben, und verleihst, was bei dir nur steht.
            Kostenlos, mit festen Fristen und einer Bestätigung bei jeder Übergabe.
          </p>
        </div>
      </section>

      <PlzExplorer />

      <section className="mt-16 md:mt-24 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <p className="eyebrow">So läuft eine Leihe</p>
          <p className="mt-3 text-ink-2">Jeder Schritt hat eine Frist und eine Folge. Niemand muss nachfragen, wer gerade am Zug ist.</p>
        </div>
        <ol className="md:col-span-8 divide-y divide-line border-y border-line">
          {[
            ["Anfragen", "Du wählst ein Exemplar und einen Zeitraum. Die Person, der das Buch gehört, hat 72 Stunden für eine Antwort."],
            ["Übergeben", "Ihr trefft euch am vereinbarten Ort. Du scannst den Code auf dem anderen Handy, die Leihfrist beginnt."],
            ["Lesen", "Standard sind 4 Wochen. Eine Verlängerung um 14 Tage geht mit einem Tipp, wenn danach niemand wartet."],
            ["Zurückgeben", "Diesmal zeigst du den Code. Nach dem Scan ist das Buch wieder im Regal – und du in der Statistik pünktlich."],
          ].map(([t, d], i) => (
            <li key={t} className="grid grid-cols-[3rem_1fr] md:grid-cols-[4rem_10rem_1fr] gap-x-4 gap-y-1 py-5">
              <span className="font-serif text-3xl leading-none text-muted tnum">{i + 1}</span>
              <span className="font-serif text-xl">{t}</span>
              <span className="col-start-2 md:col-start-3 text-ink-2">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 md:mt-24 grid grid-cols-3 gap-px bg-line border-y border-line">
        {[
          [stats.copies, "Bücher zum Leihen"],
          [stats.members, "Mitglieder"],
          [stats.places, "Gemeinden"],
        ].map(([n, l]) => (
          <div key={String(l)} className="bg-paper py-6 px-3 md:px-6 first:pl-0">
            <div className="font-serif text-4xl md:text-5xl tnum">{n}</div>
            <div className="text-muted mt-1 text-sm md:text-base">{l}</div>
          </div>
        ))}
      </section>

      <section className="mt-16 md:mt-24 grid md:grid-cols-12 gap-10 items-start">
        <h2 className="md:col-span-5 text-3xl md:text-4xl">Für Lesekreise, Hausgemeinschaften und Büros.</h2>
        <div className="md:col-span-7 text-ink-2 space-y-4">
          <p>
            Ein Kreis ist ein geschlossenes Regal für eine Gruppe. Die Bücher sind nur für Mitglieder sichtbar, Anfragen werden auf Wunsch automatisch angenommen,
            und die Leihfrist legt ihr gemeinsam fest. Leihen im Kreis zählen nicht gegen die Grenzen für neue Mitglieder.
          </p>
          <Link href="/anmelden?next=/kreise/neu" className="inline-flex items-center gap-2 font-medium text-ink underline underline-offset-4">
            Kreis gründen
          </Link>
        </div>
      </section>
    </div>
  );
}
