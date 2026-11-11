import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myLoans } from "@/lib/loans/queries";
import { LoanRow } from "@/components/loan/loan-row";
import { LinkButton, cx } from "@/components/ui";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconCheck } from "@/components/icons";

export const metadata = { title: "Vorgänge" };

const FILTERS = [
  { id: "alle", label: "Alle" },
  { id: "verleihe", label: "Ich verleihe" },
  { id: "leihe", label: "Ich leihe" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

/** «Meine Vorgänge», sortiert nach Handlungsbedarf: zuerst, was auf mich wartet (PRD 7.4). */
export default async function Page({ searchParams }: { searchParams: Promise<{ seite?: string }> }) {
  const user = await pageUser("/vorgaenge");
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.id === sp.seite) ? (sp.seite as Filter) : "alle";
  const all = await myLoans(user.id);
  const loans = all.filter((l) => filter === "alle" || (filter === "verleihe" ? l.role === "owner" : l.role === "borrower"));
  const mine = loans.filter((l) => l.turn === "me" && l.step);
  const open = loans.filter((l) => !mine.includes(l) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(l.status));
  const done = loans.filter((l) => !mine.includes(l) && !open.includes(l));
  const count = (f: Filter) => all.filter((l) => f === "alle" || (f === "verleihe" ? l.role === "owner" : l.role === "borrower")).length;
  let n = 0;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">Leihen, Tauschen, Schenken</p>
          <h1 className="display text-[44px] md:text-[64px] mt-2">Deine Vorgänge. <em>Was jetzt ansteht.</em></h1>
          <p className="text-[16px] md:text-[17px] text-ink-2 mt-4 max-w-xl">Zuerst steht, was auf dich wartet. Danach, was gerade läuft, und am Schluss die letzten 60 Tage.</p>
        </div>
        {all.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={mine.length} label="wartet auf dich" href={mine.length ? "#wartet" : null} live={mine.length > 0} />
            <StatTile n={open.length} label="laufend" href={open.length ? "#laufend" : null} />
            <StatTile n={done.length} label="abgeschlossen" href={done.length ? "#abgeschlossen" : null} />
          </dl>
        )}
      </header>

      {all.length > 0 && (
        <nav aria-label="Filter" className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mt-10 bg-paper/95 backdrop-blur-sm border-b border-line">
          <ul className="flex gap-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return (
                <li key={f.id}>
                  <Link href={f.id === "alle" ? "/vorgaenge" : `/vorgaenge?seite=${f.id}`} scroll={false} aria-current={on ? "page" : undefined}
                    className={cx("relative inline-flex items-center gap-2 h-12 text-[14px] font-medium whitespace-nowrap transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}>
                    {f.label} <span className="text-[12px] tnum text-muted">{count(f.id)}</span>
                    {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {all.length === 0 ? (
        <div className="mt-12 rounded-[10px] border border-line p-6 md:p-10 grid md:grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
          <div>
            <p className="text-[22px] md:text-[26px] font-[560] tracking-[-0.03em]">Noch keine Vorgänge.</p>
            <p className="text-[15px] text-muted mt-1.5 max-w-md">Such ein Buch in deiner Nähe und frag es an – oder stell deine eigenen Bücher ins Regal.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/regal/neu" variant="secondary">Buch erfassen</LinkButton>
            <LinkButton href="/suche" variant="primary">Bücher suchen</LinkButton>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <StepSection id="wartet" n={++n} first title="Wartet auf dich"
            desc={mine.length ? "Hier bist du am Zug. Ein Tippen führt direkt zum nächsten Schritt." : undefined}
            aside={mine.length > 0 ? `${mine.length} ${mine.length === 1 ? "Vorgang" : "Vorgänge"}` : undefined}>
            {mine.length === 0 ? (
              <div className="rounded-[10px] bg-paper-2 px-5 py-5 flex items-center gap-4">
                <span className="h-10 w-10 rounded-full bg-accent-soft text-accent-hover grid place-items-center flex-none"><IconCheck width={18} height={18} /></span>
                <div>
                  <p className="font-medium">Alles erledigt.</p>
                  <p className="text-ink-2 text-[14.5px]">{open.length > 0 ? "Bei allen laufenden Vorgängen ist die andere Seite am Zug." : "Kein offener Vorgang. Zeit, etwas Neues zu lesen."}</p>
                </div>
              </div>
            ) : (
              <ul className="grid xl:grid-cols-2 gap-3">{mine.map((l, i) => <LoanRow key={l.id} loan={l} variant="action" i={i} />)}</ul>
            )}
          </StepSection>

          {open.length > 0 && (
            <StepSection id="laufend" n={++n} title="Laufend" desc="Die andere Seite ist am Zug. Du wirst benachrichtigt, sobald du wieder dran bist."
              aside={`${open.length} ${open.length === 1 ? "Vorgang" : "Vorgänge"}`}>
              <ul className="grid xl:grid-cols-2 gap-3">{open.map((l, i) => <LoanRow key={l.id} loan={l} variant="running" i={i + mine.length} />)}</ul>
            </StepSection>
          )}

          {done.length > 0 && (
            <StepSection id="abgeschlossen" n={++n} title="Abgeschlossen" desc="Die letzten 60 Tage." aside={`${done.length}`}>
              <div className="rounded-[10px] border border-line overflow-hidden">
                <div aria-hidden className="hidden md:grid grid-cols-[32px_minmax(0,1fr)_120px_120px_170px] gap-6 px-5 h-10 items-center bg-paper-2 border-b border-line text-[12px] text-muted">
                  <span /><span>Titel</span><span>Art</span><span>Mit</span><span className="text-right">Status</span>
                </div>
                <ul className="divide-y divide-line">{done.map((l, i) => <LoanRow key={l.id} loan={l} variant="done" i={i} />)}</ul>
              </div>
            </StepSection>
          )}

          {mine.length + open.length + done.length === 0 && (
            <p className="mt-10 text-muted text-[15px]">
              Keine Vorgänge in dieser Auswahl. <Link href="/vorgaenge" className="text-accent-hover font-medium inline-flex items-center gap-1 hover:underline underline-offset-4">Alle zeigen <IconArrowRight width={14} height={14} /></Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
