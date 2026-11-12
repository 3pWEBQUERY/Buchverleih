import Link from "next/link";
import type { ShelfCopy } from "@/lib/copies";
import { Cover } from "@/components/cover";
import { shelfStatusText, type Tone } from "@/components/status";
import { cx } from "@/components/ui";

/**
 * Ein Brett im Büchergestell auf dunkler Fläche: die Cover stehen auf einem durchgehenden
 * 3-px-Brett, darunter Titel und Status als Text. Der Status steht
 * immer auf derselben Linie ganz unten, egal wie lang der Titel ist. Auch für Kreisregale verwendet.
 */
// Auf der dunklen Fläche gelten feste, helle Statusfarben (wie auf der Startseite)
const NIGHT_DOT: Record<Tone, string> = {
  ok: "bg-night-ok",
  lent: "bg-night-lent",
  late: "bg-night-late",
  wait: "bg-night-wait",
  done: "bg-night-muted",
  accent: "bg-accent",
};

export type BookRowItem = Pick<ShelfCopy, "id" | "title" | "authors" | "photo_key" | "photo_w" | "photo_h" | "cover_key" | "work_id"> &
  Partial<Pick<ShelfCopy, "status" | "lent_until" | "next_start" | "open_requests">> & { href?: string; note?: { tone: Tone; text: string } };

/** `wrap`: statt seitlich zu scrollen, laufen die Bücher auf weiteren Brettern weiter (für schmale Spalten) */
export function BookRow({ items, height = 168, hrefBase = "/regal/", label, wrap }: { items: BookRowItem[]; height?: number; hrefBase?: string; label?: string; wrap?: boolean }) {
  return (
    <ul className={cx("shelf !gap-0 !items-stretch mt-1 !pb-1", wrap && "!flex-wrap !overflow-visible !gap-y-9")} aria-label={label}>
      {items.map((c, i) => {
        const cover = { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id };
        const bw = Math.round(height * (2 / 3)); // gleiche Grösse für alle Bücher
        const w = Math.max(128, bw);
        const st = c.note ?? (c.status ? shelfStatusText({ status: c.status, lent_until: c.lent_until ?? null, next_start: c.next_start ?? null, open_requests: c.open_requests ?? 0 }) : null);
        const last = i === items.length - 1;
        return (
          <li key={c.id} style={{ width: w + (wrap ? 14 : last ? 0 : 22), animationDelay: `${Math.min(i, 10) * 30}ms` }} className="anim-rise relative">
            {/* durchgehendes Brett: läuft unter dem Zwischenraum weiter */}
            <div aria-hidden className="absolute left-0 right-0 h-[3px] bg-night-ink/90" style={{ top: height }} />
            <Link href={c.href ?? `${hrefBase}${c.id}`} className="book group flex flex-col h-full" style={{ width: w }}>
              <div className="flex items-end flex-none" style={{ height }}>
                <div className="book-face"><Cover data={cover} width={bw} height={height} uniform /></div>
              </div>
              <div className="pt-[13px] pr-2 flex-1 flex flex-col">
                <p className="text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline underline-offset-2">{c.title}</p>
                {st ? (
                  <p className="text-[12px] text-night-muted mt-auto pt-1 flex items-center gap-1.5">
                    <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", NIGHT_DOT[st.tone])} />
                    <span className="truncate">{st.text}</span>
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
      {/* Rest des Bretts bis zum rechten Rand */}
      {!wrap && <li aria-hidden className="relative min-w-[22px]" style={{ flex: "1 0 22px" }}>
        <div className="absolute left-0 right-0 h-[3px] bg-night-ink/90" style={{ top: height }} />
      </li>}
    </ul>
  );
}
