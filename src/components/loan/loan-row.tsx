import Link from "next/link";
import type { LoanListItem } from "@/lib/loans/queries";
import { Cover } from "@/components/cover";
import { StatusText, type Tone } from "@/components/status";
import { IconArrowRight } from "@/components/icons";
import { cx } from "@/components/ui";
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

/** Frist als Datum und Dauer, passend zum Status */
function whenText(loan: LoanListItem) {
  const r = parseRange(loan.wanted);
  const overdue = loan.status === "active" && loan.due_at && new Date(loan.due_at) < new Date();
  let when: string | null = null;
  if (loan.status === "requested") when = `Antwort ${relHours(loan.respond_by)}`;
  else if (loan.status === "accepted" && r) when = loan.kind === "lend" ? fmtRange(r) : null;
  else if ((loan.status === "active" || loan.status === "disputed") && loan.due_at) {
    const d = dueDay(loan.due_at);
    when = overdue ? `Fällig war ${fmtDay(dayToDate(d))} (${relDays(d)})` : deadline(d);
  }
  return { when, overdue: Boolean(overdue) };
}

export const toneDot: Record<Tone, string> = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" };

const coverOf = (loan: LoanListItem) => ({ title: loan.title, authors: loan.authors, photoKey: loan.photo_key, photoW: loan.photo_w, photoH: loan.photo_h, seed: loan.work_id });
const who = (loan: LoanListItem) => `${offerNoun[loan.kind]} · ${loan.role === "owner" ? `an ${loan.other_name}` : `von ${loan.other_name}`}`;

function Unread({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-ink text-paper text-[12px] font-semibold tnum", className)}>
      {n} neu
    </span>
  );
}

/**
 * Ein Vorgang als Karte. `action`: du bist am Zug (Akzent-Knopf mit dem nächsten Schritt),
 * `running`: die andere Seite ist am Zug, `done`: abgeschlossen, ruhig als Zeile.
 */
export function LoanRow({ loan, variant, i = 0 }: { loan: LoanListItem; variant?: "action" | "running" | "done"; i?: number }) {
  const { when, overdue } = whenText(loan);
  const mine = loan.turn === "me" && loan.step;
  const v = variant ?? (mine ? "action" : "running");

  if (v === "done") {
    return (
      <li className="anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
        <Link href={`/vorgaenge/${loan.id}`} className="group grid grid-cols-[36px_minmax(0,1fr)_auto] gap-4 items-center px-4 md:px-5 py-3 hover:bg-paper-2 transition-colors">
          <Cover data={coverOf(loan)} width={36} />
          <div className="min-w-0">
            <p className="font-serif text-[19px] leading-tight truncate group-hover:underline underline-offset-4 decoration-1">{loan.title}</p>
            <p className="text-[13px] text-muted truncate mt-0.5">{who(loan)}</p>
          </div>
          <StatusText tone={loanTone(loan.status, loan.due_at)} className="text-muted text-right">
            {statusLabel[loan.status]}{loan.closed_at ? <span className="hidden sm:inline"> · {fmtDay(loan.closed_at)}</span> : null}
          </StatusText>
        </Link>
      </li>
    );
  }

  return (
    <li className="anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
      <Link href={`/vorgaenge/${loan.id}`} className="group panel flex gap-4 p-4 pr-4 md:pr-5 h-full hover:border-ink transition-colors">
        <div className="book flex-none self-start">
          <div className="book-face"><Cover data={coverOf(loan)} width={64} /></div>
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[12.5px] text-muted truncate">{who(loan)}</p>
            <Unread n={loan.unread} className="-mt-0.5 flex-none" />
          </div>
          <p className="font-serif text-[24px] leading-[1.05] mt-1 line-clamp-2">{loan.title}</p>
          <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {v === "action" ? (
              <>
                <StatusText tone={overdue ? "late" : loanTone(loan.status, loan.due_at)} className={overdue ? "text-late" : "text-muted"}>{when ?? statusLabel[loan.status]}</StatusText>
                <span className="h-9 px-4 rounded-full bg-accent text-accent-ink text-[13.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap group-hover:bg-accent-hover transition-colors">
                  {loan.step!.label} <IconArrowRight width={15} height={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </>
            ) : (
              <>
                <span className="chip">
                  <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", toneDot[loanTone(loan.status, loan.due_at)])} />
                  {loan.waitingText ?? statusLabel[loan.status]}
                </span>
                {when && <span className={cx("text-[13px] tnum", overdue ? "text-late font-medium" : "text-muted")}>{when}</span>}
              </>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
