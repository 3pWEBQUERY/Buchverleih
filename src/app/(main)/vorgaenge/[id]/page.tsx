import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { loanView, type LoanView } from "@/lib/loans/queries";
import { listMessages } from "@/lib/chat";
import { sql } from "@/lib/db";
import { Cover, imageUrl } from "@/components/cover";
import { Notice, cx } from "@/components/ui";
import { Timeline } from "@/components/loan/timeline";
import { History } from "@/components/loan/history";
import { NextStep } from "@/components/loan/next-step";
import { Monogram } from "@/components/person/monogram";
import { StepSection } from "@/components/step-section";
import { LiveChat } from "./live";
import { loanTone, toneDot, timeMeter, TimeMeter } from "@/components/loan/loan-row";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { labels } from "@/lib/i18n/labels";
import type { Locale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";
import { dayToDate, deadline, dueDay, fmtDay, fmtMonthYear, fmtRange } from "@/lib/dates";
import { CalendarView } from "@/components/calendar";

export async function generateMetadata() {
  return { title: LOANS[await getLocale()].detail.title };
}

function headline(loan: LoanView, l: Locale) {
  const t = LOANS[l].detail;
  const name = loan.other?.first_name ?? "–";
  const owner = loan.role === "owner";
  if (loan.kind === "swap") return t.swapWith(name);
  if (loan.kind === "gift") return owner ? t.giftTo(name) : t.giftFrom(name);
  return owner ? t.lendTo(name) : t.borrowFrom(name);
}

/**
 * Vorgang (PRD 7.4, 8.4): links das Produktblatt mit Status und Angaben, rechts Ablauf,
 * der nächste Schritt und darunter Chat und Verlauf als nummerierte Abschnitte.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await pageUser(`/vorgaenge/${id}`);
  const l = await getLocale();
  const d = LOANS[l].detail;
  const L = labels(l);
  const loan = await loanView(id, user.id, l).catch(() => null);
  if (!loan) notFound();
  const messages = await listMessages({ type: "loan", id });
  await sql`update notifications set read_at = now() where user_id = ${user.id} and loan_id = ${id} and read_at is null`;
  const owner = loan.role === "owner";
  const other = loan.other;
  const before = loan.status === "requested";
  const t = loan.times;
  const overdue = loan.status === "active" && t.due_at && new Date(t.due_at) < new Date();
  const tone = overdue ? "late" : loanTone(loan.status, t.due_at);
  const cover = { title: loan.title, authors: loan.authors, photoKey: loan.photo?.key, photoW: loan.photo?.w, photoH: loan.photo?.h, coverKey: loan.coverKey, seed: loan.workId };
  const chatClosed = ["declined", "withdrawn", "expired", "cancelled"].includes(loan.status);
  const meter = timeMeter({
    status: loan.status, kind: loan.kind, role: loan.role, other_name: other?.first_name ?? d.otherSide,
    wanted: loan.wanted ? `[${loan.wanted.start},${loan.wanted.end ?? ""})` : "",
    due_at: t.due_at, respond_by: t.respond_by, requested_at: t.requested_at, handed_over_at: t.handed_over_at,
    handover_by: t.handover_by, returned_at: t.returned_at, inspection_until: t.inspection_until,
  }, l);
  const status = overdue ? d.overdueSince(fmtDay(dayToDate(dueDay(t.due_at!)), l)) : L.statusLabel[loan.status];

  const details: [string, ReactNode][] = [
    [d.kind, L.offerNoun[loan.kind]],
    ...(loan.kind === "lend" && loan.wanted ? [[d.period, fmtRange(loan.wanted, l)] as [string, string]] : []),
    ...(t.due_at && loan.status !== "completed" ? [[d.due, deadline(dueDay(t.due_at), d.dueUntil, l)] as [string, string]] : []),
    ...(loan.spot ? [[d.spot, <span key="s">{loan.spot.label}{loan.spot.detail && <span className="block text-muted text-[12.5px]">{loan.spot.detail}</span>}</span>] as [string, ReactNode]] : []),
    ...(!loan.spot && loan.circle?.fixed_spot && loan.status !== "requested" ? [[d.spot, loan.circle.fixed_spot] as [string, string]] : []),
    ...(loan.circle ? [[d.circle, <Link key="c" href={`/kreise/${loan.circle.id}`} className="hover:underline underline-offset-4">{loan.circle.name}</Link>] as [string, ReactNode]] : []),
    ...(loan.extensionsUsed ? [[d.extended, `${loan.extensionsUsed}×`] as [string, string]] : []),
    ...(loan.swapCopyId ? [[d.inSwap, loan.swapOffered.find((o) => o.id === loan.swapCopyId)?.title ?? "–"] as [string, string]] : []),
    [d.requested, fmtDay(t.requested_at, l)],
  ];

  const person = other && (
    <section aria-labelledby="person" className="rounded-[10px] border border-line p-5">
      <p className="text-[13px] text-muted">{owner ? d.borrows : d.lends}</p>
      <div className="mt-2.5 flex items-center gap-3.5 min-w-0">
        <Monogram name={other.first_name} seed={other.id} size={48} photo={other.avatar_key} />
        <div className="min-w-0">
          <Link id="person" href={`/profil/${other.id}`} className="block text-[20px] font-[560] tracking-[-0.03em] leading-tight hover:underline underline-offset-4 decoration-1 truncate">{other.first_name}</Link>
          {/* Vor der Annahme zeigt der Vorgang das Profil der anderen Seite (PRD 6.1) */}
          <p className="text-[13px] text-muted mt-0.5">{L.trustLabel[other.trust_level ?? 0]} · {d.memberSince(fmtMonthYear(other.member_since, l))}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 mt-4">
        {([[d.stats.lent, other.lent], [d.stats.borrowed, other.borrowed], [d.stats.punctual, other.punctual_pct != null ? `${other.punctual_pct}%` : "–"]] as [string, ReactNode][]).map(([k, v]) => (
          <div key={k} className="rounded-[8px] bg-paper-2 px-3 py-2.5 flex flex-col-reverse">
            <dt className="text-[12px] text-muted mt-1">{k}</dt>
            <dd className="text-[22px] font-[560] tracking-[-0.04em] leading-none tnum">{v}</dd>
          </div>
        ))}
      </dl>
      {other.visible_losses > 0 && <p className="text-[13.5px] text-late mt-3">{d.losses(other.visible_losses)}</p>}
      {other.shared_circles.length > 0 && (
        <p className="text-[13px] text-muted mt-3">{d.sharedIn}<span className="text-ink-2">{other.shared_circles.join(", ")}</span></p>
      )}
    </section>
  );

  let n = 0;

  return (
    <div>
      <Link href="/vorgaenge" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {d.allLoans}
      </Link>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] gap-x-10 xl:gap-x-16 gap-y-8 items-start">
        {/* ------------------------------------------------ Produktblatt */}
        <aside className="lg:col-start-1 lg:row-start-1 space-y-5 min-w-0">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
              <Link href={`/exemplar/${loan.copyId}`} className="book block" aria-label={d.viewCopy(loan.title)}>
                <span className="book-face block lg:hidden"><Cover priority data={cover} width={104} height={156} uniform /></span>
                <span className="book-face hidden lg:block"><Cover priority large data={cover} width={220} height={330} uniform /></span>
              </Link>
            </div>
            <div className="anim-rise min-w-0">
              <h1 lang="de" className="font-serif text-[24px] md:text-[32px] leading-[1.1] hyphens-auto break-words">{loan.title}</h1>
              {loan.authors[0] && <p className="text-[14.5px] md:text-[15px] text-ink-2 mt-1.5">{loan.authors.join(", ")}</p>}
            </div>
          </div>

          <div className="rounded-[10px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <span className={cx("inline-flex items-center gap-2 text-[14px] font-medium", overdue && "text-late")}>
                <span aria-hidden className={cx("h-2 w-2 rounded-full", toneDot(tone))} />{status}
              </span>
              <Link href={`/exemplar/${loan.copyId}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-hover hover:underline underline-offset-4">
                {d.copy} <IconArrowRight width={14} height={14} />
              </Link>
            </div>
            <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {details.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum min-w-0">{v}</dd></div>
              ))}
            </dl>
          </div>

          {/* Vor der Annahme gehört das Profil der anfragenden Person direkt neben die Entscheidung */}
          {before && person}
        </aside>

        {/* ------------------------------------------------ Ablauf, nächster Schritt, Chat */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 min-w-0">
          <header className="anim-rise">
            <p className="eyebrow">{L.offerNoun[loan.kind]} · {d.requestedOn(fmtDay(t.requested_at, l))}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">{headline(loan, l)} <em>{overdue ? d.overdue : `${L.statusLabel[loan.status]}.`}</em></h2>
          </header>

          {meter && <div className="mt-8 anim-rise" style={{ animationDelay: "40ms" }}><TimeMeter m={meter} className="md:px-6 md:py-5" /></div>}

          <div className={cx(meter ? "mt-4" : "mt-8", "rounded-[10px] border border-line p-5 md:p-6 anim-rise")} style={{ animationDelay: "60ms" }}>
            <Timeline loan={loan} l={l} />
          </div>

          {loan.waiting && overdue && (
            <Notice tone="late" className="mt-4">{d.waitingLate(loan.waiting.name, fmtDay(dayToDate(loan.waiting.start), l))}</Notice>
          )}
          {loan.waiting && !overdue && loan.status === "active" && !owner && (
            <p className="mt-4 text-[14px] text-muted">{d.waitingNext(fmtDay(dayToDate(loan.waiting.start), l))}</p>
          )}

          <div className="mt-4 empty:hidden"><NextStep loan={loan} me={user.id} /></div>

          <StepSection id="chat" n={++n} title={d.chatWith(other?.first_name ?? d.otherSide)}
            desc={chatClosed ? d.chatClosed : d.chatOpen}
            aside={!chatClosed && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok live-dot" /> {d.live}</span>}>
            <div className="rounded-[10px] border border-line overflow-hidden min-w-0">
              <LiveChat loanId={loan.id} me={user.id} initial={JSON.parse(JSON.stringify(messages))} readOnly={chatClosed} defaultPlace={loan.spot?.label ?? loan.circle?.fixed_spot ?? null} />
            </div>
            {(loan.prevChat || loan.nextLoan?.chat_id) && (
              <div className="mt-3 grid gap-2">
                {loan.prevChat && (
                  <Link href={`/uebergabe/${loan.prevChat.id}`} className="group rounded-[10px] border border-line px-5 py-4 flex items-center justify-between gap-4 hover:border-accent transition-colors">
                    <span><span className="font-medium">{d.prevChat(loan.prevChat.prev_name)}</span><span className="block text-[13.5px] text-muted">{d.prevChatText}</span></span>
                    <IconArrowRight className="flex-none text-accent-hover transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
                {loan.nextLoan?.chat_id && (
                  <Link href={`/uebergabe/${loan.nextLoan.chat_id}`} className="group rounded-[10px] border border-line px-5 py-4 flex items-center justify-between gap-4 hover:border-accent transition-colors">
                    <span><span className="font-medium">{d.nextChat}</span><span className="block text-[13.5px] text-muted">{d.nextChatText(loan.nextLoan.borrower_name, fmtDay(dayToDate(loan.nextLoan.start), l))}</span></span>
                    <IconArrowRight className="flex-none text-accent-hover transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            )}
          </StepSection>

          {(loan.conditionNote || loan.conditionPhotoKeys.length > 0 || loan.dropoffPhotoKey || loan.case) && (
            <StepSection id="zustand" n={++n} title={loan.case ? d.caseAndCondition : d.condition} desc={d.conditionDesc}>
              <div className="grid sm:grid-cols-2 gap-3">
                {(loan.conditionNote || loan.conditionPhotoKeys.length > 0) && (
                  <div className="rounded-[10px] border border-line p-5">
                    <p className="font-medium text-[15px]">{d.conditionNote}</p>
                    {loan.conditionNote && <p className="text-[14.5px] text-ink-2 mt-1.5">{loan.conditionNote}</p>}
                    <Thumbs keys={loan.conditionPhotoKeys} alt={d.conditionPhoto} />
                  </div>
                )}
                {loan.dropoffPhotoKey && (
                  <div className="rounded-[10px] border border-line p-5">
                    <p className="font-medium text-[15px] mb-3">{d.dropoffPhoto}</p>
                    { }
                    <a href={imageUrl(loan.dropoffPhotoKey, false)} target="_blank"><img src={imageUrl(loan.dropoffPhotoKey)} alt={d.dropoffPhoto} className="w-full rounded-[8px]" /></a>
                  </div>
                )}
                {loan.case && (
                  <div className="rounded-[10px] border border-late/40 bg-late/[0.04] p-5 sm:col-span-2">
                    <p className="font-medium text-[15px] text-late">{loan.case.kind === "damage" ? d.damageCase : d.nonreturnCase}</p>
                    {loan.case.description && <p className="text-[14.5px] text-ink-2 mt-1.5">{loan.case.description}</p>}
                    <Thumbs keys={loan.case.photo_keys} alt={d.damagePhoto} />
                    {loan.case.kind === "nonreturn" && !loan.case.closed_at && (
                      <p className="text-[13.5px] text-muted mt-2">{d.caseSteps}</p>
                    )}
                  </div>
                )}
              </div>
            </StepSection>
          )}

          <StepSection id="verlauf" n={++n} title={d.history} desc={d.historyDesc}
            aside={d.entries(loan.events.length)}>
            <div className="rounded-[10px] border border-line px-5 md:px-6 py-5"><History events={loan.events} l={l} /></div>
          </StepSection>
        </div>

        {/* ------------------------------------------------ Seitenleiste unten */}
        <aside className="lg:col-start-1 lg:row-start-2 space-y-5 min-w-0">
          {!before && person}
          {owner && loan.calendar && loan.kind === "lend" && (
            <section aria-labelledby="kal" className="rounded-[10px] border border-line p-5">
              <p id="kal" className="font-medium text-[15px]">{d.calendar}</p>
              <p className="text-[13px] text-muted mt-0.5 mb-4">{loan.status === "requested" ? d.calRequested : d.calUsage}</p>
              <CalendarView cal={loan.calendar} compact showLegend={false} selection={loan.status === "requested" && loan.wanted?.end ? { start: loan.wanted.start, end: loan.wanted.end, ok: true } : undefined} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Thumbs({ keys, alt }: { keys: string[]; alt: string }) {
  if (!keys.length) return null;
  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {keys.map((k) => (
        <a key={k} href={imageUrl(k, false)} target="_blank" className="block rounded-[8px] overflow-hidden border border-line hover:border-ink-2 transition-colors">
          { }
          <img src={imageUrl(k)} alt={alt} className="h-16 w-16 object-cover" />
        </a>
      ))}
    </div>
  );
}
