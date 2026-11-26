import Link from "next/link";
import type { CircleOverview } from "@/lib/circle-overview";
import { BookRow } from "@/components/regal/book-row";
import { Cover } from "@/components/cover";
import { dayToDate, dueDay, fmtDay, relDays, todayCH } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/locale";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { cx } from "@/components/ui";

/**
 * «Auf einen Blick» oben auf der Kreisseite: neu im Regal, gesuchte Titel mit Treffer im Kreis,
 * eigene Übergaben der nächsten Tage. Leere Blöcke fallen weg; ist alles leer, fehlt der Abschnitt.
 */
export function CircleGlance({ data, me, l }: { data: CircleOverview; me: string; l: Locale }) {
  const t = CIRCLES[l];
  const g = t.glance;
  const d = t.detail;
  if (!data.new.length && !data.wanted.length && !data.handovers.length) return null;
  const side = [data.wanted.length > 0, data.handovers.length > 0].filter(Boolean).length;
  const today = todayCH();

  return (
    <section aria-labelledby="blick-t" className="mb-8 md:mb-10 anim-rise">
      <h2 id="blick-t" className="eyebrow">{g.title}</h2>
      <div className="mt-3 space-y-3">
        {data.new.length > 0 && (
          <div className="surface-night rounded-lg px-5 md:px-7 pt-5 md:pt-6 pb-3 md:pb-4">
            <h3 className="text-title-sm font-title tracking-title leading-none">{g.newTitle}</h3>
            <p className="text-meta text-night-muted mt-1.5">{g.newDesc}</p>
            <div className="mt-4">
              <BookRow
                label={g.newTitle}
                height={132}
                l={l}
                items={data.new.map((c) => ({
                  ...c,
                  href: `/exemplar/${c.id}`,
                  note: { tone: c.lent_until ? "lent" : "ok", text: `${c.lent_until ? d.until(fmtDay(dayToDate(dueDay(c.lent_until)), l)) : d.freeNote} · ${c.owner_id === me ? d.yourBook : c.owner_name}` },
                }))}
              />
            </div>
          </div>
        )}

        {side > 0 && (
          <div className={cx("grid gap-3", side === 2 && "md:grid-cols-2")}>
            {data.wanted.length > 0 && (
              <div className="rounded-md border border-line p-5 min-w-0">
                <h3 className="text-title-sm font-title tracking-title">{g.wantedTitle}</h3>
                <p className="text-body-sm text-muted mt-1">{g.wantedDesc}</p>
                <ul className="mt-4 divide-y divide-line">
                  {data.wanted.map((w) => (
                    <li key={w.work_id}>
                      <Link href={`/exemplar/${w.copy_id}`} className="group flex items-center gap-3 py-2.5 min-h-11">
                        <span className="flex-none"><Cover l={l} width={32} height={48} uniform data={{ title: w.title, authors: w.authors, coverKey: w.cover_key, seed: w.work_id }} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-serif leading-snug truncate group-hover:underline underline-offset-4">{w.title}</span>
                          <span className="block text-meta text-muted truncate">{w.mine ? g.wantedYou : g.wantedHas(w.owner_name)} · {g.wantedCount(w.count)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.handovers.length > 0 && (
              <div className="rounded-md border border-line p-5 min-w-0">
                <h3 className="text-title-sm font-title tracking-title">{g.handoverTitle}</h3>
                <p className="text-body-sm text-muted mt-1">{g.handoverDesc}</p>
                <ul className="mt-4 divide-y divide-line">
                  {data.handovers.map((h) => {
                    const what = h.kind === "handover"
                      ? (h.role === "owner" ? g.giveTo(h.other_name) : g.getFrom(h.other_name))
                      : (h.role === "owner" ? g.returnFrom(h.other_name) : g.returnTo(h.other_name));
                    const late = h.day < today;
                    return (
                      <li key={h.loan_id}>
                        <Link href={`/vorgaenge/${h.loan_id}`} className="group flex items-center gap-3 py-2.5 min-h-11">
                          <span className="flex-none"><Cover l={l} width={32} height={48} uniform data={{ title: h.title, authors: h.authors, coverKey: h.cover_key, coverColor: h.cover_color, photoKey: h.photo_key, photoColor: h.photo_color, seed: h.work_id }} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-serif leading-snug truncate group-hover:underline underline-offset-4">{h.title}</span>
                            <span className="block text-meta text-muted truncate">{what}</span>
                          </span>
                          <span className={cx("flex-none text-meta tnum text-right", late ? "text-late font-medium" : "text-ink-2")}>
                            {fmtDay(dayToDate(h.day), l)}
                            <span className="block text-caption text-muted">{relDays(h.day, today, l)}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
