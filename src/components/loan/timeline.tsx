import { cx } from "@/components/ui";
import { addDays, fmtDay, fmtDayTime, dueDay, deadline, relHours, dayToDate } from "@/lib/dates";
import type { LoanView } from "@/lib/loans/queries";
import { statusLabel } from "@/lib/i18n/de-CH";

/**
 * Zeitachse oben auf der Vorgangsseite (PRD 8.4). Erreichte Schritte mit Datum,
 * der nächste mit Frist als Datum und Dauer.
 */
type Step = { key: string; label: string; done: boolean; current: boolean; note?: string | null };

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

  const steps: Step[] = [
    { key: "requested", label: "Angefragt", done: true, current: idx === 0 && !ended, note: idx === 0 && !ended ? `Antwort bis ${fmtDayTime(t.respond_by)} (${relHours(t.respond_by)})` : fmtDay(t.requested_at) },
    { key: "accepted", label: "Angenommen", done: idx >= 1 && !ended, current: idx === 1, note: t.accepted_at ? fmtDay(t.accepted_at) : null },
    {
      key: "active",
      label: lend ? "Übergeben" : "Übergeben, Besitz gewechselt",
      done: idx >= 2,
      current: idx === 1,
      note: t.handed_over_at ? fmtDay(t.handed_over_at) : idx === 1 && t.handover_by ? `spätestens ${fmtDay(new Date(new Date(t.handover_by).getTime() - 1000))}` : null,
    },
  ];
  if (lend) {
    steps.push(
      {
        key: "returned",
        label: "Zurück",
        done: idx >= 3,
        current: idx === 2,
        note: t.returned_at ? fmtDay(t.returned_at) : t.due_at ? deadline(dueDay(t.due_at)) : loan.wanted?.end ? `bis ${fmtDay(dayToDate(addDays(loan.wanted.end, -1)))}` : null,
      },
      { key: "completed", label: "Abgeschlossen", done: idx >= 4, current: idx === 3, note: t.closed_at && s === "completed" ? fmtDay(t.closed_at) : t.inspection_until && s === "returned" ? `Prüfung ${relHours(t.inspection_until)}` : null },
    );
  }

  const overdue = s === "active" && t.due_at && new Date(t.due_at) < new Date();

  return (
    <div>
      <ol className="grid gap-y-4 md:gap-y-0 md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ ["--n" as string]: steps.length }} aria-label="Ablauf des Vorgangs">
        {steps.map((st, i) => (
          <li key={st.key} className="relative pl-7 md:pl-0 md:pt-5 md:pr-2 min-w-0" aria-current={st.current ? "step" : undefined}>
            <span aria-hidden className={cx(
              "absolute left-[7px] top-4 -bottom-4 w-px md:w-auto md:h-px md:top-[7px] md:left-0 md:right-0 md:bottom-auto",
              i === steps.length - 1 && "hidden md:block",
              st.done || (steps[i + 1]?.done ?? false) ? "bg-ink" : "bg-line-strong",
            )} />
            <span aria-hidden className={cx(
              "absolute top-0.5 md:top-0 left-0 h-[15px] w-[15px] rounded-full border-2 transition-colors duration-200",
              st.done && !st.current ? "bg-ink border-ink" : st.current ? (overdue && st.key === "returned" ? "bg-paper border-late" : "bg-paper border-accent") : "bg-paper border-line-strong",
            )} />
            <span className={cx("block text-[13px] md:text-sm font-medium leading-tight", !st.done && !st.current && "text-muted")}>{st.label}</span>
            {st.note && <span className={cx("block text-xs mt-1 leading-snug", st.current && overdue && st.key === "returned" ? "text-late" : "text-muted")}>{st.note}</span>}
          </li>
        ))}
      </ol>
      {(ended || s === "lost" || s === "disputed") && (
        <p className={cx("mt-4 text-sm", s === "lost" || s === "disputed" ? "text-late" : "text-muted")}>
          {statusLabel[s]}{t.closed_at && ended ? ` am ${fmtDay(t.closed_at)}` : ""}
        </p>
      )}
    </div>
  );
}
