import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./ui";
import { RollingNumber } from "./motion";

/**
 * Nummerierter Abschnitt (01, 02 …) wie auf «Buch bearbeiten» und der Exemplarseite:
 * Nummer links in eigener Spalte, Titel mit kurzer Erklärung, Inhalt eingerückt.
 */
export function StepSection({ id, n, title, desc, aside, children, first, className }: {
  id?: string; n: number; title: ReactNode; desc?: ReactNode; aside?: ReactNode; children: ReactNode; first?: boolean; className?: string;
}) {
  const tid = id ? `${id}-t` : undefined;
  return (
    <section id={id} aria-labelledby={tid} className={cx("scroll-mt-28", !first && "reveal", first ? "pt-2" : "pt-10 md:pt-12 mt-10 md:mt-12 border-t border-line", className)}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-6">
        <span className="text-meta tnum text-muted pt-1.5">{String(n).padStart(2, "0")}</span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 min-w-0">
          <div className="min-w-0">
            <h2 id={tid} className="text-title font-title tracking-title leading-tight">{title}</h2>
            {desc && <p className="text-body text-muted mt-1.5 max-w-2xl">{desc}</p>}
          </div>
          {aside && <div className="text-body-sm text-muted pb-1">{aside}</div>}
        </div>
      </div>
      <div className="md:pl-[72px] min-w-0">{children}</div>
    </section>
  );
}

/** Ruhige Kennzahl-Kachel: Zahl gross, Beschriftung darunter */
export function StatTile({ n, label, href, live }: { n: ReactNode; label: string; href?: string | null; live?: boolean }) {
  // Innerhalb einer <dl> sind nur dt/dd-Gruppen erlaubt: der Link liegt als Fläche im dd, nicht daneben
  const cover = "absolute inset-0 rounded-md";
  return (
    <div className={cx("relative rounded-md bg-paper-2 px-3 sm:px-4 py-3 min-w-0 sm:min-w-[92px] flex flex-col-reverse justify-end", href && "hover:bg-paper-3 press-card")}>
      <dt className="text-caption text-muted mt-1.5">{label}</dt>
      <dd className="text-title font-title tracking-display leading-none tnum flex items-center gap-2">
        {/* Zählt nur um, wenn sich der Wert bei offener Seite ändert (Live), nie beim Laden */}
        {typeof n === "number" || typeof n === "string" ? <RollingNumber value={n} /> : n}
        {live && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />}
        {/* Routen ohne vollen Seitenwechsel; reine Anker (#abschnitt) bleiben gewöhnliche Links */}
        {href && (href.startsWith("#")
          ? <a href={href} className={cover} aria-label={`${n} ${label}`} />
          : <Link href={href} className={cover} aria-label={`${n} ${label}`} />)}
      </dd>
    </div>
  );
}
