import Link from "next/link";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listShelf } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { addDays, todayCH } from "@/lib/dates";
import { CalendarAxis, CalendarView } from "@/components/calendar";
import { Cover } from "@/components/cover";
import { shelfStatusText } from "@/components/status";
import { LinkButton, PageTitle, cx } from "@/components/ui";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";

export const metadata = { title: "Verleihkalender" };

const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, var(--line-strong) 0 1px, transparent 1px 6px)" };
const DOT = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" } as const;

/** Gesamtansicht über das ganze Regal (PRD 4.8): eine gemeinsame Zeitachse, eine Spur pro Exemplar. */
export default async function Page() {
  const user = await pageUser("/regal/kalender");
  const copies = await listShelf(user.id);
  const rows = (await Promise.all(copies.map(async (c) => ({ copy: c, cal: await getCalendar(sql, c.id, user.id) }))))
    .filter((r): r is { copy: (typeof copies)[number]; cal: NonNullable<typeof r.cal> } => r.cal !== null)
    .sort((a, b) => a.copy.title.localeCompare(b.copy.title, "de"));
  const busy = rows.filter((r) => r.cal.bars.length > 0);
  const idle = rows.filter((r) => r.cal.bars.length === 0);

  const today = todayCH();
  const lentNow = busy.filter((r) => r.cal.bars.some((b) => b.kind === "loan" && b.start <= today && (!b.end || today < b.end))).length;
  const booked = busy.reduce((n, r) => n + r.cal.bars.filter((b) => b.kind === "loan" && b.start > today).length, 0);
  const start = addDays(today, -7);
  const end = addDays(rows.reduce((m, r) => (r.cal.horizonEnd > m ? r.cal.horizonEnd : m), addDays(today, 30)), 7);

  return (
    <div>
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Mein Regal
      </Link>
      <PageTitle
        eyebrow="Mein Regal"
        sub="Alle Leihen, Buchungen und Sperrzeiten deiner Bücher auf einer gemeinsamen Zeitachse. Ein Tippen auf ein Buch öffnet seinen Kalender."
        aside={rows.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={rows.length} label={rows.length === 1 ? "Buch" : "Bücher"} />
            <StatTile n={lentNow} label="gerade weg" href={busy.length ? "#belegung" : null} />
            <StatTile n={booked} label="vorgemerkt" href={busy.length ? "#belegung" : null} />
          </dl>
        )}
      >
        Verleihkalender. <em>Alles auf einen Blick.</em>
      </PageTitle>

      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line-strong p-6 md:p-8 flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-[17px] font-medium">Noch keine Bücher, also auch keine Termine.</p>
            <p className="text-[14.5px] text-muted mt-0.5">Sobald du Bücher erfasst und verleihst, erscheint hier ihre Belegung.</p>
          </div>
          <LinkButton href="/regal/neu" variant="primary">Erstes Buch erfassen</LinkButton>
        </div>
      ) : (
        <>
          <StepSection id="belegung" n={1} first title="Belegung" aside={`${busy.length} ${busy.length === 1 ? "Buch" : "Bücher"} mit Terminen`}
            desc={busy.length ? "Ausgeliehen, gebucht, Puffer und eigene Sperrzeiten. Namen siehst nur du." : "Gerade hat keines deiner Bücher Leihen, Buchungen oder Sperrzeiten."}>
            {busy.length > 0 && (
              <div className="rounded-[10px] border border-line overflow-hidden">
                {/* Gemeinsame Achse */}
                <div className="grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 px-4 md:px-5 pt-4 pb-2 bg-paper-2/60 border-b border-line">
                  <p className="hidden md:block self-end pb-1 text-[12px] text-muted">Buch</p>
                  <CalendarAxis start={start} end={end} today={today} />
                </div>
                <ul className="divide-y divide-line">
                  {busy.map(({ copy, cal }, i) => {
                    const st = shelfStatusText(copy);
                    return (
                      <li key={copy.id} className="px-4 md:px-5 py-3.5 md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 md:items-center anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                        <Link href={`/regal/${copy.id}`} className="group mb-2.5 md:mb-0 min-w-0 flex items-center gap-3">
                          <Cover data={{ title: copy.title, authors: copy.authors, photoKey: copy.photo_key, photoW: copy.photo_w, photoH: copy.photo_h, coverKey: copy.cover_key, seed: copy.work_id }} width={32} height={48} uniform />
                          <span className="min-w-0">
                            <span className="block font-serif text-[16px] leading-tight group-hover:underline underline-offset-4 decoration-1 truncate">{copy.title}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted truncate">
                              <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", DOT[st.tone])} />{st.text}
                            </span>
                          </span>
                        </Link>
                        <div className="min-w-0">
                          <CalendarView cal={cal} compact bare fit showLegend={false} range={{ start, end }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 md:px-5 py-3 border-t border-line bg-paper-2/60 text-[12.5px] text-muted" aria-label="Legende">
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] bg-lent" /> ausgeliehen</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] bg-wait" /> gebucht</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] bg-ok/[0.12]" /> frei</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px]" style={HATCH} /> Puffer</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[3px] border border-line-strong" style={HATCH} /> gesperrt</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[2px] bg-accent" /> heute</span>
                </div>
              </div>
            )}
          </StepSection>

          {idle.length > 0 && (
            <StepSection id="frei" n={2} title="Ohne Termine" aside={`${idle.length} ${idle.length === 1 ? "Buch" : "Bücher"}`}
              desc="Diese Bücher sind bis zum Buchungshorizont frei. Sperrzeiten legst du im Kalender des Buchs fest.">
              <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {idle.map(({ copy, cal }) => (
                  <li key={copy.id}>
                    <Link href={`/regal/${copy.id}#kalender`} className="group rounded-[10px] border border-line p-3 flex items-center gap-3 hover:border-accent transition-colors">
                      <Cover data={{ title: copy.title, authors: copy.authors, photoKey: copy.photo_key, photoW: copy.photo_w, photoH: copy.photo_h, coverKey: copy.cover_key, seed: copy.work_id }} width={32} height={48} uniform />
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif text-[16px] leading-tight truncate">{copy.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ok"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />Frei · Leihfrist {cal.loanDays} Tage</span>
                      </span>
                      <IconArrowRight width={15} height={15} className="flex-none text-accent-hover opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </StepSection>
          )}
        </>
      )}
    </div>
  );
}
