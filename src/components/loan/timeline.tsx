import { cx } from "@/components/ui";
import { addDays, fmtDay, fmtDayTime, dueDay, deadline, relHours, dayToDate } from "@/lib/dates";
import type { LoanView } from "@/lib/loans/queries";
import { statusLabel } from "@/lib/i18n/de-CH";

/**
 * Zeitachse oben auf der Vorgangsseite (PRD 8.4) als Fortschritt in Segmenten.
 * Erreichte Schritte in Tinte mit Datum, der laufende Schritt in Akzent mit Frist als Datum und Dauer.
 */
type Step = { key: string; label: string; done: boolean; note?: string | null };

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

  const steps: Step[] = [
    { key: "requested", label: "Angefragt", done: true, note: fmtDay(t.requested_at) },
    {
      key: "accepted",
      label: "Angenommen",
      done: idx >= 1 && !ended,
      note: t.accepted_at ? fmtDay(t.accepted_at) : idx === 0 && !ended ? `Antwort bis ${fmtDayTime(t.respond_by)} (${relHours(t.respond_by)})` : null,
    },
    {
      key: "active",
      label: lend ? "Übergeben" : "Übergeben, Besitz gewechselt",
      done: idx >= 2,
      note: t.handed_over_at ? fmtDay(t.handed_over_at) : idx === 1 && t.handover_by ? `spätestens ${fmtDay(new Date(new Date(t.handover_by).getTime() - 1000))}` : null,
    },
  ];
  if (lend) {
    steps.push(
      {
        key: "returned",
        label: "Zurück",
        done: idx >= 3,
        note: t.returned_at ? fmtDay(t.returned_at) : t.due_at ? deadline(dueDay(t.due_at)) : loan.wanted?.end ? `bis ${fmtDay(dayToDate(addDays(loan.wanted.end, -1)))}` : null,
      },
      {
        key: "completed",
        label: "Abgeschlossen",
        done: idx >= 4,
        note: t.closed_at && s === "completed" ? fmtDay(t.closed_at) : t.inspection_until && s === "returned" ? `Prüfung ${relHours(t.inspection_until)}` : null,
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
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <p className="eyebrow">Ablauf</p>
        <p className="text-[12.5px] text-muted tnum">
          {ended ? "Beendet" : current ? `Schritt ${cur + 1} von ${steps.length}` : `${reached} von ${steps.length} erledigt`}
        </p>
      </div>
      <ol className="grid gap-1.5 md:gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Ablauf des Vorgangs">
        {steps.map((st, i) => {
          const isCur = i === cur;
          return (
            <li key={st.key} className="min-w-0" aria-current={isCur ? "step" : undefined}>
              <span aria-hidden className={cx(
                "block h-1.5 rounded-full origin-left anim-rise",
                st.done ? "bg-ink-2" : isCur ? (trouble ? "bg-late" : "bg-accent") : ended ? "bg-paper-3 opacity-60" : "bg-paper-3",
              )} style={{ animationDelay: `${i * 60}ms` }} />
              <span className={cx("sr-only md:not-sr-only md:flex items-center gap-1.5 mt-3 text-[13.5px] font-semibold leading-tight", !st.done && !isCur && "text-muted font-medium")}>
                {isCur && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full live-dot flex-none", trouble ? "bg-late" : "bg-accent")} />}
                {st.label}
                {!st.done && !isCur && <span className="sr-only"> (offen)</span>}
              </span>
              {st.note && (
                <span className={cx("hidden md:block text-[12.5px] mt-1 leading-snug tnum", isCur && trouble ? "text-late" : isCur ? "text-ink-2" : "text-muted")}>{st.note}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobil: nur der laufende Schritt, ausgeschrieben */}
      {current && (
        <p className="md:hidden mt-3 text-[14px] leading-snug">
          <span className="font-semibold inline-flex items-center gap-1.5">
            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full live-dot", trouble ? "bg-late" : "bg-accent")} />
            {current.label}
          </span>
          {current.note && <span className={cx("tnum", trouble ? "text-late" : "text-muted")}> · {current.note}</span>}
        </p>
      )}

      {(ended || s === "lost" || s === "disputed") && (
        <p className={cx("mt-3 text-[14px]", s === "lost" || s === "disputed" ? "text-late" : "text-muted")}>
          {statusLabel[s]}{t.closed_at && ended ? ` am ${fmtDay(t.closed_at)}` : ""}
        </p>
      )}
    </div>
  );
}
