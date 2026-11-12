import type { ReactNode } from "react";
import { getLocale } from "@/lib/i18n/server";
import { PUBLIC } from "@/lib/i18n/messages/public";
import { sql } from "@/lib/db";
import { BookRow, type BookRowItem } from "@/components/regal/book-row";

/**
 * Geteilte Bühne für Anmelden und Einrichten.
 * Desktop: links eine helle Fläche mit Titel, drei Schritten, Zahlen und einem Regal mit echten Covern,
 * rechts das Formular. Mobil: zuerst das Formular, darunter Schritte und Regal.
 */

// Zierreihe, solange die Region noch wenig Bestand hat (dekorativ, Cover aus Titel und Autor)
const CLASSICS: [string, string][] = [
  ["Homo faber", "Max Frisch"], ["Der Process", "Franz Kafka"], ["Effi Briest", "Theodor Fontane"], ["Die Physiker", "Friedrich Dürrenmatt"],
  ["Siddhartha", "Hermann Hesse"], ["Momo", "Michael Ende"], ["Der grüne Heinrich", "Gottfried Keller"], ["Heidi", "Johanna Spyri"],
];

const STEPS: [string, string][] = [
  ["Finden", "Bücher aus Regalen in deiner Nähe, mit Entfernung und Verfügbarkeit."],
  ["Anfragen", "Zeitraum wählen. Die Antwort kommt innert 72 Stunden."],
  ["Übergeben", "Ein Scan beim Treffen startet die Leihe, einer beendet sie."],
];

async function stageData(): Promise<{ books: BookRowItem[]; copies: number; members: number }> {
  try {
    const [[stats], rows] = await Promise.all([
      sql<{ copies: number; members: number }[]>`
        select (select count(*)::int from copies c join users u on u.id = c.owner_id where c.removed_at is null and cardinality(c.offers) > 0 and c.visibility = 'all' and u.deleted_at is null) as copies,
               (select count(*)::int from users where onboarded_at is not null and deleted_at is null) as members`,
      sql<{ work_id: string; title: string; authors: string[]; cover_key: string | null }[]>`
        select distinct on (w.id) w.id as work_id, w.title, w.authors, e.cover_key
          from works w join editions e on e.work_id = w.id join copies c on c.edition_id = e.id
         where c.removed_at is null and cardinality(c.offers) > 0 and c.visibility = 'all'
         order by w.id, (e.cover_key is null), c.created_at desc
         limit 24`,
    ]);
    const real: BookRowItem[] = rows
      .sort((a, b) => Number(!!b.cover_key) - Number(!!a.cover_key))
      .slice(0, 10)
      .map((r) => ({ id: r.work_id, work_id: r.work_id, title: r.title, authors: r.authors, cover_key: r.cover_key, photo_key: null, photo_w: null, photo_h: null, href: `/titel/${r.work_id}` }));
    const books = real.length >= 5 ? real : CLASSICS.map(([t, a], i) => ({
      id: `c${i}`, work_id: `classic-${i}`, title: t, authors: [a], cover_key: null, photo_key: null, photo_w: null, photo_h: null, href: "/suche",
    }));
    return { books, copies: stats.copies, members: stats.members };
  } catch {
    return { books: [], copies: 0, members: 0 };
  }
}

export async function AuthStage({ eyebrow, title, lead, steps, children }: { eyebrow: string; title: ReactNode; lead: ReactNode; steps?: [string, string][]; children: ReactNode }) {
  const { books, copies, members } = await stageData();
  const l = await getLocale();
  const a = PUBLIC[l].auth;
  steps ??= l === "de" ? STEPS : a.steps;

  return (
    <div className="full-bleed -mt-10 md:-mt-16 -mb-10 md:-mb-16 flex flex-col lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:min-h-[calc(100dvh-4rem)]">
      {/* ----------------------------------------------------------- Bühne */}
      <aside className="order-2 lg:order-none bg-paper-2 border-t lg:border-t-0 lg:border-r border-line flex flex-col min-w-0" aria-label="Leihregal">
        <div className="px-4 md:px-10 xl:px-16 pt-10 lg:pt-16 xl:pt-20 max-w-[760px]">
          <p className="inline-flex items-center gap-2 h-8 px-3 rounded-[6px] bg-paper border border-line text-[13px] font-medium text-ink-2 anim-rise">
            <span className="h-1.5 w-1.5 rounded-full bg-accent live-dot" /> {eyebrow}
          </p>
          <p className="display text-[32px] md:text-[44px] xl:text-[52px] mt-6 anim-rise" style={{ animationDelay: "60ms" }}>{title}</p>
          <p className="mt-4 text-ink-2 text-[16px] leading-relaxed max-w-lg anim-rise" style={{ animationDelay: "100ms" }}>{lead}</p>

          <ol className="mt-8 grid sm:grid-cols-3 gap-2 anim-rise" style={{ animationDelay: "140ms" }}>
            {steps.map(([t, d], i) => (
              <li key={t} className="rounded-[10px] bg-paper border border-line p-4">
                <span className="text-[12px] tnum text-accent-hover font-medium">0{i + 1}</span>
                <p className="font-medium text-[15px] mt-2">{t}</p>
                <p className="text-[13px] text-muted mt-1 leading-snug">{d}</p>
              </li>
            ))}
          </ol>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 anim-rise" style={{ animationDelay: "180ms" }}>
            {([[copies, a.stats.books], [members, a.stats.members], ["0.–", a.stats.fee]] as const).map(([n, l]) => (
              <div key={l} className="flex flex-col-reverse">
                <dt className="text-[12.5px] text-muted mt-1">{l}</dt>
                <dd className="text-[26px] font-[560] tracking-[-0.04em] leading-none tnum">{n}</dd>
              </div>
            ))}
          </dl>
        </div>

        {books.length > 0 && (
          <div className="mt-auto px-4 md:px-10 xl:px-16 pt-10 pb-10 lg:pb-14">
            <div className="surface-night rounded-[12px] px-5 md:px-6 pt-5 pb-3 anim-rise" style={{ animationDelay: "220ms" }}>
              <p className="text-[12.5px] text-night-muted mb-1">{a.inShelves}</p>
              <BookRow l={l} items={books} height={138} label={a.inShelvesAria} />
            </div>
          </div>
        )}
      </aside>

      {/* ---------------------------------------------------------------- Formular */}
      <div className="order-1 lg:order-none px-4 md:px-10 pt-9 pb-12 lg:py-16 flex lg:items-center justify-center">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}

export { AuthHead } from "./head";
