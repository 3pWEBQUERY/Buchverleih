/** Kleine Listen für die Befehlspalette (⌘K): eigene Bücher, Kreise, laufende Vorgänge. */
import { myCircles } from "@/lib/circles";
import { listShelf } from "@/lib/copies";
import { myLoans } from "@/lib/loans/queries";
import { OPEN, type LoanStatus } from "@/lib/loans/machine";

export type PaletteData = {
  /** eigene Bücher, neueste zuerst (höchstens 200) */
  books: { id: string; title: string; authors: string[] }[];
  /** Kreise, in denen ich aktives Mitglied bin */
  circles: { id: string; name: string }[];
  /** laufende Vorgänge, was auf mich wartet zuerst (höchstens 50) */
  loans: { id: string; title: string; other_first_name: string; status: LoanStatus; turn_is_mine: boolean }[];
};

export async function paletteData(userId: string): Promise<PaletteData> {
  const [shelf, circles, loans] = await Promise.all([listShelf(userId), myCircles(userId), myLoans(userId)]);
  return {
    books: shelf.slice(0, 200).map((c) => ({ id: c.id, title: c.title, authors: c.authors })),
    circles: circles.filter((c) => c.my_status === "active").map((c) => ({ id: c.id, name: c.name })),
    loans: loans
      .filter((x) => OPEN.includes(x.status))
      .slice(0, 50)
      .map((x) => ({ id: x.id, title: x.title, other_first_name: x.other_name, status: x.status, turn_is_mine: x.turn === "me" && Boolean(x.step) })),
  };
}
