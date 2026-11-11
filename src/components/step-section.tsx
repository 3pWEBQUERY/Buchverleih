import type { ReactNode } from "react";
import { cx } from "./ui";

/**
 * Nummerierter Abschnitt (01, 02 …) wie auf «Buch bearbeiten» und der Exemplarseite:
 * Nummer links in eigener Spalte, Titel mit kurzer Erklärung, Inhalt eingerückt.
 */
export function StepSection({ id, n, title, desc, aside, children, first, className }: {
  id?: string; n: number; title: ReactNode; desc?: ReactNode; aside?: ReactNode; children: ReactNode; first?: boolean; className?: string;
}) {
  const tid = id ? `${id}-t` : undefined;
  return (
    <section id={id} aria-labelledby={tid} className={cx("scroll-mt-28", first ? "pt-2" : "pt-10 md:pt-12 mt-10 md:mt-12 border-t border-line", className)}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-6">
        <span className="text-[13px] tnum text-muted pt-1.5">{String(n).padStart(2, "0")}</span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 min-w-0">
          <div className="min-w-0">
            <h2 id={tid} className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] leading-tight">{title}</h2>
            {desc && <p className="text-[15px] text-muted mt-1.5 max-w-2xl">{desc}</p>}
          </div>
          {aside && <div className="text-[13.5px] text-muted pb-1">{aside}</div>}
        </div>
      </div>
      <div className="md:pl-[72px] min-w-0">{children}</div>
    </section>
  );
}

/** Ruhige Kennzahl-Kachel: Zahl gross, Beschriftung darunter */
export function StatTile({ n, label, href, live }: { n: ReactNode; label: string; href?: string | null; live?: boolean }) {
  const inner = (
    <>
      <dt className="text-[12px] text-muted mt-1.5">{label}</dt>
      <dd className="text-[24px] md:text-[28px] font-[560] tracking-[-0.04em] leading-none tnum flex items-center gap-2">
        {n}
        {live && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />}
      </dd>
    </>
  );
  // Innerhalb einer <dl>: dt/dd bleiben direkte Kinder des div, der Link liegt als Fläche darüber
  return (
    <div className={cx("relative rounded-[8px] bg-paper-2 px-4 py-3 min-w-[92px] flex flex-col-reverse justify-end", href && "hover:bg-paper-3 transition-colors")}>
      {inner}
      {href && <a href={href} className="absolute inset-0 rounded-[8px]" aria-label={`${n} ${label}`} />}
    </div>
  );
}
