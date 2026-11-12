import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { loanDossier } from "@/lib/moderation";
import { AppError } from "@/lib/errors";
import { rule, type Action, type LoanStatus } from "@/lib/loans/machine";
import { ago, dayToDate, deadline, dueDay, fmtDay, fmtDayTime, fmtRange, parseRange } from "@/lib/dates";
import { labels } from "@/lib/i18n/labels";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import { MOD } from "@/lib/i18n/messages/moderation";
import { LOANS } from "@/lib/i18n/messages/loans";
import { imageUrl } from "@/components/cover";
import { Dl, Notice, cx } from "@/components/ui";
import { BackLink, Chip, ModHead, PriorityChip, Quiet } from "@/components/moderation/ui";
import { CaseDecision } from "@/components/moderation/actions";
import { caseStageLabel, modLabels } from "../../labels";

export async function generateMetadata() {
  return { title: MOD[await getLocale()].loanTitle };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ereignis im Verlauf: Deutsch aus der Zustandsmaschine, FR/IT aus den Texten des Verlaufs */
function eventLabel(action: string, l: Locale): { text: string; withActor: boolean } {
  const extra = MOD[l].loan.events[action];
  if (extra) return { text: extra, withActor: false };
  if (l !== "de") {
    const t = LOANS[l].history.actions[action];
    // Kleingeschrieben heisst: Satz mit der handelnden Person davor («Marc a accepté»)
    if (t) return { text: t, withActor: /^[a-zà-ÿ]/.test(t) };
  }
  try {
    return { text: rule(action as Action)?.label ?? action, withActor: false };
  } catch {
    return { text: action, withActor: false };
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mod = await pageUser(`/moderation/vorgang/${id}`);
  if (mod.role === "member" || !UUID.test(id)) notFound();
  const d = await loanDossier(mod, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) return null;
    throw e;
  });
  if (!d) notFound();
  const l = await getLocale();
  const t = MOD[l].loan;
  const f = t.facts;
  const ml = modLabels(l);
  const L = labels(l);
  const { loan, events, cases, messages, chatAccess } = d;
  const range = parseRange(loan.wanted as string);
  const conditionPhotos = (loan.condition_photo_keys as string[] | null) ?? [];

  const facts: [ReactNode, ReactNode][] = [
    [f.kind, ml.kind[loan.kind] ?? loan.kind],
    [f.status, L.statusLabel[loan.status as LoanStatus] ?? loan.status],
    [f.owner, <Link key="o" href={`/moderation/konto/${loan.owner_id}`} className="underline">{loan.owner_name}</Link>],
    [f.borrower, <Link key="b" href={`/moderation/konto/${loan.borrower_id}`} className="underline">{loan.borrower_name}</Link>],
    [f.period, range ? fmtRange(range, l) : "–"],
    [f.requested, fmtDayTime(loan.requested_at, l)],
  ];
  if (loan.accepted_at) facts.push([f.accepted, fmtDayTime(loan.accepted_at, l)]);
  if (loan.handed_over_at) facts.push([f.handedOver, `${fmtDayTime(loan.handed_over_at, l)}${loan.handover_method ? ` · ${ml.handoverMethod[loan.handover_method] ?? loan.handover_method}` : ""}`]);
  if (loan.due_at) {
    const day = dueDay(loan.due_at);
    facts.push([f.due, ["active", "disputed"].includes(loan.status) ? deadline(day, "", l).trim() : fmtDay(dayToDate(day), l)]);
  }
  if (loan.extensions_used) facts.push([f.extensions, String(loan.extensions_used)]);
  if (loan.recalled_at) facts.push([f.recalled, fmtDayTime(loan.recalled_at, l)]);
  if (loan.returned_at) facts.push([f.returned, `${fmtDayTime(loan.returned_at, l)}${loan.late ? f.late : ""}`]);
  if (loan.closed_at) facts.push([f.closed, fmtDayTime(loan.closed_at, l)]);
  if (loan.received_from_loan_id) facts.push([f.passOnFrom, <Link key="p" href={`/moderation/vorgang/${loan.received_from_loan_id}`} className="underline">{f.previousLoan}</Link>]);

  const openCases = cases.filter((c) => !c.closed_at).length;

  return (
    <div>
      <BackLink href="/moderation">{t.back}</BackLink>
      <header className="mb-10 md:mb-14 anim-rise">
        <p className="eyebrow">{t.eyebrow} · {ml.kind[loan.kind] ?? loan.kind}</p>
        <h1 className="font-serif text-[28px] md:text-[38px] leading-[1.1] mt-3">{loan.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <Chip tone={loan.status === "disputed" || loan.status === "lost" ? "late" : loan.status === "active" ? "lent" : "done"} strong={loan.status === "disputed" || loan.status === "lost"}>
            {L.statusLabel[loan.status as LoanStatus] ?? loan.status}
          </Chip>
          {openCases > 0 && <Chip tone="late" strong>{t.openCases(openCases)}</Chip>}
          <span className="text-[15px] text-ink-2 ml-1">
            <Link href={`/moderation/konto/${loan.owner_id}`} className="font-medium text-accent-hover hover:underline underline-offset-4">{loan.owner_name}</Link>{t.lendsTo}{" "}
            <Link href={`/moderation/konto/${loan.borrower_id}`} className="font-medium text-accent-hover hover:underline underline-offset-4">{loan.borrower_name}</Link>
          </span>
        </div>
      </header>

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="faelle">
            <ModHead id="faelle" title={t.cases} count={cases.length} />
            {cases.length === 0 && <Quiet>{t.noCase}</Quiet>}
            <div className="space-y-3">
              {cases.map((c) => {
                const open = !c.closed_at;
                const urgent = open && (c.response === "object" || c.stage >= 2);
                const photos = (c.photo_keys as string[] | null) ?? [];
                return (
                  <article key={c.id} className={cx("rounded-[10px] border p-5 md:p-6", urgent ? "border-late/40" : "border-line", !open && "bg-paper-2 border-transparent")}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {open
                        ? <PriorityChip p={urgent ? "hoch" : "normal"} l={l} />
                        : <Chip>{t.closedAs(ml.caseOutcome[c.outcome] ?? c.outcome ?? "–")}</Chip>}
                      <span className="text-[13px] text-muted">{ago(c.opened_at, l)}</span>
                    </div>
                    <h3 className="text-[20px] font-[560] tracking-[-0.025em] mt-4">{ml.caseKind[c.kind] ?? c.kind}</h3>
                    <p className="text-sm text-muted mt-1">
                      {open ? (urgent ? t.needsDecision : caseStageLabel(c.stage, l)) : t.done} · {t.openedAt(fmtDayTime(c.opened_at, l))} {c.opened_by ? t.by(c.opened_by === loan.owner_id ? loan.owner_name : loan.borrower_name) : t.auto}
                    </p>
                    {c.description && <p className="mt-5 font-serif text-[22px] leading-snug max-w-prose">«{c.description}»</p>}
                    {photos.length > 0 && (
                      <div className="flex gap-3 mt-5 overflow-x-auto pb-1">
                        {photos.map((k) => (
                          <a key={k} href={imageUrl(k, false)} target="_blank" rel="noreferrer" className="flex-none">
                            { }
                            <img src={imageUrl(k)} alt={t.casePhoto} className="h-36 w-auto rounded-[8px] outline outline-1 outline-line hover:outline-ink transition-[outline-color]" />
                          </a>
                        ))}
                      </div>
                    )}
                    <Dl className="mt-6" items={[
                      [t.answer, c.response ? L.caseResponseLabel[c.response as keyof typeof L.caseResponseLabel] ?? c.response : t.noAnswer],
                      ...(c.response_detail ? [[t.reason, c.response_detail] as [string, string]] : []),
                      ...(c.return_planned_at ? [[t.returnPlanned, fmtDayTime(c.return_planned_at, l)] as [string, string]] : []),
                      ...(c.moderator_note ? [[t.modNote, c.moderator_note] as [string, string]] : []),
                    ]} />
                    {open && (
                      <div className="mt-6 rounded-[12px] bg-paper-2 p-5">
                        <p className="eyebrow mb-4">{t.decision}</p>
                        <CaseDecision caseId={c.id} kind={c.kind} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="chat">
            <ModHead id="chat" title={t.chat} count={chatAccess ? messages.length : undefined} />
            {chatAccess ? (
              <>
                <Notice className="mb-4">{t.chatLogged}</Notice>
                {messages.length === 0 ? <Quiet>{t.noMessages}</Quiet> : (
                  <ol className="rounded-[10px] border border-line p-4 md:p-5 space-y-3">
                    {(messages as { id: string; sender: string | null; body: string | null; proposal_place: string | null; proposal_at: Date | null; flagged: boolean; created_at: Date }[]).map((m) => {
                      const mine = m.sender === loan.owner_name;
                      return (
                        <li key={m.id} className={cx("max-w-[85%]", mine ? "ml-auto" : "")}>
                          <p className={cx("text-[12.5px] text-muted mb-1", mine && "text-right")}>
                            <span className="text-ink font-medium">{m.sender ?? t.system}</span> · {fmtDayTime(m.created_at, l)}
                          </p>
                          <div className={cx("rounded-[8px] px-4 py-2.5 text-[15px]", m.flagged ? "bg-late/10 ring-1 ring-late/40" : mine ? "bg-accent-soft text-ink" : "bg-paper-2")}>
                            {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                            {m.proposal_at && <p>{t.proposal}{m.proposal_place ? `${m.proposal_place}, ` : ""}{fmtDayTime(m.proposal_at, l)}</p>}
                          </div>
                          {m.flagged && <p className={cx("text-[12.5px] text-late mt-1", mine && "text-right")}>{t.flagged}</p>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            ) : (
              <Quiet>{t.chatPrivate}</Quiet>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="stamm" className="rounded-[10px] border border-line p-5 md:p-6">
            <h2 id="stamm" className="font-medium text-[16px] mb-3">{t.master}</h2>
            <Dl items={facts} className="border-line-strong/60" />
            {loan.condition_note && <p className="text-sm mt-4"><span className="text-muted">{t.conditionNote}</span>{loan.condition_note}</p>}
            {(conditionPhotos.length > 0 || loan.dropoff_photo_key) && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                {conditionPhotos.map((k) => (
                  <a key={k} href={imageUrl(k, false)} target="_blank" rel="noreferrer" className="flex-none">
                    { }
                    <img src={imageUrl(k)} alt={t.conditionPhoto} className="h-24 w-auto rounded-[8px] outline outline-1 outline-line" />
                  </a>
                ))}
                {loan.dropoff_photo_key && (
                  <a href={imageUrl(loan.dropoff_photo_key, false)} target="_blank" rel="noreferrer" className="flex-none">
                    { }
                    <img src={imageUrl(loan.dropoff_photo_key)} alt={t.dropoffPhoto} className="h-24 w-auto rounded-[8px] outline outline-1 outline-line" />
                  </a>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="verlauf">
            <ModHead id="verlauf" title={t.history} count={events.length} />
            <ol className="relative ml-[5px] border-l border-line-strong">
              {events.map((ev, i) => {
                const label = eventLabel(ev.action, l);
                const actor = ev.actor_name ?? (ev.actor_id ? t.formerMember : t.system);
                return (
                <li key={ev.id} className="relative pl-6 pb-6 last:pb-0">
                  <span aria-hidden className={cx("absolute -left-[6px] top-[0.35em] h-[11px] w-[11px] rounded-full ring-[3px] ring-paper", i === events.length - 1 ? "bg-accent" : "bg-line-strong")} />
                  <p className="text-[12.5px] text-muted tnum">{fmtDayTime(ev.created_at, l)}</p>
                  <p className="text-[15px] font-medium mt-0.5">
                    {label.withActor ? <>{actor} {label.text}</> : <>{label.text}<span className="font-normal text-muted"> · {actor}</span></>}
                  </p>
                  {ev.from_status !== ev.to_status && (
                    <p className="text-sm text-ink-2 mt-0.5">{ev.from_status ? `${L.statusLabel[ev.from_status as LoanStatus]} → ` : ""}{L.statusLabel[ev.to_status as LoanStatus]}</p>
                  )}
                </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
