import Link from "next/link";
import type { ShelfCopy } from "@/lib/copies";
import { Cover, coverRatio } from "@/components/cover";
import { shelfStatusText, type Tone } from "@/components/status";
import { cx } from "@/components/ui";

/**
 * Ein Brett im Büchergestell auf dunkler Fläche: die Cover stehen auf einem durchgehenden
 * 3-px-Brett, darunter Titel und Status als Text. Auch für Kreisregale verwendet.
 */
// Auf der dunklen Fläche gelten feste, helle Statusfarben (wie auf der Startseite)
const NIGHT_DOT: Record<Tone, string> = {
  ok: "bg-[#8fd09a]",
  lent: "bg-[#f0c060]",
  late: "bg-[#ff8aa3]",
  wait: "bg-[#a9bfe3]",
  done: "bg-night-muted",
  accent: "bg-accent",
};

export type BookRowItem = Pick<ShelfCopy, "id" | "title" | "authors" | "photo_key" | "photo_w" | "photo_h" | "cover_key" | "work_id"> &
  Partial<Pick<ShelfCopy, "status" | "lent_until" | "next_start" | "open_requests">> & { href?: string; meta?: string };

export function BookRow({ items, height = 168, hrefBase = "/regal/", label }: { items: BookRowItem[]; height?: number; hrefBase?: string; label?: string }) {
  return (
    <ul className="shelf !gap-0 !items-start mt-1" aria-label={label}>
      {items.map((c, i) => {
        const cover = { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id };
        const cw = Math.round(height * coverRatio(cover));
        const w = Math.max(128, cw);
        const st = c.status ? shelfStatusText({ status: c.status, lent_until: c.lent_until ?? null, next_start: c.next_start ?? null, open_requests: c.open_requests ?? 0 }) : null;
        const last = i === items.length - 1;
        return (
          <li key={c.id} style={{ width: w + (last ? 0 : 22), animationDelay: `${Math.min(i, 10) * 30}ms` }} className="anim-rise relative">
            {/* durchgehendes Brett: läuft unter dem Zwischenraum weiter */}
            <div aria-hidden className="absolute left-0 right-0 h-[3px] bg-night-ink/90" style={{ top: height }} />
            <Link href={c.href ?? `${hrefBase}${c.id}`} className="book group block" style={{ width: w }}>
              <div className="flex items-end" style={{ height }}>
                <div className="book-face"><Cover data={cover} height={Math.round(height * (0.86 + ((i * 7) % 4) * 0.045))} /></div>
              </div>
              <div className="pt-[13px] pr-2">
                <p className="text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline underline-offset-2">{c.title}</p>
                {st ? (
                  <p className="text-[12px] text-night-muted mt-1 flex items-center gap-1.5">
                    <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", NIGHT_DOT[st.tone])} />
                    <span className="truncate">{st.text}</span>
                  </p>
                ) : c.meta ? (
                  <p className="text-[12px] text-night-muted mt-1 truncate">{c.meta}</p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
      {/* Rest des Bretts bis zum rechten Rand */}
      <li aria-hidden className="relative min-w-[22px]" style={{ flex: "1 0 22px" }}>
        <div className="absolute left-0 right-0 h-[3px] bg-night-ink/90" style={{ top: height }} />
      </li>
    </ul>
  );
}
