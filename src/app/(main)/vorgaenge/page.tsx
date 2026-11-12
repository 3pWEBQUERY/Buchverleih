import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myLoans } from "@/lib/loans/queries";
import { LoanRow } from "@/components/loan/loan-row";
import { LinkButton, cx } from "@/components/ui";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";

export async function generateMetadata() {
  return { title: LOANS[await getLocale()].list.title };
}

const FILTERS = [{ id: "alle" }, { id: "verleihe" }, { id: "leihe" }] as const;
type Filter = (typeof FILTERS)[number]["id"];

/** «Meine Vorgänge», sortiert nach Handlungsbedarf: zuerst, was auf mich wartet (PRD 7.4). */
export default async function Page({ searchParams }: { searchParams: Promise<{ seite?: string }> }) {
  const user = await pageUser("/vorgaenge");
  const l = await getLocale();
  const t = LOANS[l].list;
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.id === sp.seite) ? (sp.seite as Filter) : "alle";
  const all = await myLoans(user.id, l);
  const loans = all.filter((x) => filter === "alle" || (filter === "verleihe" ? x.role === "owner" : x.role === "borrower"));
  const mine = loans.filter((x) => x.turn === "me" && x.step);
  const open = loans.filter((x) => !mine.includes(x) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(x.status));
  const done = loans.filter((x) => !mine.includes(x) && !open.includes(x));
  const count = (f: Filter) => all.filter((x) => f === "alle" || (f === "verleihe" ? x.role === "owner" : x.role === "borrower")).length;
  let n = 0;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="display text-[32px] md:text-[44px] mt-2">{t.heading[0]}<em>{t.heading[1]}</em></h1>
          <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-xl">{t.lead}</p>
        </div>
        {all.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={mine.length} label={t.stat.mine} href={mine.length ? "#wartet" : null} live={mine.length > 0} />
            <StatTile n={open.length} label={t.stat.open} href={open.length ? "#laufend" : null} />
            <StatTile n={done.length} label={t.stat.done} href={done.length ? "#abgeschlossen" : null} />
          </dl>
        )}
      </header>

      {all.length > 0 && (
        <nav aria-label={t.filter} className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mt-10 bg-paper/95 backdrop-blur-sm border-b border-line">
          <ul className="flex gap-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return (
                <li key={f.id}>
                  <Link href={f.id === "alle" ? "/vorgaenge" : `/vorgaenge?seite=${f.id}`} scroll={false} aria-current={on ? "page" : undefined}
                    className={cx("relative inline-flex items-center gap-2 h-12 text-[14px] font-medium whitespace-nowrap transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}>
                    {t.filters[f.id]} <span className="text-[12px] tnum text-muted">{count(f.id)}</span>
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
            <p className="text-[22px] md:text-[26px] font-[560] tracking-[-0.03em]">{t.empty}</p>
            <p className="text-[15px] text-muted mt-1.5 max-w-md">{t.emptyText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/regal/neu" variant="secondary">{t.addBook}</LinkButton>
            <LinkButton href="/suche" variant="primary">{t.searchBooks}</LinkButton>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <StepSection id="wartet" n={++n} first title={t.waiting}
            desc={mine.length ? t.waitingDesc : undefined}
            aside={mine.length > 0 ? t.count(mine.length) : undefined}>
            {mine.length === 0 ? (
              <div className="rounded-[10px] bg-paper-2 px-5 py-5 flex items-center gap-4">
                <span className="h-10 w-10 rounded-full bg-accent-soft text-accent-hover grid place-items-center flex-none"><IconCheck width={18} height={18} /></span>
                <div>
                  <p className="font-medium">{t.allDone}</p>
                  <p className="text-ink-2 text-[14.5px]">{open.length > 0 ? t.allDoneOpen : t.allDoneNone}</p>
                </div>
              </div>
            ) : (
              <ul className="grid xl:grid-cols-2 gap-3">{mine.map((x, i) => <LoanRow key={x.id} loan={x} variant="action" i={i} l={l} />)}</ul>
            )}
          </StepSection>

          {open.length > 0 && (
            <StepSection id="laufend" n={++n} title={t.running} desc={t.runningDesc}
              aside={t.count(open.length)}>
              <ul className="grid xl:grid-cols-2 gap-3">{open.map((x, i) => <LoanRow key={x.id} loan={x} variant="running" i={i + mine.length} l={l} />)}</ul>
            </StepSection>
          )}

          {done.length > 0 && (
            <StepSection id="abgeschlossen" n={++n} title={t.done} desc={t.doneDesc} aside={`${done.length}`}>
              <div className="rounded-[10px] border border-line overflow-hidden">
                <div aria-hidden className="hidden md:grid grid-cols-[32px_minmax(0,1fr)_120px_120px_170px] gap-6 px-5 h-10 items-center bg-paper-2 border-b border-line text-[12px] text-muted">
                  <span /><span>{t.cols.title}</span><span>{t.cols.kind}</span><span>{t.cols.with}</span><span className="text-right">{t.cols.status}</span>
                </div>
                <ul className="divide-y divide-line">{done.map((x, i) => <LoanRow key={x.id} loan={x} variant="done" i={i} l={l} />)}</ul>
              </div>
            </StepSection>
          )}

          {mine.length + open.length + done.length === 0 && (
            <p className="mt-10 text-muted text-[15px]">
              {t.noneHere} <Link href="/vorgaenge" className="text-accent-hover font-medium inline-flex items-center gap-1 hover:underline underline-offset-4">{t.showAll} <IconArrowRight width={14} height={14} /></Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
