import { cx } from "@/components/ui";
import { addDays, fmtDay, fmtDayTime, fmtTime, dueDay, relHours, relDays, dayToDate, diffDays, todayCH } from "@/lib/dates";
import { IconCheck } from "@/components/icons";
import type { LoanView } from "@/lib/loans/queries";
import { statusLabel } from "@/lib/i18n/de-CH";

/**
 * Zeitachse oben auf der Vorgangsseite (PRD 8.4) als Schrittfolge: erreichte Schritte mit Häkchen
 * und Zeitpunkt, der laufende Schritt in Akzent mit Frist und Restzeit als Marke.
 * Desktop waagrecht, mobil senkrecht.
 */
type Step = { key: string; label: string; done: boolean; note?: string | null; time?: string | null; chip?: string | null; late?: boolean };

/** Zeitpunkt eines erreichten Schritts: Datum, darunter die Uhrzeit */
const at = (d: Date | string) => ({ note: fmtDay(d), time: fmtTime(d) });

export function Timeline({ loan }: { loan: LoanView }) {
  const t = loan.times;
  const s = loan.status;
  const lend = loan.kind === "lend";
  const order = ["requested", "accepted", "active", "returned", "completed"];
  const idx = (() => {
    if (s === "return_reported") return 2;
    if (s === "disputed") return loan.times.returned_at ? 3 : 2;
    if (s === "lost") return 2;
    if (!lend && s === "completed") return 2;
    const i = order.indexOf(s);
    return i < 0 ? 0 : i;
  })();
  const ended = ["declined", "withdrawn", "expired", "cancelled"].includes(s);
  const overdue = s === "active" && t.due_at && new Date(t.due_at) < new Date();

  const dueChip = (() => {
    if (!t.due_at) return null;
    const d = dueDay(t.due_at);
    const n = diffDays(todayCH(), d);
    if (n < 0) return `${-n} ${-n === 1 ? "Tag" : "Tage"} überfällig`;
    return n === 0 ? "heute" : relDays(d);
  })();

  const steps: Step[] = [
    { key: "requested", label: "Angefragt", done: true, ...at(t.requested_at) },
    {
      key: "accepted",
      label: "Angenommen",
      done: idx >= 1 && !ended,
      ...(t.accepted_at ? { ...at(t.accepted_at) }
        : idx === 0 && !ended ? { note: `Antwort bis ${fmtDayTime(t.respond_by)}`, chip: relHours(t.respond_by) } : {}),
    },
    {
      key: "active",
      label: lend ? "Übergeben" : "Übergeben, Besitz gewechselt",
      done: idx >= 2,
      ...(t.handed_over_at ? { ...at(t.handed_over_at) }
        : idx === 1 && t.handover_by ? { note: `Spätestens ${fmtDay(new Date(new Date(t.handover_by).getTime() - 1000))}`, chip: relHours(t.handover_by) }
        : idx === 1 && loan.wanted && lend ? { note: `Ab ${fmtDay(dayToDate(loan.wanted.start))}`, chip: relDays(loan.wanted.start) } : {}),
    },
  ];
  if (lend) {
    steps.push(
      {
        key: "returned",
        label: "Zurück",
        done: idx >= 3,
        ...(t.returned_at ? { ...at(t.returned_at) }
          : t.due_at ? { note: `Bis ${fmtDay(dayToDate(dueDay(t.due_at)))}`, chip: dueChip, late: Boolean(overdue) }
          : loan.wanted?.end ? { note: `Bis ${fmtDay(dayToDate(addDays(loan.wanted.end, -1)))}` } : {}),
      },
      {
        key: "completed",
        label: "Abgeschlossen",
        done: idx >= 4,
        ...(t.closed_at && s === "completed" ? { ...at(t.closed_at) }
          : t.inspection_until && s === "returned" ? { note: `Prüfung bis ${fmtDayTime(t.inspection_until)}`, chip: relHours(t.inspection_until) } : {}),
      },
    );
  }

  // Der laufende Schritt: der erste noch nicht erreichte – ausser der Vorgang ist beendet
  const cur = ended ? -1 : steps.findIndex((x) => !x.done);
  const trouble = s === "lost" || s === "disputed" || Boolean(overdue);
  const reached = steps.filter((x) => x.done).length;
  const current = cur >= 0 ? steps[cur] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <p className="eyebrow">Ablauf</p>
        <p className="text-[12.5px] text-muted tnum">
          {ended ? "Beendet" : current ? `Schritt ${cur + 1} von ${steps.length}` : `${reached} von ${steps.length} erledigt`}
        </p>
      </div>
      <ol className="flex flex-col md:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Ablauf des Vorgangs">
        {steps.map((st, i) => {
          const isCur = i === cur;
          const last = i === steps.length - 1;
          const bad = isCur && (trouble || st.late);
          return (
            <li key={st.key} className="min-w-0 flex md:flex-col gap-3.5 md:gap-0 anim-rise" style={{ animationDelay: `${i * 50}ms` }} aria-current={isCur ? "step" : undefined}>
              {/* Knoten und Verbindung zum nächsten Schritt */}
              <div aria-hidden className="flex flex-col md:flex-row items-center flex-none">
                <span className={cx(
                  "relative h-7 w-7 rounded-full grid place-items-center flex-none text-[12px] font-semibold tnum transition-colors",
                  st.done ? "bg-ink-2 text-paper"
                    : isCur ? (bad ? "bg-late text-paper" : "bg-accent text-accent-ink")
                    : ended ? "border border-line text-muted/60" : "border-[1.5px] border-line-strong text-muted",
                )}>
                  {st.done ? <IconCheck width={14} height={14} /> : i + 1}
                  {isCur && <span className={cx("absolute -inset-1 rounded-full border-2", bad ? "border-late/30" : "border-accent/30")} />}
                </span>
                {!last && (
                  <span className={cx("flex-1 w-[2px] min-h-6 my-1.5 md:my-0 md:mx-2.5 md:h-[2px] md:w-auto md:min-h-0 rounded-full",
                    st.done && (steps[i + 1].done || i + 1 === cur) ? "bg-ink-2" : "bg-line")} />
                )}
              </div>
              <div className={cx("min-w-0 pt-0.5 md:pt-3.5 md:pr-4", !last && "pb-5 md:pb-0")}>
                <p className={cx("text-[14px] leading-tight", st.done || isCur ? "font-semibold text-ink" : "font-medium text-muted")}>
                  {st.label}
                  {!st.done && !isCur && <span className="sr-only"> (offen)</span>}
                </p>
                {st.note && <p className={cx("text-[12.5px] mt-1 leading-snug tnum", bad ? "text-late" : isCur ? "text-ink-2" : "text-muted")}>{st.note}{st.time && <span className="md:block"><span className="md:hidden">, </span>{st.time} Uhr</span>}</p>}
                {isCur && st.chip && (
                  <span className={cx("inline-flex items-center gap-1.5 mt-2 h-6 px-2 rounded-[6px] text-[12px] font-semibold tnum",
                    bad ? "bg-late/10 text-late" : "bg-accent-soft text-accent-hover")}>
                    <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full live-dot", bad ? "bg-late" : "bg-accent")} />{st.chip}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {(ended || s === "lost" || s === "disputed") && (
        <p className={cx("mt-3 text-[14px]", s === "lost" || s === "disputed" ? "text-late" : "text-muted")}>
          {statusLabel[s]}{t.closed_at && ended ? ` am ${fmtDay(t.closed_at)}` : ""}
        </p>
      )}
    </div>
  );
}
