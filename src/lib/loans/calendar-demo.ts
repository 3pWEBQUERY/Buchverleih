import type { Calendar, CalendarBar } from "./calendar";
import { addDays } from "@/lib/dates";

/** Beispielkalender für die Startseite: dieselbe Komponente mit festen Beispieldaten */
export function demoCalendar(today: string): Calendar {
  const d = (n: number) => addDays(today, n);
  const bars: CalendarBar[] = [
    { id: 1, start: d(-12), end: d(16), bufferDays: 3, kind: "loan", status: "active", loanId: null, name: "Lea", mine: false, paused: false, note: null, passOn: false, handoverChatId: null },
    { id: 2, start: d(19), end: d(47), bufferDays: 3, kind: "loan", status: "accepted", loanId: null, name: "Jonas", mine: false, paused: false, note: null, passOn: false, handoverChatId: null },
    { id: 3, start: d(58), end: d(66), bufferDays: 0, kind: "block", status: null, loanId: null, name: null, mine: false, paused: false, note: "Ferien", passOn: false, handoverChatId: null },
  ];
  return {
    copyId: "demo", today, horizonEnd: d(90), loanDays: 28, bufferDays: 3, maxFutureBookings: 3, futureBookings: 1, bars,
    free: [{ start: d(50), end: d(58), days: 8 }, { start: d(66), end: d(120), days: 54 }],
  };
}
