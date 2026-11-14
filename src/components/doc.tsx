import type { ReactNode } from "react";
import { cx } from "./ui";
import { DocToc } from "./doc-toc";
import { IconArrowRight } from "./icons";
import { getLocale } from "@/lib/i18n/server";
import { htmlLang } from "@/lib/i18n/locale";
import { COMMON } from "@/lib/i18n/messages/common";

/**
 * Lesetexte (Hilfe, Regeln, Nutzungsbedingungen, Datenschutz) wie eine gut gesetzte
 * Buchseite: grosser Kopf mit Lead, Zeilenlänge um 68 Zeichen, mitlaufendes Inhaltsverzeichnis
 * mit aktivem Abschnitt (Desktop) bzw. aufklappbar (Handy), Tabellen als ruhige Panels.
 */
export type TocItem = [id: string, label: string];

export async function DocPage({ eyebrow, title, lead, draft, toc, updated, intro, germanOnly, children }: {
  eyebrow: string; title: ReactNode; lead?: ReactNode; draft?: boolean; toc: TocItem[]; updated?: string;
  /** Block über volle Breite zwischen Kopf und Text, z. B. ein Schnellstart */
  intro?: ReactNode;
  /** Rechtstext, der nur auf Deutsch verbindlich ist: in FR/IT mit Hinweis */
  germanOnly?: boolean;
  children: ReactNode;
}) {
  const l = await getLocale();
  // Rechtstexte bleiben samt Rahmen deutsch; nur der Hinweis und der Entwurfsvermerk folgen der Sprache
  const t = germanOnly ? COMMON.de.doc : COMMON[l].doc;
  const local = COMMON[l].doc;
  const textLang = germanOnly ? "de-CH" : htmlLang[l];
  const long = typeof title === "string" && title.length > 14;
  return (
    <div>
      <header className="anim-rise">
        <p className="eyebrow">{eyebrow}</p>
        <h1 lang={textLang} className={cx("display mt-2 hyphens-auto break-words", long ? "text-display " : "text-display ")}>{title}</h1>
        {lead && <p className="text-body-lg text-ink-2 leading-relaxed max-w-2xl mt-3">{lead}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-5 text-meta">
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm bg-paper-2 text-ink-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> {t.sections(toc.length)}</span>
          {updated && <span className={cx("inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm", draft ? "bg-lent/10 text-lent" : "bg-paper-2 text-ink-2")}><span className={cx("h-1.5 w-1.5 rounded-full", draft ? "bg-lent" : "bg-done")} /> {t.updated}{updated}</span>}
        </div>
      </header>

      {germanOnly && local.germanOnly && (
        <p role="note" className="mt-6 inline-flex items-center gap-2 rounded-sm bg-paper-2 px-3.5 py-2 text-body-sm text-ink-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> {local.germanOnly}
        </p>
      )}

      {draft && (
        <div role="note" className="mt-8 rounded-md bg-lent/[0.07] px-5 py-4 md:px-6 flex gap-4 items-start border-l-[3px] border-lent">
          <div>
            <p className="font-medium">{local.draftTitle}</p>
            <p className="text-body-sm text-ink-2 mt-1">{local.draftText}</p>
          </div>
        </div>
      )}

      {intro && <div className="mt-10 md:mt-12">{intro}</div>}

      <div className="mt-10 md:mt-12 pt-10 md:pt-12 border-t border-line lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-x-14 xl:gap-x-20">
        <aside className="hidden lg:block">
          <DocToc toc={toc} label={t.toc} />
        </aside>

        <article className="min-w-0 max-w-[68ch]" lang={textLang}>
          <details className="lg:hidden mb-10 rounded-md border border-line group">
            <summary className="px-5 h-14 cursor-pointer list-none flex items-center justify-between text-body font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5">{t.toc} <span className="text-meta font-medium text-muted tnum">{t.sections(toc.length)}</span></span>
              <span aria-hidden className="h-8 w-8 rounded-sm bg-accent-soft text-accent-hover grid place-items-center text-lead leading-none transition-transform duration-fast group-open:rotate-45">+</span>
            </summary>
            <ol className="px-5 pb-4 flex flex-col text-body border-t border-line pt-2">
              {toc.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex gap-3 py-2 text-ink-2 hover:text-ink">
                    <span className="text-muted tnum w-6 text-meta pt-0.5">{String(i + 1).padStart(2, "0")}</span> {label}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <div className={cx(DOC_TEXT, "[counter-reset:docsec]")}>{children}</div>
        </article>
      </div>
    </div>
  );
}

/** Fliesstext-Stil für alles innerhalb von DocPage */
const DOC_TEXT = cx(
  "text-lead leading-relaxed text-ink",
  "[&_p]:mt-4 [&_p:first-child]:mt-0",
  "[&_ul]:mt-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted [&_ol]:mt-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:marker:text-muted [&_ol]:marker:font-serif",
  "[&_li]:mt-2 [&_li]:pl-1.5",
  "[&_a]:text-accent-hover [&_a]:underline [&_a]:decoration-accent/30 [&_a:hover]:decoration-accent [&_strong]:font-semibold",
);

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 pt-10 md:pt-12 first:pt-0 [&+&]:border-t [&+&]:border-line [&+&]:mt-10 md:[&+&]:mt-12 [counter-increment:docsec]">
      <h2 id={`${id}-t`} className="text-title md:text-title font-title leading-tight tracking-title mb-4 before:block before:mb-2 before:text-meta before:font-normal before:tracking-normal before:text-muted before:[content:counter(docsec,decimal-leading-zero)]">{title}</h2>
      {children}
    </section>
  );
}

