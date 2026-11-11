import Link from "next/link";
import type { LoanListItem } from "@/lib/loans/queries";
import { Cover } from "@/components/cover";
import { type Tone } from "@/components/status";
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

/** Punktfarbe zum Ton (feste Klassennamen, damit Tailwind sie findet) */
export function toneDot(t: Tone) {
  return ({ ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" } as const)[t];
}

const ENDED = ["declined", "withdrawn", "expired", "cancelled"];

/** Wie viele Schritte erreicht sind – dieselbe Zählung wie die Zeitachse auf der Vorgangsseite */
export function loanProgress(status: LoanListItem["status"], kind: LoanListItem["kind"]) {
  const lend = kind === "lend";
  const total = lend ? 5 : 3;
  if (ENDED.includes(status)) return { done: 1, total, ended: true };
  const order = ["requested", "accepted", "active", "returned", "completed"];
  let idx = order.indexOf(status);
  if (status === "return_reported" || status === "lost") idx = 2;
  if (status === "disputed") idx = 2;
  if (!lend && status === "completed") idx = 2;
  return { done: Math.min(total, Math.max(0, idx) + 1), total, ended: false };
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

const coverOf = (loan: LoanListItem) => ({ title: loan.title, authors: loan.authors, photoKey: loan.photo_key, photoW: loan.photo_w, photoH: loan.photo_h, coverKey: loan.cover_key, seed: loan.work_id });
const who = (loan: LoanListItem) => `${offerNoun[loan.kind]} · ${loan.role === "owner" ? `an ${loan.other_name}` : `von ${loan.other_name}`}`;

function Unread({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="inline-flex items-center h-6 px-2 rounded-[6px] bg-accent-soft text-accent-hover text-[12px] font-semibold tnum flex-none">{n} neu</span>;
}

/** Fortschritt als schmale Segmente, der laufende Schritt in der Markenfarbe */
function Progress({ loan, trouble }: { loan: LoanListItem; trouble: boolean }) {
  const p = loanProgress(loan.status, loan.kind);
  if (p.ended) return null;
  return (
    <div className="flex items-center gap-3" aria-label={`Schritt ${Math.min(p.done + 1, p.total)} von ${p.total}`}>
      <span aria-hidden className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${p.total}, minmax(0, 1fr))` }}>
        {Array.from({ length: p.total }).map((_, i) => (
          <span key={i} className={cx("h-1 rounded-full", i < p.done ? "bg-ink-2" : i === p.done ? (trouble ? "bg-late" : "bg-accent") : "bg-paper-3")} />
        ))}
      </span>
      <span className="text-[12px] text-muted tnum flex-none">{Math.min(p.done + 1, p.total)}/{p.total}</span>
    </div>
  );
}

/**
 * Ein Vorgang als Karte. `action`: du bist am Zug (Akzent-Knopf mit dem nächsten Schritt),
 * `running`: die andere Seite ist am Zug, `done`: abgeschlossen, ruhig als Tabellenzeile.
 */
export function LoanRow({ loan, variant, i = 0 }: { loan: LoanListItem; variant?: "action" | "running" | "done"; i?: number }) {
  const { when, overdue } = whenText(loan);
  const mine = loan.turn === "me" && loan.step;
  const v = variant ?? (mine ? "action" : "running");
  const tone = overdue ? "late" : loanTone(loan.status, loan.due_at);

  if (v === "done") {
    return (
      <li className="anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
        <Link href={`/vorgaenge/${loan.id}`} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,1fr)_120px_120px_170px] gap-4 md:gap-6 items-center px-4 md:px-5 py-3 hover:bg-paper-2 transition-colors">
          <Cover data={coverOf(loan)} width={32} height={48} uniform />
          <div className="min-w-0">
            <p className="font-serif text-[16.5px] leading-tight truncate group-hover:underline underline-offset-4 decoration-1">{loan.title}</p>
            <p className="text-[13px] text-muted truncate mt-0.5"><span className="md:hidden">{who(loan)}</span><span className="hidden md:inline">{loan.authors.join(", ")}</span></p>
          </div>
          <span className="hidden md:block text-[13.5px] text-ink-2">{offerNoun[loan.kind]}</span>
          <span className="hidden md:block text-[13.5px] text-ink-2 truncate">{loan.role === "owner" ? "an " : "von "}{loan.other_name}</span>
          <span className="text-[13px] text-right inline-flex items-center justify-end gap-2 text-muted tnum">
            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", toneDot(loanTone(loan.status, loan.due_at)))} />
            <span className="text-ink-2">{statusLabel[loan.status]}</span>
            {loan.closed_at && <span className="hidden sm:inline">{fmtDay(loan.closed_at)}</span>}
          </span>
        </Link>
      </li>
    );
  }

  return (
    <li className="anim-rise min-w-0" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
      <Link href={`/vorgaenge/${loan.id}`}
        className={cx("group grid grid-cols-[72px_minmax(0,1fr)] gap-4 md:gap-5 rounded-[10px] border p-4 md:p-5 h-full transition-colors",
          v === "action" ? "border-line-strong hover:border-accent" : "border-line hover:border-ink-2")}>
        <span className="book self-start"><span className="book-face block"><Cover data={coverOf(loan)} width={72} height={108} uniform /></span></span>
        <div className="min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[12.5px] text-muted truncate pt-0.5">{who(loan)}</p>
            <Unread n={loan.unread} />
          </div>
          <p className="font-serif text-[19px] md:text-[20px] leading-[1.15] mt-1 line-clamp-2">{loan.title}</p>
          {loan.authors[0] && <p className="text-[13px] text-muted truncate mt-0.5">{loan.authors.join(", ")}</p>}
          <div className="mt-4"><Progress loan={loan} trouble={tone === "late"} /></div>
          <div className="mt-auto pt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className={cx("inline-flex items-center gap-1.5 text-[13px] tnum min-w-0", overdue ? "text-late font-medium" : "text-ink-2")}>
              <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", toneDot(tone))} />
              <span className="truncate">{v === "action" ? (when ?? statusLabel[loan.status]) : (loan.waitingText ?? statusLabel[loan.status])}</span>
            </span>
            {v === "action" ? (
              <span className="h-9 px-3.5 rounded-[6px] bg-accent text-accent-ink text-[13.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap group-hover:bg-accent-hover transition-colors">
                {loan.step!.label} <IconArrowRight width={15} height={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            ) : (
              when && <span className={cx("text-[13px] tnum", overdue ? "text-late font-medium" : "text-muted")}>{when}</span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
