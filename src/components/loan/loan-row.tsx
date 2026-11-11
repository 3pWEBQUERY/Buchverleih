import Link from "next/link";
import type { LoanListItem } from "@/lib/loans/queries";
import { Cover } from "@/components/cover";
import { StatusText, type Tone } from "@/components/status";
import { statusLabel, offerNoun } from "@/lib/i18n/de-CH";
import { deadline, dueDay, parseRange, relHours, fmtRange, fmtDay, dayToDate, relDays } from "@/lib/dates";

export function loanTone(status: LoanListItem["status"], due: Date | null): Tone {
  if ((status === "active" || status === "disputed") && due && new Date(due) < new Date()) return "late";
  switch (status) {
    case "requested": return "accent";
    case "accepted": return "wait";
    case "active": case "return_reported": return "lent";
    case "returned": return "wait";
    case "disputed": case "lost": return "late";
    default: return "done";
  }
}

/** Eine Zeile pro Vorgang: Cover, Titel, Person, Status als Text, Frist als Datum und Dauer */
export function LoanRow({ loan }: { loan: LoanListItem }) {
  const r = parseRange(loan.wanted);
  const overdue = loan.status === "active" && loan.due_at && new Date(loan.due_at) < new Date();
  let when: string | null = null;
  if (loan.status === "requested") when = `Antwort ${relHours(loan.respond_by)}`;
  else if (loan.status === "accepted" && r) when = loan.kind === "lend" ? fmtRange(r) : null;
  else if ((loan.status === "active" || loan.status === "disputed") && loan.due_at) {
    const d = dueDay(loan.due_at);
    when = overdue ? `Fällig war ${fmtDay(dayToDate(d))} (${relDays(d)})` : deadline(d);
  }

  const mine = loan.turn === "me" && loan.step;
  return (
    <li>
      <Link href={`/vorgaenge/${loan.id}`} className="group grid grid-cols-[44px_1fr_auto] gap-4 items-center py-3.5">
        <Cover data={{ title: loan.title, authors: loan.authors, photoKey: loan.photo_key, photoW: loan.photo_w, photoH: loan.photo_h, seed: loan.work_id }} width={44} />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight truncate group-hover:underline">{loan.title}</div>
          <div className="text-sm text-muted mt-0.5 truncate">
            {offerNoun[loan.kind]} · {loan.role === "owner" ? `an ${loan.other_name}` : `von ${loan.other_name}`}
            {when && <> · <span className={overdue ? "text-late" : ""}>{when}</span></>}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          {mine ? (
            <span className="text-sm font-medium text-accent">{loan.step!.label}</span>
          ) : (
            <StatusText tone={loanTone(loan.status, loan.due_at)}>{loan.waitingText ?? statusLabel[loan.status]}</StatusText>
          )}
          {loan.unread > 0 && <span className="text-xs text-muted tnum">{loan.unread} neu</span>}
        </div>
      </Link>
    </li>
  );
}
