import { bookPath, notesForCopy } from "@/lib/book-path";
import { fmtMonthYear } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/locale";
import { COMMUNITY } from "@/lib/i18n/messages/community";
import { cx } from "@/components/ui";
import { NoteActions } from "@/components/book-note";

const month = (ym: string, l: Locale) => fmtMonthYear(new Date(`${ym}-15T12:00:00Z`), l);

/**
 * Der Weg eines Buches (#weg) und die Zettel im Buch. Aus abgeschlossenen Leihen abgeleitet und
 * bewusst anonym: Gemeinde und Monat, keine Namen, keine genauen Daten. Erst ab zwei Leihen.
 * Die Zettel sind Leihregals Antwort auf Rezensionen: kein Urteil über Menschen, etwas, das beim Buch bleibt.
 */
export async function BookPathSection({ copyId, viewerId, own, l }: { copyId: string; viewerId: string | null; own: boolean; l: Locale }) {
  const [path, notes] = await Promise.all([bookPath(copyId), notesForCopy(copyId, viewerId)]);
  if (!path && notes.length === 0) return null;
  const t = COMMUNITY[l];
  return (
    <section id="weg" aria-labelledby="weg-t" className="reveal mt-10 scroll-mt-28">
      <h3 id="weg-t" className="eyebrow mb-3">{t.path.eyebrow}</h3>
      {path && (
        <div className="rounded-md border border-line p-5 md:p-6">
          <p className="text-body-lg text-ink max-w-2xl">{t.path.summary(path.hands, path.municipalities, month(path.since, l))}</p>
          {/* Linie mit Stationen wie die Zeitachse eines Vorgangs: mobil senkrecht, ab md waagrecht */}
          <ol aria-label={t.path.stations} className="mt-5 flex flex-col md:flex-row md:overflow-x-auto md:pb-1">
            {path.stations.map((s, i) => {
              const last = i === path.stations.length - 1;
              return (
                <li key={i} className="flex md:flex-col gap-3.5 md:gap-0 md:min-w-[132px] md:flex-1">
                  <div aria-hidden className="flex flex-col md:flex-row items-center flex-none">
                    <span className={cx("h-3 w-3 rounded-full flex-none", last ? "bg-accent" : "bg-ink-2")} />
                    {!last && <span className="flex-1 w-[2px] min-h-5 my-1 md:my-0 md:mx-2 md:h-[2px] md:w-auto md:min-h-0 rounded-full bg-line" />}
                  </div>
                  <div className={cx("min-w-0 -mt-1 md:mt-3 md:pr-4", !last && "pb-4 md:pb-0")}>
                    <p className="text-body-sm font-semibold leading-tight">{s.municipality ?? t.path.unknownPlace}</p>
                    <p className="text-meta text-muted mt-0.5">{month(s.month, l)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-caption text-muted mt-4">{t.path.anonymous}</p>
        </div>
      )}
      {notes.length > 0 && (
        <div className={cx(path && "mt-6")}>
          <h4 className="text-title-sm font-title tracking-title">{t.notes.title}</h4>
          <p className="text-body-sm text-muted mt-0.5">{t.notes.desc}</p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {notes.map((n) => (
              <li key={n.id} className={cx("rounded-md bg-paper-2 px-5 py-4 flex flex-col", n.hidden && "border border-dashed border-line-strong bg-paper")}>
                {/* Gesetzt wie eine handgeschriebene Notiz: Literata kursiv */}
                <blockquote lang="de" className="font-serif italic text-lead leading-snug text-ink break-words">«{n.body}»</blockquote>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-meta text-muted">{t.notes.by(n.first_name, month(n.month, l))}</p>
                  {(own || (viewerId && !n.mine)) && <NoteActions id={n.id} hidden={n.hidden} own={own} canReport={Boolean(viewerId) && !n.mine && !own} />}
                </div>
                {n.hidden && <p className="text-caption text-muted mt-2">{t.notes.hidden}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
