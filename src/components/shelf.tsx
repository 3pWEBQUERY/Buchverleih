import Link from "next/link";
import type { ReactNode } from "react";
import { Cover, coverRatio, type CoverData } from "./cover";
import { cx } from "./ui";

/**
 * Regale als horizontale Reihen wie im Büchergestell (PRD 8.1). Die Cover stehen
 * auf einer Linie, darunter steht der Status als Text.
 */
export type ShelfItem = {
  id: string;
  href: string;
  cover: CoverData;
  caption?: ReactNode;
  meta?: ReactNode;
};

export function Shelf({ items, height = 176, className, label }: { items: ShelfItem[]; height?: number; className?: string; label: string }) {
  return (
    <div className={cx("relative", className)}>
      <ul className="shelf" aria-label={label}>
        {items.map((it, i) => {
          const w = Math.round(height * coverRatio(it.cover));
          return (
            <li key={it.id} style={{ width: Math.max(w, 96), animationDelay: `${Math.min(i, 10) * 24}ms` }} className="anim-rise">
              <Link href={it.href} className="book block group">
                <div className="flex items-end" style={{ height }}>
                  <div className="book-face">
                    <Cover data={it.cover} height={Math.round(height * (0.9 + ((i * 7) % 10) / 100))} />
                  </div>
                </div>
                <div className="shelf-board" />
                <div className="pt-2 pr-1">
                  {it.caption && <div className="text-[13px] leading-snug line-clamp-2 group-hover:underline">{it.caption}</div>}
                  {it.meta && <div className="mt-1">{it.meta}</div>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Platzhalter in der Form des Inhalts (PRD 8.2: keine Ladekreisel) */
export function ShelfSkeleton({ count = 7, height = 176 }: { count?: number; height?: number }) {
  return (
    <div className="shelf" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: Math.round(height * 0.66) }}>
          <div className="flex items-end" style={{ height }}>
            <div className="skeleton w-full" style={{ height: height * (0.86 + (i % 3) * 0.05) }} />
          </div>
          <div className="shelf-board" />
          <div className="skeleton h-3 w-4/5 mt-2.5" />
          <div className="skeleton h-3 w-1/2 mt-1.5" />
        </div>
      ))}
    </div>
  );
}
