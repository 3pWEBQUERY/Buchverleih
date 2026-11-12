/** Status eines Exemplars im Büchergestell, in der Sprache der Person (wie shelfStatusText) */
import type { ShelfStatus } from "@/lib/copies";
import type { Tone } from "@/components/status";
import { dayToDate, dueDay, fmtDay } from "@/lib/dates";
import type { Locale } from "../locale";
import { SHELF } from "./shelf";

export function shelfStatusLocal(
  s: { status: ShelfStatus; lent_until: Date | null; next_start: string | null; open_requests: number },
  l: Locale,
): { tone: Tone; text: string } {
  const t = SHELF[l].status;
  switch (s.status) {
    case "lent": {
      if (!s.lent_until) return { tone: "lent", text: t.lent };
      const day = fmtDay(dayToDate(dueDay(s.lent_until)), l);
      return new Date(s.lent_until) < new Date() ? { tone: "late", text: t.overdueSince(day) } : { tone: "lent", text: t.lentUntil(day) };
    }
    case "reserved":
      return { tone: "wait", text: s.next_start ? t.bookedFrom(fmtDay(dayToDate(s.next_start), l)) : t.reserved };
    case "requested":
      return { tone: "accent", text: SHELF[l].requests(s.open_requests) };
    case "paused":
      return { tone: "done", text: t.paused };
    case "not_offered":
      return { tone: "done", text: SHELF[l].notOfferedCap };
    default:
      return { tone: "ok", text: t.available };
  }
}
