import Link from "next/link";
import { relatedForCopy, type Related, type RelatedCopy } from "@/lib/copies";
import { fmtDistance } from "@/lib/geo";
import { BookRow } from "@/components/regal/book-row";
import { IconArrowRight } from "@/components/icons";
import { cx } from "@/components/ui";
import type { Locale } from "@/lib/i18n/locale";
import { labels } from "@/lib/i18n/labels";
import { getLocale } from "@/lib/i18n/server";
import { TITLE } from "@/lib/i18n/messages/title";

type ShelfKey = "regal" | "titel" | "autor" | "genre" | "neu";

const labelsGenre = (l: Locale, g: string) => labels(l).genreLabel[g] ?? g;

/** Weiterstöbern: mehrere Bretter mit weiteren Büchern rund um dieses Exemplar */
export function MoreBooks({ related, ownerName, ownerId, workId, title, hasOrigin, skip = [], l = "de" }: {
  related: Related; ownerName: string; ownerId: string; workId: string; title: string; hasOrigin: boolean; skip?: ShelfKey[]; l?: Locale;
}) {
  const t = TITLE[l].more;
  const where = hasOrigin ? t.inYourArea : t.near;
  const note = (c: RelatedCopy) => {
    const free = c.status === "available";
    const d = c.dist != null ? fmtDistance(c.dist) : null;
    return { tone: free ? ("ok" as const) : ("lent" as const), text: [free ? t.free : t.taken, c.owner_name, d].filter(Boolean).join(" · ") };
  };
  const shelves: { id: string; title: string; desc: string; items: RelatedCopy[]; link?: { href: string; label: string }; withNote: boolean }[] = [
    { id: "regal", title: t.ownerTitle(ownerName), desc: t.ownerDesc, items: related.owner, link: { href: `/profil/${ownerId}`, label: t.ownerLink }, withNote: false },
    { id: "titel", title: t.workTitle(title), desc: t.workDesc, items: related.sameWork, link: { href: `/titel/${workId}`, label: t.workLink }, withNote: true },
    { id: "autor", title: t.authorTitle(related.authorName ?? ""), desc: t.authorDesc(where), items: related.author, link: related.authorName ? { href: `/suche?q=${encodeURIComponent(related.authorName)}`, label: t.authorLink } : undefined, withNote: true },
    { id: "genre", title: t.genreTitle(related.genreName ? labelsGenre(l, related.genreName) : ""), desc: t.genreDesc(where), items: related.genre, link: related.genreName ? { href: `/suche?genre=${encodeURIComponent(related.genreName)}`, label: t.genreLink } : undefined, withNote: true },
    { id: "neu", title: t.newTitle(where), desc: t.newDesc, items: related.nearby, link: { href: "/suche", label: t.newLink }, withNote: true },
  ].filter((s) => s.items.length > 0 && !skip.includes(s.id as ShelfKey));
  if (!shelves.length) return null;
  const total = shelves.reduce((n, s) => n + s.items.length, 0);

  return (
    <section aria-labelledby="weiter" className="mt-16 md:mt-24 pt-10 md:pt-12 border-t border-line">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="weiter" className="display text-[28px] md:text-[38px] mt-2">{t.heading(where)[0]}<em>{t.heading(where)[1]}</em></h2>
        </div>
        <p className="text-[14px] text-muted tnum pb-1">{t.total(total, shelves.length)}</p>
      </header>

      <nav aria-label={t.shelves} className="mt-6 flex flex-wrap gap-2">
        {shelves.map((s) => (
          <a key={s.id} href={`#mehr-${s.id}`} className="h-9 pl-3.5 pr-1.5 rounded-[8px] border border-line inline-flex items-center gap-2.5 text-[13.5px] font-medium hover:border-accent hover:text-accent-hover transition-colors">
            <span className="max-w-[28ch] truncate">{s.title}</span>
            <span className="h-6 min-w-6 px-1.5 rounded-[5px] bg-paper-2 text-ink-2 text-[12px] grid place-items-center tnum">{s.items.length}</span>
          </a>
        ))}
      </nav>

      {/* Kleine Bretter (bis 3 Bücher) stehen auf grossen Bildschirmen paarweise nebeneinander */}
      <div className="mt-10 grid lg:grid-cols-2 gap-x-8 gap-y-12 md:gap-y-14 [grid-auto-flow:dense]">
        {shelves.map((s) => (
          <div key={s.id} id={`mehr-${s.id}`} className={cx("scroll-mt-28 min-w-0 flex flex-col", s.items.length > 3 && "lg:col-span-2")}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-4">
              <div className="min-w-0">
                <h3 className="text-[20px] md:text-[24px] font-[560] tracking-[-0.03em] leading-tight">{s.title}</h3>
                <p className="text-[14.5px] text-muted mt-1">{s.desc}</p>
              </div>
              {s.link && (
                <Link href={s.link.href} className="inline-flex items-center gap-1 text-[13.5px] font-medium text-accent-hover hover:underline underline-offset-4 pb-1">
                  {s.link.label} <IconArrowRight width={14} height={14} />
                </Link>
              )}
            </div>
            <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0 flex-1">
              <BookRow label={s.title} height={165} hrefBase="/exemplar/"
                items={s.withNote ? s.items.map((c) => ({ ...c, note: note(c) })) : s.items} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Lädt «Weiterstöbern» selbst – gedacht für <Suspense>, damit die Seite nicht auf diese
 * zusätzlichen Abfragen wartet und der Datenbank-Pool nicht auf einmal ausgeschöpft wird.
 */
export async function MoreBooksLoader({ copyId, viewerId, origin, ...rest }: {
  copyId: string; viewerId: string | null; origin: { lat: number; lng: number } | null;
  ownerName: string; ownerId: string; workId: string; title: string; hasOrigin: boolean; skip?: ShelfKey[];
}) {
  const related = await relatedForCopy(copyId, viewerId, origin).catch(() => null);
  if (!related) return null;
  return <MoreBooks related={related} {...rest} l={await getLocale()} />;
}
