import Link from "next/link";
import type { ReactNode } from "react";
import type { PulseItem } from "@/lib/pulse";
import type { Locale } from "@/lib/i18n/locale";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { Monogram } from "@/components/person/monogram";
import { IconChat, IconSwap } from "@/components/icons";
import { cx } from "@/components/ui";

/**
 * Puls (5.4): «Diese Woche in deinen Kreisen». Nur Aggregiertes oder selbst Veröffentlichtes –
 * Zahl der gewanderten Bücher, wer Bücher ins Regal gestellt hat, neue Zettel.
 * Reine Darstellung ohne Zustand: Überschrift und Rahmen bestimmt die Seite, die die Liste zeigt.
 * `showCircle` nennt den Kreis dazu (Start); auf der Kreisseite ist er klar.
 */
export function PulseList({ items, l, showCircle = false, className }: { items: PulseItem[]; l: Locale; showCircle?: boolean; className?: string }) {
  const t = CIRCLES[l];
  const p = t.pulse;
  if (!items.length) return null;

  const mark = (icon: ReactNode) => (
    <span aria-hidden className="h-7 w-7 flex-none rounded-full bg-paper-2 text-ink-2 grid place-items-center">{icon}</span>
  );
  const circle = (name: string) => (showCircle ? <span className="block text-meta text-muted">{p.inCircle(name)}</span> : null);
  const row = "flex items-start gap-3 py-2 min-w-0";

  return (
    <ul className={cx("text-body-sm text-ink-2", className)}>
      {items.map((it) => {
        if (it.type === "moved") {
          return (
            <li key="moved" className={row}>
              {mark(<IconSwap width={15} height={15} />)}
              <span className="min-w-0 pt-0.5 tnum">{p.moved(it.count)}</span>
            </li>
          );
        }
        if (it.type === "shelved") {
          return (
            <li key={`s-${it.user.id}-${it.circle.id}`} className={row}>
              <Monogram name={it.user.first_name} seed={it.user.id} photo={it.user.avatar_key} size={28} />
              <span className="min-w-0 pt-0.5 tnum">
                {p.shelved(it.user.first_name, it.count)}
                {circle(it.circle.name)}
              </span>
            </li>
          );
        }
        const { post } = it;
        const head = post.kind === "announce" || !post.title
          ? p.announce(post.first_name)
          : post.kind === "search" ? p.search(post.first_name, post.title) : p.recommend(post.first_name, post.title);
        return (
          <li key={`p-${post.id}`} className="min-w-0">
            <Link href={`/kreise/${post.circle.id}#pinnwand`} className={cx(row, "group min-h-11 hover:text-ink transition-colors")}>
              {mark(<IconChat width={15} height={15} />)}
              <span className="min-w-0 pt-0.5">
                <span className="block">
                  <span className="text-muted">{t.pin.kinds[post.kind]} · </span>
                  <span className="group-hover:underline underline-offset-4 decoration-1">{head}</span>
                </span>
                {post.text && <span className="block text-meta text-muted truncate">{post.text}</span>}
                {circle(post.circle.name)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