export function DocSub({ children }: { children: ReactNode }) {
  return <h3 className="text-lead font-title tracking-ui mt-8 mb-1">{children}</h3>;
}

/** Tabelle als ruhiges Panel. Auf schmalen Bildschirmen als Liste von Zeilen. */
export function DocTable({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <figure className="mt-7 mb-3">
      {caption && <figcaption className="text-body-sm text-muted pb-2">{caption}</figcaption>}
      <div className="hidden sm:block rounded-md border border-line overflow-hidden">
        <table className="w-full text-body leading-normal border-collapse">
          <thead>
            <tr className="bg-paper-2 text-left">
              {head.map((h) => <th key={h} scope="col" className="text-meta font-medium text-muted py-3 px-5 align-bottom">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className="align-top hover:bg-paper-2/50 transition-colors">
                {r.map((c, j) => <td key={j} className={cx("py-3.5 px-5", j === 0 && "font-medium whitespace-nowrap")}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="sm:hidden rounded-md border border-line divide-y divide-line text-body leading-normal">
        {rows.map((r, i) => (
          <div key={i} className="px-4 py-3.5">
            <dt className="font-medium">{r[0]}</dt>
            {r.slice(1).map((c, j) => (
              <dd key={j} className="mt-1 text-ink-2">
                {head.length > 2 && <span className="block text-muted text-caption font-medium mt-2">{head[j + 1]}</span>}{c}
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
        <div key={col.title} className={cx("rounded-md p-5 md:p-6 border", i === 0 ? "border-ok/30 bg-ok/[0.04]" : "border-late/30 bg-late/[0.04]")}>
          <p className="flex items-center gap-2.5 font-medium text-body-lg">
            <span className={cx("h-7 w-7 rounded-full grid place-items-center flex-none text-body", i === 0 ? "bg-ok/15 text-ok" : "bg-late/15 text-late")} aria-hidden>
              {i === 0
                ? <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                : <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>}
            </span>
            {col.title}
          </p>
          <ul className="!list-none !pl-0 !mt-4 text-body leading-normal">
            {col.items.map((it, j) => <li key={j} className="!pl-0 border-t border-line first:border-t-0 py-2.5 !mt-0">{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Kurzfassung über dem Text: die wichtigsten Punkte als Karten mit Sprung zum Abschnitt */
export async function DocSummary({ eyebrow, title, items, note, germanOnly }: { eyebrow: string; title: string; items: [title: string, text: string, href: string][]; note?: string; germanOnly?: boolean }) {
  const more = COMMON[germanOnly ? "de" : await getLocale()].doc.more;
  return (
    <section aria-labelledby="kurzfassung">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-5 md:mb-6">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="kurzfassung" className="text-title font-title tracking-title mt-2">{title}</h2>
        </div>
        {note && <p className="text-meta text-muted max-w-sm">{note}</p>}
      </div>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(([t, text, href], i) => (
          <li key={t} className="anim-rise" style={{ animationDelay: `${80 + i * 50}ms` }}>
            <a href={href} className="group rounded-md border border-line p-5 flex flex-col h-full sm:min-h-[176px] hover:border-accent transition-colors duration-fast">
              <span className="text-meta tnum text-accent-hover font-medium">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-medium text-lead mt-3">{t}</span>
              <span className="text-muted text-body-sm mt-1.5 leading-relaxed">{text}</span>
              <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-hover">
                {more} <IconArrowRight width={15} height={15} className="transition-transform duration-fast group-hover:translate-x-1" />
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
