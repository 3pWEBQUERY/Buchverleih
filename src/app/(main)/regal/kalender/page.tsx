import Link from "next/link";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listShelf } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { CalendarView } from "@/components/calendar";
import { Cover } from "@/components/cover";
import { StatusText, shelfStatusText } from "@/components/status";
import { Empty, LinkButton, PageTitle } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";

export const metadata = { title: "Verleihkalender" };

const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, var(--line-strong) 0 1px, transparent 1px 5px)" };

/** Gesamtansicht über das ganze Regal (PRD 4.8): eine Zeitachse pro Exemplar. */
export default async function Page() {
  const user = await pageUser("/regal/kalender");
  const copies = await listShelf(user.id);
  const rows = (await Promise.all(copies.map(async (c) => ({ copy: c, cal: await getCalendar(sql, c.id, user.id) }))))
    .filter((r): r is { copy: (typeof copies)[number]; cal: NonNullable<typeof r.cal> } => r.cal !== null)
    .sort((a, b) => Number(b.cal.bars.length > 0) - Number(a.cal.bars.length > 0) || a.copy.title.localeCompare(b.copy.title, "de"));
  const busy = rows.filter((r) => r.cal.bars.length > 0).length;

  return (
    <div>
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Mein Regal
      </Link>
      <PageTitle
        sub={rows.length ? `${rows.length} ${rows.length === 1 ? "Buch" : "Bücher"}, davon ${busy} mit Leihen, Buchungen oder Sperrzeiten.` : undefined}
        aside={rows.length > 0 && (
          <div className="grid grid-cols-2 gap-2 anim-rise" style={{ animationDelay: "80ms" }}>
            {([[rows.length, rows.length === 1 ? "Buch" : "Bücher"], [busy, "mit Terminen"]] as [number, string][]).map(([n, l]) => (
              <div key={l} className="panel-quiet px-5 py-4 min-w-[124px]">
                <p className="font-serif text-[40px] leading-none tnum">{n}</p>
                <p className="text-[13px] text-muted mt-1.5">{l}</p>
              </div>
            ))}
          </div>
        )}
      >
        Verleih<em>kalender</em>
      </PageTitle>

      {rows.length === 0 ? (
        <Empty text="Noch keine Bücher, also auch keine Termine." action={<LinkButton href="/regal/neu" variant="primary">Erstes Buch scannen</LinkButton>} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5" aria-label="Legende">
            <span className="chip"><span className="h-2.5 w-4 rounded-[3px] bg-lent" /> ausgeliehen</span>
            <span className="chip"><span className="h-2.5 w-4 rounded-[3px] bg-wait" /> gebucht</span>
            <span className="chip"><span className="h-2.5 w-4 rounded-[3px]" style={HATCH} /> Puffer</span>
            <span className="chip"><span className="h-2.5 w-4 rounded-[3px] bg-paper-3 border border-line-strong" /> gesperrt</span>
            <span className="chip"><span className="h-2.5 w-4 rounded-[3px] bg-paper border border-line" /> ausserhalb des Buchungshorizonts</span>
          </div>
          <ul className="panel !rounded-[18px] divide-y divide-line overflow-hidden">
            {rows.map(({ copy, cal }, i) => {
              const st = shelfStatusText(copy);
              return (
                <li key={copy.id} className="px-4 md:px-6 py-4 md:py-5 md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-8 md:items-center anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  <Link href={`/regal/${copy.id}`} className="group mb-3 md:mb-0 min-w-0 flex items-center gap-3.5">
                    <Cover data={{ title: copy.title, authors: copy.authors, photoKey: copy.photo_key, photoW: copy.photo_w, photoH: copy.photo_h, coverKey: copy.cover_key, seed: copy.work_id }} height={56} />
                    <span className="min-w-0">
                      <span className="block font-serif text-[19px] leading-tight group-hover:underline underline-offset-4 decoration-1 line-clamp-2">{copy.title}</span>
                      <StatusText tone={st.tone} className="text-muted mt-1">{st.text}</StatusText>
                    </span>
                  </Link>
                  <div className="min-w-0">
                    <CalendarView cal={cal} compact showLegend={false} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
