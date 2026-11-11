import Link from "next/link";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listShelf } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { CalendarView } from "@/components/calendar";
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
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6 md:mb-8">
        <IconArrowLeft width={16} height={16} /> Mein Regal
      </Link>
      <PageTitle sub={rows.length ? `${rows.length} ${rows.length === 1 ? "Buch" : "Bücher"}, davon ${busy} mit Leihen, Buchungen oder Sperrzeiten.` : undefined}>
        Verleihkalender
      </PageTitle>

      {rows.length === 0 ? (
        <Empty text="Noch keine Bücher, also auch keine Termine." action={<LinkButton href="/regal/neu" variant="primary">Erstes Buch scannen</LinkButton>} />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted pb-3 border-b border-line">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-lent" /> ausgeliehen</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-wait" /> gebucht</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs" style={HATCH} /> Puffer</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-paper-3 border border-line-strong" /> gesperrt</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-xs bg-paper-2 border border-line" /> ausserhalb des Buchungshorizonts</span>
          </div>
          <ul className="divide-y divide-line border-b border-line">
            {rows.map(({ copy, cal }) => {
              const st = shelfStatusText(copy);
              return (
                <li key={copy.id} className="py-4 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-6 md:items-center">
                  <div className="mb-2 md:mb-0 min-w-0 flex md:block items-baseline justify-between gap-4">
                    <Link href={`/regal/${copy.id}`} className="font-serif text-[17px] leading-snug hover:underline line-clamp-2">{copy.title}</Link>
                    <StatusText tone={st.tone} className="text-muted md:mt-1 flex-none">{st.text}</StatusText>
                  </div>
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
