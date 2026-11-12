import type { ReactNode } from "react";
import { cx } from "./ui";
import { getLocale } from "@/lib/i18n/server";
import { COMMON } from "@/lib/i18n/messages/common";

/**
 * Lade-Skelette im Stil der fertigen Seiten: Titel mit Kennzahlen, nummerierte Abschnitte,
 * Karten, dunkles Regal und Produktblatt. Für Screenreader als Status mit Text angekündigt.
 */
export async function SkPage({ label, children }: { label: string; children: ReactNode }) {
  // Die Beschriftungen der Ladeseiten sind deutsch; in FR/IT genügt ein allgemeines «Lädt …»
  const l = await getLocale();
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{l === "de" ? label : COMMON[l].loading}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

const B = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

/** Seitentitel wie PageTitle: Eyebrow, zweizeiliger Titel, rechts Kennzahl-Kacheln */
export function SkTitle({ tiles = 0, sub = true }: { tiles?: number; sub?: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 mb-10 md:mb-12">
      <div className="min-w-0 flex-1">
        <B className="h-3 w-40" />
        <B className="h-[34px] md:h-[46px] w-full max-w-[520px] mt-3 rounded-[8px]" />
        {sub && <B className="h-4 w-full max-w-md mt-4" />}
      </div>
      {tiles > 0 && (
        <div className={cx("grid gap-2 w-full sm:w-auto", tiles === 4 ? "grid-cols-4" : tiles === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {Array.from({ length: tiles }).map((_, i) => <B key={i} className="h-[76px] sm:w-[104px] rounded-[8px]" />)}
        </div>
      )}
    </header>
  );
}

/** Nummerierter Abschnitt wie StepSection */
export function SkSection({ first, children }: { first?: boolean; children: ReactNode }) {
  return (
    <section className={cx(first ? "pt-2" : "pt-10 md:pt-12 mt-10 md:mt-12 border-t border-line")}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-2 mb-6">
        <B className="h-3 w-5 mt-2" />
        <div><B className="h-7 w-56 rounded-[6px]" /><B className="h-4 w-full max-w-lg mt-3" /></div>
      </div>
      <div className="md:pl-[72px]">{children}</div>
    </section>
  );
}

/** Karten im Raster (Vorgänge, Wunschliste, Kreise …) */
export function SkCards({ count = 2, cols = 2, tall }: { count?: number; cols?: 1 | 2 | 3; tall?: boolean }) {
  return (
    <div className={cx("grid gap-3", cols === 2 && "xl:grid-cols-2", cols === 3 && "sm:grid-cols-2 xl:grid-cols-3")}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[10px] border border-line p-4 md:p-5">
          <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
            <B className="h-[84px] rounded-[3px]" />
            <div><B className="h-3 w-28" /><B className="h-6 w-4/5 mt-2.5 rounded-[6px]" /><B className="h-3 w-32 mt-2" /></div>
          </div>
          <B className={cx("mt-4 rounded-[8px]", tall ? "h-[104px]" : "h-[72px]")} />
        </div>
      ))}
    </div>
  );
}

/** Zeilen in einer Karte (Benachrichtigungen, Einstellungen, Listen) */
export function SkRows({ count = 5 }: { count?: number }) {
  return (
    <div className="rounded-[10px] border border-line divide-y divide-line">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 md:px-5 py-4 flex items-center gap-4">
          <B className="h-9 w-9 rounded-[8px] flex-none" />
          <div className="flex-1 min-w-0"><B className="h-4 w-3/5" /><B className="h-3 w-2/5 mt-2" /></div>
          <B className="h-3 w-14 flex-none" />
        </div>
      ))}
    </div>
  );
}

/** Dunkles Regal mit Buchrücken */
export function SkShelf({ books = 7 }: { books?: number }) {
  return (
    <div className="surface-night rounded-[12px] px-5 md:px-8 pt-6 pb-5">
      <div className="h-6 w-40 rounded-[6px] bg-night-2" />
      <div className="mt-5 flex items-end gap-6 overflow-hidden">
        {Array.from({ length: books }).map((_, i) => (
          <div key={i} className="flex-none">
            <div className="h-[156px] w-[104px] rounded-[3px] bg-night-2" />
            <div className="h-3 w-20 mt-4 rounded-[4px] bg-night-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detailseite: links Produktblatt (Cover/Bild + Angaben), rechts Titel und Abschnitte */
export function SkSheet({ round, children }: { round?: boolean; children?: ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
      <aside className="space-y-5">
        <div className="hidden lg:flex rounded-[12px] border border-line bg-paper-2 p-8 justify-center">
          <B className={round ? "h-32 w-32 rounded-full" : "h-[330px] w-[220px] rounded-[3px]"} />
        </div>
        <div className="lg:hidden flex gap-5 items-end"><B className={round ? "h-20 w-20 rounded-full" : "h-[156px] w-[104px] rounded-[3px]"} /><B className="h-7 w-40" /></div>
        <B className="hidden lg:block h-8 w-3/4 rounded-[6px]" />
        <div className="rounded-[10px] border border-line p-4 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex justify-between"><B className="h-3 w-20" /><B className="h-3 w-24" /></div>)}
        </div>
      </aside>
      <div className="min-w-0">
        <B className="h-3 w-32" />
        <B className="h-[30px] md:h-[40px] w-full max-w-md mt-3 rounded-[8px]" />
        <div className="mt-8">{children ?? <><B className="h-[110px] rounded-[10px]" /><SkSection><SkRows count={3} /></SkSection></>}</div>
      </div>
    </div>
  );
}
