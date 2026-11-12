import { cx } from "./ui";
import { fmtDay, dueDay, dayToDate } from "@/lib/dates";
import type { ShelfStatus } from "@/lib/copies";
import type { Locale } from "@/lib/i18n/locale";
import { LOANS } from "@/lib/i18n/messages/loans";

/** Status ist Text, nicht nur Farbe (PRD 8.3, Punkt 5) */
export type Tone = "ok" | "lent" | "late" | "wait" | "done" | "accent";

const dot: Record<Tone, string> = {
  ok: "bg-ok",
  lent: "bg-lent",
  late: "bg-late",
  wait: "bg-wait",
  done: "bg-done",
  accent: "bg-accent",
};

export function StatusText({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] leading-tight", className)}>
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", dot[tone])} />
      <span>{children}</span>
    </span>
  );
}

export function shelfStatusText(s: { status: ShelfStatus; lent_until: Date | null; next_start: string | null; open_requests: number }, l: Locale = "de"): { tone: Tone; text: string } {
  const t = LOANS[l].shelf;
  switch (s.status) {
    case "lent": {
      if (!s.lent_until) return { tone: "lent", text: t.lent };
      const late = new Date(s.lent_until) < new Date();
      const day = fmtDay(dayToDate(dueDay(s.lent_until)), l);
      return late ? { tone: "late", text: t.overdueSince(day) } : { tone: "lent", text: t.lentUntil(day) };
    }
    case "reserved":
      return { tone: "wait", text: s.next_start ? t.bookedFrom(fmtDay(dayToDate(s.next_start), l)) : t.reserved };
    case "requested":
      return { tone: "accent", text: t.requests(s.open_requests) };
    case "paused":
      return { tone: "done", text: t.paused };
    case "not_offered":
      return { tone: "done", text: t.notOffered };
    default:
      return { tone: "ok", text: t.available };
  }
}
