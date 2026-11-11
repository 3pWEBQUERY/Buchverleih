import Link from "next/link";
import type { ShelfCopy } from "@/lib/copies";
import { Cover } from "@/components/cover";
import { shelfStatusText, type Tone } from "@/components/status";

/** Statuspunkte auf der dunklen Bühne: helle Varianten der Statusfarben (wie auf der Startseite) */
const NIGHT_DOT: Record<Tone, string> = {
  ok: "#8fd09a",
  lent: "#f0c060",
  late: "#ff8aa3",
  wait: "#a9bfe3",
  done: "#a39d91",
  accent: "var(--accent)",
};

/** Eine Regalreihe auf `surface-night`: Cover auf einem hellen Brett, darunter Titel und Status */
export function NightShelf({ items, label, offset = 0 }: { items: ShelfCopy[]; label: string; offset?: number }) {
  return (
    <ul className="shelf" aria-label={label}>
      {items.map((c, i) => {
        const cover = { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id };
        const w = 114;
        const st = shelfStatusText(c);
        return (
          <li key={c.id} style={{ width: w, animationDelay: `${Math.min(offset + i, 12) * 30}ms` }} className="anim-rise">
            <Link href={`/exemplar/${c.id}`} className="book block group">
              <div className="flex items-end" style={{ height: 190 }}>
                <div className="book-face"><Cover data={cover} width={114} height={171} uniform /></div>
              </div>
              <div className="h-[3px] bg-night-ink/90 rounded-full" />
              <p className="pt-2.5 text-[13.5px] font-medium leading-snug line-clamp-2 min-h-[2.75em] group-hover:underline">{c.title}</p>
              <p className="text-[12px] leading-snug text-night-muted mt-1 flex items-start gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 mt-[5px] rounded-full flex-none" style={{ background: NIGHT_DOT[st.tone] }} />
                <span className="line-clamp-2">{st.text}</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
