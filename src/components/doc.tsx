import type { ReactNode } from "react";
import { cx } from "./ui";

/**
 * Lesetexte (Hilfe, Regeln, Nutzungsbedingungen, Datenschutz) wie eine gut gesetzte
 * Buchseite: Zeilenlänge um 68 Zeichen, Serif-Überschriften, Tabellen mit Haarlinien,
 * Inhaltsverzeichnis links (Desktop, mitlaufend) bzw. aufklappbar (Handy).
 */
export type TocItem = [id: string, label: string];

export function DocPage({ eyebrow, title, lead, draft, toc, updated, children }: {
  eyebrow: string; title: string; lead?: ReactNode; draft?: boolean; toc: TocItem[]; updated?: string; children: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-x-14 xl:gap-x-20">
      <nav aria-label="Inhalt" className="hidden lg:block">
        <div className="sticky top-12 pt-1">
          <p className="eyebrow mb-3">Inhalt</p>
          <ol className="flex flex-col text-sm border-l border-line">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block py-1.5 pl-4 -ml-px border-l border-transparent text-ink-2 hover:text-ink hover:border-ink leading-snug">{label}</a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <article className="min-w-0 max-w-[68ch]">
        <header className="mb-10 md:mb-14">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display text-4xl md:text-6xl mt-3">{title}</h1>
          {lead && <p className="text-lg md:text-xl text-ink-2 mt-5 leading-relaxed font-serif">{lead}</p>}
          {draft && (
            <div role="note" className="mt-8 border border-line-strong rounded-sm px-4 py-3">
              <p className="font-medium">Entwurf – Prüfung durch eine Fachperson ausstehend</p>
              <p className="text-sm text-ink-2 mt-1">Dieser Text ist noch nicht rechtlich geprüft und gilt erst nach der Prüfung. Stellen in eckigen Klammern werden vorher ergänzt.</p>
            </div>
          )}
          {updated && <p className="text-sm text-muted mt-4">Stand: {updated}</p>}
        </header>

        <details className="lg:hidden mb-10 border-y border-line group">
          <summary className="py-3 cursor-pointer list-none flex items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            Inhalt
            <span aria-hidden className="text-muted transition-transform duration-150 group-open:rotate-45 text-xl leading-none">+</span>
          </summary>
          <ol className="pb-3 flex flex-col text-[15px]">
            {toc.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block py-1.5 text-ink-2 hover:text-ink">{label}</a></li>
            ))}
          </ol>
        </details>

        <div className={DOC_TEXT}>{children}</div>
      </article>
    </div>
  );
}

/** Fliesstext-Stil für alles innerhalb von DocPage */
const DOC_TEXT = cx(
  "text-[16px] md:text-[17px] leading-[1.7] text-ink",
  "[&_p]:mt-4 [&_p:first-child]:mt-0",
  "[&_ul]:mt-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted [&_ol]:mt-4 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:marker:text-muted [&_ol]:marker:font-serif",
  "[&_li]:mt-1.5 [&_li]:pl-1",
  "[&_a]:underline [&_strong]:font-semibold",
);

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20 lg:scroll-mt-10 pt-10 md:pt-12 first:pt-0">
      <h2 id={`${id}-t`} className="text-2xl md:text-[1.9rem] leading-tight mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function DocSub({ children }: { children: ReactNode }) {
  return <h3 className="text-xl mt-8 mb-1">{children}</h3>;
}

/** Tabelle mit Haarlinien. Auf schmalen Bildschirmen als Liste von Zeilen. */
export function DocTable({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <figure className="mt-6 mb-2">
      <table className="hidden sm:table w-full text-[15px] leading-normal border-collapse">
        {caption && <caption className="text-left text-sm text-muted pb-2">{caption}</caption>}
        <thead>
          <tr className="border-b border-ink/70 text-left">
            {head.map((h) => <th key={h} scope="col" className="font-medium text-sm py-2 pr-5 last:pr-0 align-bottom">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => <td key={j} className={cx("py-2.5 pr-5 last:pr-0", j === 0 && "font-medium whitespace-nowrap")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <p className="sm:hidden text-sm text-muted pb-2">{caption}</p>}
      <dl className="sm:hidden border-t border-ink/70 divide-y divide-line text-[15px] leading-normal">
        {rows.map((r, i) => (
          <div key={i} className="py-3">
            <dt className="font-medium">{r[0]}</dt>
            {r.slice(1).map((c, j) => (
              <dd key={j} className="mt-1">
                {head.length > 2 && <span className="text-muted text-sm">{head[j + 1]}: </span>}{c}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </figure>
  );
}

/** Gegenüberstellung in zwei Spalten, z. B. «Lesespur» und «Schaden» */
export function DocCompare({ left, right }: { left: { title: string; items: ReactNode[] }; right: { title: string; items: ReactNode[] } }) {
  return (
    <div className="mt-6 grid sm:grid-cols-2 border-y border-line sm:divide-x divide-line">
      {[left, right].map((col, i) => (
        <div key={col.title} className={cx("py-5", i === 0 ? "sm:pr-6" : "border-t border-line sm:border-t-0 sm:pl-6")}>
          <p className="font-serif text-xl">{col.title}</p>
          <ul className="!list-none !pl-0 text-[15px] leading-normal">
            {col.items.map((it, j) => <li key={j} className="!pl-0 border-t border-line first:border-t-0 py-2 !mt-0">{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
