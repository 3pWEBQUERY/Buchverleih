import { fmtDayTime } from "@/lib/dates";
import { labels } from "@/lib/i18n/labels";
import type { Locale } from "@/lib/i18n/locale";
import { LOANS } from "@/lib/i18n/messages/loans";
import type { LoanStatus } from "@/lib/loans/machine";

/** Lückenloser Verlauf (PRD 9.1: loan_events) – lesbar formuliert, in der Sprache der Person */
export function History({ events, l = "de" }: { events: { id: number; action: string; to_status: string; actor_name: string | null; actor_id: string | null; created_at: Date }[]; l?: Locale }) {
  const h = LOANS[l].history;
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const text = h.actions[e.action] ?? labels(l).statusLabel[e.to_status as LoanStatus];
        const system = !e.actor_id;
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden className="absolute left-[8px] top-4 bottom-0 w-px bg-line" />}
            <span aria-hidden className={`mt-[7px] h-[9px] w-[9px] ml-[4px] rounded-full ${system ? "border border-line-strong bg-paper" : "bg-accent"}`} />
            <div className="min-w-0">
              <p className="text-[15px] leading-snug">
                {system || /^[A-ZÜÄÖÉÈ]/.test(text) ? text : <><span className="font-medium">{e.actor_name}</span> {text}</>}
              </p>
              <p className="text-[12.5px] text-muted tnum mt-0.5">{fmtDayTime(e.created_at, l)}{system ? h.auto : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
