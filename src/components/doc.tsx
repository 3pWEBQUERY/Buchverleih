import type { ReactNode } from "react";
import { cx } from "./ui";
import { DocToc } from "./doc-toc";

/**
 * Lesetexte (Hilfe, Regeln, Nutzungsbedingungen, Datenschutz) wie eine gut gesetzte
 * Buchseite: grosser Kopf mit Lead, Zeilenlänge um 68 Zeichen, mitlaufendes Inhaltsverzeichnis
 * mit aktivem Abschnitt (Desktop) bzw. aufklappbar (Handy), Tabellen als ruhige Panels.
 */
export type TocItem = [id: string, label: string];

export function DocPage({ eyebrow, title, lead, draft, toc, updated, intro, children }: {
  eyebrow: string; title: ReactNode; lead?: ReactNode; draft?: boolean; toc: TocItem[]; updated?: string;
  /** Block über volle Breite zwischen Kopf und Text, z. B. ein Schnellstart */
  intro?: ReactNode;
  children: ReactNode;
}) {
  const long = typeof title === "string" && title.length > 14;
  return (
    <div>
      <header className="grid gap-6 md:gap-8 xl:gap-10 xl:grid-cols-12 xl:items-end pb-10 md:pb-14 border-b border-line">
        <div className="xl:col-span-7 min-w-0 anim-rise">
          <p className="eyebrow">{eyebrow}</p>
          <h1 lang="de-CH" className={cx("display mt-4 hyphens-auto break-words", long ? "text-[44px] sm:text-[60px] md:text-[72px] 2xl:text-[84px]" : "text-[52px] md:text-[84px]")}>{title}</h1>
        </div>
        <div className="xl:col-span-5 anim-rise" style={{ animationDelay: "60ms" }}>
          {lead && <p className="text-[17px] md:text-[19px] text-ink-2 leading-relaxed max-w-2xl">{lead}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-ink" /> {toc.length} Abschnitte</span>
            {updated && <span className={cx("chip", draft && "!bg-lent/10 !text-lent")}><span className={cx("h-1.5 w-1.5 rounded-full", draft ? "bg-lent" : "bg-done")} /> Stand: {updated}</span>}
          </div>
        </div>
      </header>

      {draft && (
        <div role="note" className="mt-8 panel-quiet rounded-[14px] px-5 py-4 md:px-6 flex gap-4 items-start border-l-[3px] border-lent">
          <div>
            <p className="font-semibold">Entwurf – Prüfung durch eine Fachperson ausstehend</p>
            <p className="text-sm text-ink-2 mt-1">Dieser Text ist noch nicht rechtlich geprüft und gilt erst nach der Prüfung. Stellen in eckigen Klammern werden vorher ergänzt.</p>
          </div>
        </div>
      )}

      {intro && <div className="mt-10 md:mt-14">{intro}</div>}

      <div className="mt-10 md:mt-16 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-x-14 xl:gap-x-20">
        <aside className="hidden lg:block">
          <DocToc toc={toc} />
        </aside>

        <article className="min-w-0 max-w-[68ch]">
          <details className="lg:hidden mb-10 panel-quiet rounded-[14px] group">
            <summary className="px-5 h-14 cursor-pointer list-none flex items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5">Inhalt <span className="text-[13px] font-medium text-muted tnum">{toc.length} Abschnitte</span></span>
              <span aria-hidden className="h-8 w-8 rounded-full bg-paper grid place-items-center text-lg leading-none transition-transform duration-200 group-open:rotate-45">+</span>
            </summary>
            <ol className="px-5 pb-4 flex flex-col text-[15px] border-t border-line pt-2">
              {toc.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex gap-3 py-2 text-ink-2 hover:text-ink">
                    <span className="text-muted tnum w-5 text-right font-serif">{i + 1}</span> {label}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <div className={DOC_TEXT}>{children}</div>
        </article>
      </div>
    </div>
  );
}

/** Fliesstext-Stil für alles innerhalb von DocPage */
const DOC_TEXT = cx(
  "text-[16px] md:text-[17px] leading-[1.72] text-ink",
  "[&_p]:mt-4 [&_p:first-child]:mt-0",
  "[&_ul]:mt-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted [&_ol]:mt-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:marker:text-muted [&_ol]:marker:font-serif",
  "[&_li]:mt-2 [&_li]:pl-1.5",
  "[&_a]:underline [&_a]:decoration-line-strong [&_a:hover]:decoration-ink [&_strong]:font-semibold",
);

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 pt-10 md:pt-14 first:pt-0 [&+&]:border-t [&+&]:border-line [&+&]:mt-10 md:[&+&]:mt-14">
      <h2 id={`${id}-t`} className="font-serif text-[32px] md:text-[42px] leading-[1.02] tracking-[-0.02em] mb-5">{title}</h2>
      {children}
    </section>
  );
}

export function DocSub({ children }: { children: ReactNode }) {
  return <h3 className="ui-title text-[19px] mt-9 mb-1">{children}</h3>;
}

/** Tabelle als ruhiges Panel. Auf schmalen Bildschirmen als Liste von Zeilen. */
export function DocTable({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <figure className="mt-7 mb-3">
      {caption && <figcaption className="text-sm text-muted pb-2">{caption}</figcaption>}
      <div className="hidden sm:block panel rounded-[14px] overflow-hidden">
        <table className="w-full text-[15px] leading-normal border-collapse">
          <thead>
            <tr className="bg-paper-2 text-left">
              {head.map((h) => <th key={h} scope="col" className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted py-3 px-5 align-bottom">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className="align-top hover:bg-paper-2/50 transition-colors">
                {r.map((c, j) => <td key={j} className={cx("py-3.5 px-5", j === 0 && "font-semibold whitespace-nowrap")}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="sm:hidden panel rounded-[14px] divide-y divide-line text-[15px] leading-normal">
        {rows.map((r, i) => (
          <div key={i} className="px-4 py-3.5">
            <dt className="font-semibold">{r[0]}</dt>
            {r.slice(1).map((c, j) => (
              <dd key={j} className="mt-1 text-ink-2">
                {head.length > 2 && <span className="block text-muted text-[12px] uppercase tracking-[0.08em] font-semibold mt-2">{head[j + 1]}</span>}{c}
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
    <div className="mt-7 grid gap-3 sm:grid-cols-2">
      {[left, right].map((col, i) => (
        <div key={col.title} className={cx("rounded-[14px] p-5 md:p-6", i === 0 ? "panel-quiet" : "border border-late/30 bg-late/[0.04]")}>
          <p className="flex items-center gap-2.5 ui-title text-[17px]">
            <span className={cx("h-7 w-7 rounded-full grid place-items-center flex-none text-[15px]", i === 0 ? "bg-ink text-paper" : "bg-late text-paper")} aria-hidden>
              {i === 0
                ? <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                : <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>}
            </span>
            {col.title}
          </p>
          <ul className="!list-none !pl-0 !mt-4 text-[15px] leading-normal">
            {col.items.map((it, j) => <li key={j} className="!pl-0 border-t border-line first:border-t-0 py-2.5 !mt-0">{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
