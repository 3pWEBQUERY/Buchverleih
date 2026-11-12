import { cx } from "@/components/ui";
import { addDays, fmtDay, fmtDayTime, fmtTime, dueDay, relHours, relDays, dayToDate, diffDays, todayCH } from "@/lib/dates";
import { IconCheck } from "@/components/icons";
import type { LoanView } from "@/lib/loans/queries";
import { labels } from "@/lib/i18n/labels";
import type { Locale } from "@/lib/i18n/locale";
import { LOANS } from "@/lib/i18n/messages/loans";

/**
 * Zeitachse oben auf der Vorgangsseite (PRD 8.4) als Schrittfolge: erreichte Schritte mit Häkchen
 * und Zeitpunkt, der laufende Schritt in Akzent mit Frist und Restzeit als Marke.
 * Desktop waagrecht, mobil senkrecht.
 */
type Step = { key: string; label: string; done: boolean; note?: string | null; time?: string | null; chip?: string | null; late?: boolean };

/** Zeitpunkt eines erreichten Schritts: Datum, darunter die Uhrzeit */
const at = (d: Date | string, l: Locale) => ({ note: fmtDay(d, l), time: fmtTime(d, l) });

export function Timeline({ loan, l = "de" }: { loan: LoanView; l?: Locale }) {
  const m = LOANS[l].timeline;
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
    if (n < 0) return m.overdueDays(-n);
    return relDays(d, todayCH(), l);
  })();

  const steps: Step[] = [
    { key: "requested", label: m.requested, done: true, ...at(t.requested_at, l) },
    {
      key: "accepted",
      label: m.accepted,
      done: idx >= 1 && !ended,
      ...(t.accepted_at ? { ...at(t.accepted_at, l) }
        : idx === 0 && !ended ? { note: m.answerBy(fmtDayTime(t.respond_by, l)), chip: relHours(t.respond_by, l) } : {}),
    },
    {
      key: "active",
      label: lend ? m.handedOver : m.handedOverSwap,
      done: idx >= 2,
      ...(t.handed_over_at ? { ...at(t.handed_over_at, l) }
        : idx === 1 && t.handover_by ? { note: m.latest(fmtDay(new Date(new Date(t.handover_by).getTime() - 1000), l)), chip: relHours(t.handover_by, l) }
        : idx === 1 && loan.wanted && lend ? { note: m.from(fmtDay(dayToDate(loan.wanted.start), l)), chip: relDays(loan.wanted.start, todayCH(), l) } : {}),
    },
  ];
  if (lend) {
    steps.push(
      {
        key: "returned",
        label: m.back,
        done: idx >= 3,
        ...(t.returned_at ? { ...at(t.returned_at, l) }
          : t.due_at ? { note: m.until(fmtDay(dayToDate(dueDay(t.due_at)), l)), chip: dueChip, late: Boolean(overdue) }
          : loan.wanted?.end ? { note: m.until(fmtDay(dayToDate(addDays(loan.wanted.end, -1)), l)) } : {}),
      },
      {
        key: "completed",
        label: m.completed,
        done: idx >= 4,
        ...(t.closed_at && s === "completed" ? { ...at(t.closed_at, l) }
          : t.inspection_until && s === "returned" ? { note: m.inspectBy(fmtDayTime(t.inspection_until, l)), chip: relHours(t.inspection_until, l) } : {}),
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
        <p className="eyebrow">{m.title}</p>
        <p className="text-[12.5px] text-muted tnum">
          {ended ? m.ended : current ? m.stepOf(cur + 1, steps.length) : m.doneOf(reached, steps.length)}
        </p>
      </div>
      <ol className="flex flex-col md:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={m.aria}>
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
                  {!st.done && !isCur && <span className="sr-only">{m.open}</span>}
                </p>
                {st.note && <p className={cx("text-[12.5px] mt-1 leading-snug tnum", bad ? "text-late" : isCur ? "text-ink-2" : "text-muted")}>{st.note}{st.time && <span className="md:block"><span className="md:hidden">, </span>{m.clock(st.time)}</span>}</p>}
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
          {labels(l).statusLabel[s]}{t.closed_at && ended ? m.on(fmtDay(t.closed_at, l)) : ""}
        </p>
      )}
    </div>
  );
}
