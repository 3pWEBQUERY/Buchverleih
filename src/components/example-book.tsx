import Link from "next/link";
import { Cover } from "@/components/cover";
import { IconArrowRight } from "@/components/icons";
import type { NearestFreeCopy } from "@/lib/copies";
import { fmtDistance } from "@/lib/geo";
import type { Locale } from "@/lib/i18n/locale";
import { HOME } from "@/lib/i18n/messages/home";

/** Konkretes Beispiel für leere Zustände: das nächste gerade freie Buch im Umkreis, als eine Zeile mit Cover. */
export function ExampleBook({ copy, l }: { copy: NearestFreeCopy; l: Locale }) {
  const t = HOME[l];
  return (
    <Link href={`/exemplar/${copy.id}`} className="book press-card group flex items-center gap-4 min-h-11">
      <span className="book-face flex-none">
        <Cover l={l} width={48} height={72} uniform
          data={{ title: copy.title, authors: copy.authors, photoKey: copy.photo_key, photoW: copy.photo_w, photoH: copy.photo_h, photoColor: copy.photo_color, coverKey: copy.cover_key, coverColor: copy.cover_color, seed: copy.work_id }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />{t.exampleEyebrow}</span>
        <span lang="de" className="block font-serif text-lead leading-snug mt-1 line-clamp-2 group-hover:underline underline-offset-2">{copy.title}</span>
        <span className="block text-meta text-muted mt-0.5">{t.exampleBy(copy.owner_name, fmtDistance(copy.distance_km * 1000, l) ?? "")}</span>
      </span>
      <span className="flex-none inline-flex items-center gap-1 text-body-sm font-medium text-accent-hover">{t.exampleCta} <IconArrowRight width={14} height={14} /></span>
    </Link>
  );
}
