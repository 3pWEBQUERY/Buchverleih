import type { ReactNode } from "react";
import { sql } from "@/lib/db";
import { Spine } from "@/components/spine";

/**
 * Geteilte Bühne für Anmelden und Einrichten.
 * Desktop: links eine dunkle Fläche mit grossem Titel und einem ruhigen Regal aus Buchrücken,
 * rechts das Formular. Mobil: ein schmales Regalband oben, darunter sofort das Formular.
 */

// Zierreihe, solange die Region noch wenig Bestand hat (dekorativ)
const CLASSICS: [string, string][] = [
  ["Homo faber", "Max Frisch"], ["Der Process", "Franz Kafka"], ["Effi Briest", "Theodor Fontane"], ["Die Physiker", "Friedrich Dürrenmatt"],
  ["Siddhartha", "Hermann Hesse"], ["Momo", "Michael Ende"], ["Der grüne Heinrich", "Gottfried Keller"], ["Heidi", "Johanna Spyri"],
  ["Schachnovelle", "Stefan Zweig"], ["Die Wand", "Marlen Haushofer"], ["Stiller", "Max Frisch"], ["Der Zauberberg", "Thomas Mann"],
  ["Middlemarch", "George Eliot"], ["Woyzeck", "Georg Büchner"], ["Buddenbrooks", "Thomas Mann"], ["Der Steppenwolf", "Hermann Hesse"],
  ["Wilhelm Tell", "Friedrich Schiller"], ["Frankenstein", "Mary Shelley"], ["Il Gattopardo", "Tomasi di Lampedusa"], ["Mrs Dalloway", "Virginia Woolf"],
];

async function shelfTitles(): Promise<{ spines: [string, string][]; copies: number; members: number }> {
  try {
    const [[stats], titles] = await Promise.all([
      sql<{ copies: number; members: number }[]>`
        select (select count(*)::int from copies c join users u on u.id = c.owner_id where c.removed_at is null and cardinality(c.offers) > 0 and c.visibility = 'all' and u.deleted_at is null) as copies,
               (select count(*)::int from users where onboarded_at is not null and deleted_at is null) as members`,
      sql<{ title: string; author: string | null }[]>`
        select w.title, w.authors[1] as author from works w
         where exists (select 1 from editions e join copies c on c.edition_id = e.id where e.work_id = w.id and c.removed_at is null)
         order by w.created_at desc limit 28`,
    ]);
    const real = titles.map((t) => [t.title, t.author ?? ""] as [string, string]);
    return { spines: real.length >= 14 ? real : CLASSICS, copies: stats.copies, members: stats.members };
  } catch {
    return { spines: CLASSICS, copies: 0, members: 0 };
  }
}

export async function AuthStage({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead: ReactNode; children: ReactNode }) {
  const { spines, copies, members } = await shelfTitles();
  const row = [...spines, ...spines].slice(0, 30);

  return (
    <div className="full-bleed -mt-10 md:-mt-16 -mb-10 md:-mb-16 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:min-h-[calc(100dvh-4rem)]">
      {/* ----------------------------------------------------------- Bühne (Desktop) */}
      <aside className="surface-night relative overflow-hidden hidden lg:flex flex-col" aria-label="Leihregal">
        <div className="px-10 xl:px-16 pt-16 xl:pt-20 max-w-[720px]">
          <p className="inline-flex items-center gap-2 h-8 px-3.5 rounded-full border border-night-line text-[13px] font-medium text-night-muted anim-rise">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] live-dot" /> {eyebrow}
          </p>
          <p className="display text-[76px] xl:text-[96px] mt-8 anim-rise" style={{ animationDelay: "60ms" }}>{title}</p>
          <p className="mt-7 text-night-muted text-[17px] leading-relaxed max-w-md anim-rise" style={{ animationDelay: "120ms" }}>{lead}</p>
          <dl className="mt-10 flex gap-10 anim-rise" style={{ animationDelay: "170ms" }}>
            {([[copies, "Bücher im Umlauf"], [members, "Mitglieder"], ["0", "CHF Gebühr"]] as const).map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-serif text-[44px] leading-none tnum">{n}</dd>
                <dd className="text-[13px] text-night-muted mt-1.5">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-auto pt-14" aria-hidden>
          <div className="flex items-end gap-[6px] px-6 overflow-hidden" style={{ height: 236 }}>
            {row.map(([t, a], i) => (
              <div key={i} className="anim-cover" style={{ animationDelay: `${200 + Math.min(i, 16) * 25}ms` }}>
                <Spine title={t} author={a} height={226} />
              </div>
            ))}
          </div>
          <div className="h-[6px] bg-night-ink/90" />
        </div>
      </aside>

      {/* ------------------------------------------------------- Regalband (Mobil) */}
      <div className="lg:hidden px-4 md:px-10 pt-4" aria-hidden>
        <div className="surface-night rounded-[18px] overflow-hidden">
          <p className="eyebrow !text-night-muted px-5 pt-4">{eyebrow}</p>
          <div className="mt-3 overflow-hidden" style={{ height: 96 }}>
            {/* in voller Grösse gesetzt und verkleinert, damit die Proportionen dem Desktop-Regal entsprechen */}
            <div className="flex items-end gap-[8px] px-8" style={{ height: 192, width: "200%", transform: "scale(0.5)", transformOrigin: "top left" }}>
              {row.slice(0, 24).map(([t, a], i) => <Spine key={i} title={t} author={a} height={186} />)}
            </div>
          </div>
          <div className="h-[4px] bg-night-ink/90" />
        </div>
      </div>

      {/* ---------------------------------------------------------------- Formular */}
      <div className="px-4 md:px-10 pt-9 pb-14 lg:py-16 flex lg:items-center justify-center">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  );
}

/** Kopf der Formularspalte */
export function AuthHead({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-9 anim-rise">
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h1 className="display text-[48px] md:text-[60px]">{title}</h1>
      {children && <p className="text-ink-2 text-[16px] md:text-[17px] leading-relaxed mt-4">{children}</p>}
    </header>
  );
}
