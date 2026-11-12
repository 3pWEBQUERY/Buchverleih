import Link from "next/link";
import type { LoanListItem } from "@/lib/loans/queries";
import { Cover } from "@/components/cover";
import { type Tone } from "@/components/status";
import { IconArrowRight } from "@/components/icons";
import { cx } from "@/components/ui";
import { statusLabel, offerNoun } from "@/lib/i18n/de-CH";
import { deadline, dueDay, parseRange, relHours, fmtRange, fmtDay, fmtDayTime, dayToDate, relDays, diffDays, isoDay, todayCH, addDays } from "@/lib/dates";
import { Monogram } from "@/components/person/monogram";

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


/** Restzeit als Zahl und Einheit: «26 Tage», «41 Std.», «25 Min.» */
function leftOf(until: Date | string): { n: string; unit: string; ms: number } {
  const ms = new Date(until).getTime() - Date.now();
  const h = Math.floor(Math.max(0, ms) / 3_600_000);
  if (h >= 48) { const d = Math.round(h / 24); return { n: String(d), unit: d === 1 ? "Tag" : "Tage", ms }; }
  if (h >= 1) return { n: String(h), unit: "Std.", ms };
  return { n: String(Math.max(1, Math.round(Math.max(0, ms) / 60_000))), unit: "Min.", ms };
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const span = (a: Date | string, b: Date | string) => clamp((Date.now() - new Date(a).getTime()) / Math.max(1, new Date(b).getTime() - new Date(a).getTime()));

type Meter = {
  eyebrow: string;
  value: string;
  unit: string;
  sideLabel: string;
  side: string;
  pct: number | null;
  foot: [string, string] | null;
  tone: "accent" | "late" | "plain";
};

/**
 * Wie viel Zeit bleibt? Je nach Status: Leihzeit bis zur Rückgabe, Antwortfrist,
 * Beginn der Leihe, Übergabe oder Prüffrist nach der Rückgabe.
 */
export type MeterInput = Pick<LoanListItem, "status" | "kind" | "role" | "other_name" | "wanted" | "due_at" | "respond_by" | "requested_at" | "handed_over_at" | "handover_by" | "returned_at" | "inspection_until">;

export function timeMeter(loan: MeterInput): Meter | null {
  const today = todayCH();
  const r = parseRange(loan.wanted);
  const owner = loan.role === "owner";

  if ((loan.status === "active" || loan.status === "disputed") && loan.due_at) {
    const end = dueDay(loan.due_at);
    const start = loan.handed_over_at ? isoDay(loan.handed_over_at) : r?.start ?? today;
    const total = Math.max(1, diffDays(start, end) + 1);
    const day = Math.min(total, Math.max(1, diffDays(start, today) + 1));
    const left = diffDays(today, end);
    const foot: [string, string] = [`Seit ${fmtDay(dayToDate(start))}`, left < 0 ? `${total} ${total === 1 ? "Tag" : "Tage"} Leihfrist` : `Tag ${day} von ${total}`];
    if (left < 0) {
      return { eyebrow: "Überfällig seit", value: String(-left), unit: -left === 1 ? "Tag" : "Tagen", sideLabel: "War fällig", side: fmtDay(dayToDate(end)), pct: 1, foot, tone: "late" };
    }
    const eyebrow = owner ? `Zurück von ${loan.other_name} in` : "Rückgabe in";
    if (left === 0) return { eyebrow: owner ? "Kommt zurück" : "Rückgabe", value: "Heute", unit: "", sideLabel: "Letzter Tag", side: fmtDay(dayToDate(end)), pct: 1, foot, tone: "accent" };
    return {
      eyebrow, value: String(left), unit: left === 1 ? "Tag" : "Tagen", sideLabel: "Rückgabe bis", side: fmtDay(dayToDate(end)),
      pct: clamp(day / total), foot, tone: left <= 2 ? "accent" : "plain",
    };
  }

  if (loan.status === "requested") {
    const l = leftOf(loan.respond_by);
    const len = r?.end ? diffDays(r.start, r.end) : null;
    return {
      eyebrow: owner ? "Zeit für deine Antwort" : "Antwortfrist noch",
      value: l.n, unit: l.unit, sideLabel: "Frist", side: fmtDayTime(loan.respond_by),
      pct: span(loan.requested_at, loan.respond_by),
      foot: r && loan.kind === "lend" ? [`Gewünscht ${fmtRange(r)}`, len ? `${len} ${len === 1 ? "Tag" : "Tage"}` : ""] : null,
      tone: l.ms < 12 * 3_600_000 ? "late" : "accent",
    };
  }

  if (loan.status === "accepted") {
    if (r && loan.kind === "lend" && diffDays(today, r.start) > 0) {
      const n = diffDays(today, r.start);
      const len = r.end ? diffDays(r.start, r.end) : null;
      return {
        eyebrow: "Leihe beginnt in", value: n === 1 ? "1" : String(n), unit: n === 1 ? "Tag" : "Tagen",
        sideLabel: "Zeitraum", side: fmtRange(r), pct: null,
        foot: [len ? `${len} ${len === 1 ? "Tag" : "Tage"} Leihfrist` : "Leihfrist offen", r.end ? `Rückgabe ${fmtDay(dayToDate(addDays(r.end, -1)))}` : ""], tone: "plain",
      };
    }
    if (loan.handover_by) {
      const l = leftOf(loan.handover_by);
      return {
        eyebrow: "Zeit für die Übergabe", value: l.n, unit: l.unit, sideLabel: "Übergabe bis", side: fmtDayTime(loan.handover_by),
        pct: null, foot: r && loan.kind === "lend" ? [`Zeitraum ${fmtRange(r)}`, ""] : null, tone: l.ms < 24 * 3_600_000 ? "late" : "accent",
      };
    }
    return null;
  }

  if (loan.status === "returned" && loan.inspection_until) {
    const l = leftOf(loan.inspection_until);
    return {
      eyebrow: owner ? "Zeit, den Zustand zu prüfen" : "Prüfung läuft noch", value: l.n, unit: l.unit, sideLabel: "Frist", side: fmtDayTime(loan.inspection_until),
      pct: loan.returned_at ? span(loan.returned_at, loan.inspection_until) : null,
      foot: owner ? ["Danach gilt das Buch als zurück in gutem Zustand.", ""] : null, tone: "plain",
    };
  }
  return null;
}

/** Restzeit gross, darunter der Balken mit der verstrichenen Zeit */
export function TimeMeter({ m, className }: { m: Meter; className?: string }) {
  const late = m.tone === "late";
  return (
    <div className={cx("rounded-[8px] px-4 py-3.5", late ? "bg-late/[0.07]" : "bg-paper-2", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-end">
        <p className={cx("text-[12px]", late ? "text-late" : "text-muted")}>{m.eyebrow}</p>
        <p className="text-[12px] text-muted text-right">{m.sideLabel}</p>
        <p className={cx("flex items-baseline gap-1.5 leading-none", late && "text-late")}>
          <span className="text-[30px] md:text-[34px] font-[560] tracking-[-0.045em] tnum">{m.value}</span>
          {m.unit && <span className="text-[15px] font-medium">{m.unit}</span>}
        </p>
        <p className={cx("text-[14px] font-medium tnum text-right truncate pb-0.5", late && "text-late")}>{m.side}</p>
      </div>
      {m.pct != null && (
        <div className="relative mt-3 h-1.5 rounded-full bg-paper-3 overflow-hidden" role="presentation">
          <span className={cx("absolute inset-y-0 left-0 rounded-full", late ? "bg-late" : m.tone === "accent" ? "bg-accent" : "bg-ink-2")}
            style={{ width: `${Math.max(3, Math.round(m.pct * 100))}%` }} />
        </div>
      )}
      {m.foot && (m.foot[0] || m.foot[1]) && (
        <div className="mt-2 flex justify-between gap-3 text-[12px] text-muted tnum">
          <span className="truncate">{m.foot[0]}</span>
          {m.foot[1] && <span className="flex-none">{m.foot[1]}</span>}
        </div>
      )}
    </div>
  );
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

  const meter = timeMeter(loan);
  const p = loanProgress(loan.status, loan.kind);
  return (
    <li className="anim-rise min-w-0" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
      <Link href={`/vorgaenge/${loan.id}`}
        className={cx("group flex flex-col gap-4 rounded-[10px] border p-4 md:p-5 h-full transition-colors",
          tone === "late" ? "border-late/50 hover:border-late" : v === "action" ? "border-line-strong hover:border-accent" : "border-line hover:border-ink-2")}>
        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-4">
          <span className="book self-start"><span className="book-face block"><Cover data={coverOf(loan)} width={64} height={96} uniform /></span></span>
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-muted truncate inline-flex items-center gap-2 min-w-0">
                <Monogram name={loan.other_name} seed={loan.other_id} size={20} photo={loan.other_avatar} />
                <span className="truncate">{who(loan)}</span>
              </p>
              <Unread n={loan.unread} />
            </div>
            <p className="font-serif text-[19px] md:text-[20px] leading-[1.15] mt-1.5 line-clamp-2 group-hover:underline underline-offset-4 decoration-1">{loan.title}</p>
            {loan.authors[0] && <p className="text-[13px] text-muted truncate mt-0.5">{loan.authors.join(", ")}</p>}
            {!p.ended && <div className="mt-auto pt-3"><Progress loan={loan} trouble={tone === "late"} /></div>}
          </div>
        </div>

        {meter ? <TimeMeter m={meter} /> : when && (
          <p className={cx("inline-flex items-center gap-1.5 text-[13px] tnum", overdue ? "text-late font-medium" : "text-ink-2")}>
            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", toneDot(tone))} />{when}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 min-w-0">
            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", toneDot(tone))} />
            <span className="truncate">{v === "action" ? "Du bist am Zug" : (loan.waitingText ?? statusLabel[loan.status])}</span>
          </span>
          {v === "action" ? (
            <span className="h-9 px-3.5 rounded-[6px] bg-accent text-accent-ink text-[13.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap group-hover:bg-accent-hover transition-colors">
              {loan.step!.label} <IconArrowRight width={15} height={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          ) : (
            <span className="text-[13px] font-medium text-accent-hover inline-flex items-center gap-1">Öffnen <IconArrowRight width={14} height={14} /></span>
          )}
        </div>
      </Link>
    </li>
  );
}

/** Restzeit in einer Zeile, z. B. in der Benachrichtigungsliste: Marke, Frist und kurzer Balken */
export function TimeMeterInline({ m, className }: { m: Meter; className?: string }) {
  const late = m.tone === "late";
  const joined = /\b(in|seit|noch)$/.test(m.eyebrow) ? `${m.eyebrow} ${m.value}${m.unit ? ` ${m.unit}` : ""}` : `${m.eyebrow}: ${m.value}${m.unit ? ` ${m.unit}` : ""}`;
  return (
    <span className={cx("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] tnum", className)}>
      <span className={cx("inline-flex items-center gap-1.5 h-6 px-2 rounded-[6px] font-semibold",
        late ? "bg-late/10 text-late" : m.tone === "accent" ? "bg-accent-soft text-accent-hover" : "bg-paper-2 text-ink-2")}>
        <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", late ? "bg-late live-dot" : m.tone === "accent" ? "bg-accent live-dot" : "bg-ink-2")} />
        {joined}
      </span>
      <span className="text-muted">{m.sideLabel} {m.side}</span>
      {m.pct != null && (
        <span aria-hidden className="relative h-1 w-20 rounded-full bg-paper-3 overflow-hidden">
          <span className={cx("absolute inset-y-0 left-0 rounded-full", late ? "bg-late" : m.tone === "accent" ? "bg-accent" : "bg-ink-2")} style={{ width: `${Math.max(4, Math.round(m.pct * 100))}%` }} />
        </span>
      )}
    </span>
  );
}
