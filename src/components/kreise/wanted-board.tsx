import Link from "next/link";
import type { CircleWanted } from "@/lib/wishlist";
import type { Locale } from "@/lib/i18n/locale";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { Cover } from "@/components/cover";

/**
 * Brett «Gesucht im Kreis» (5.2): Titel, die Mitglieder von ihrer Wunschliste teilen.
 * Nur die Anzahl, nie Namen. Wer den Titel selbst besitzt, kommt mit einem Tipp zum eigenen Exemplar.
 */
export function WantedBoard({ items, l, inShelf }: { items: CircleWanted[]; l: Locale; /** eigene Exemplare, die schon im Kreisregal stehen */ inShelf: string[] }) {
  const t = CIRCLES[l].wanted;
  if (!items.length) return null;
  return (
    <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
      {items.map((w) => (
        <li key={w.work_id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 min-w-0">
          <Link href={`/titel/${w.work_id}`} tabIndex={-1} aria-hidden className="self-start">
            <Cover l={l} data={{ title: w.title, authors: w.authors, coverKey: w.cover_key, seed: w.work_id }} width={48} />
          </Link>
          <div className="min-w-0">
            <Link href={`/titel/${w.work_id}`} className="font-serif text-lead leading-tight hover:underline underline-offset-4 decoration-1 break-words">{w.title}</Link>
            {w.authors.length > 0 && <p className="text-body-sm text-muted truncate">{w.authors.join(", ")}</p>}
            <p className="text-meta text-ink-2 mt-1 tnum">{t.count(w.count)}</p>
            {w.my_copy_id && (
              <Link href={`/regal/${w.my_copy_id}`} className="inline-flex items-center min-h-11 text-body-sm font-medium text-ink-2 underline underline-offset-4 decoration-1 hover:text-ink">
                {inShelf.includes(w.my_copy_id) ? t.haveView : t.haveShelve}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
