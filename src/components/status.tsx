import { cx } from "./ui";
import { fmtDay, dueDay, dayToDate } from "@/lib/dates";
import type { ShelfStatus } from "@/lib/copies";

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

export function shelfStatusText(s: { status: ShelfStatus; lent_until: Date | null; next_start: string | null; open_requests: number }): { tone: Tone; text: string } {
  switch (s.status) {
    case "lent": {
      if (!s.lent_until) return { tone: "lent", text: "Ausgeliehen" };
      const late = new Date(s.lent_until) < new Date();
      return late
        ? { tone: "late", text: `Überfällig seit ${fmtDay(dayToDate(dueDay(s.lent_until)))}` }
        : { tone: "lent", text: `Ausgeliehen bis ${fmtDay(dayToDate(dueDay(s.lent_until)))}` };
    }
    case "reserved":
      return { tone: "wait", text: s.next_start ? `Gebucht ab ${fmtDay(dayToDate(s.next_start))}` : "Reserviert" };
    case "requested":
      return { tone: "accent", text: s.open_requests === 1 ? "1 Anfrage" : `${s.open_requests} Anfragen` };
    case "paused":
      return { tone: "done", text: "Regal pausiert" };
    case "not_offered":
      return { tone: "done", text: "Nicht angeboten" };
    default:
      return { tone: "ok", text: "Verfügbar" };
  }
}
