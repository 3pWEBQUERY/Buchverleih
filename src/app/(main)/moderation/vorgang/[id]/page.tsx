import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { loanDossier } from "@/lib/moderation";
import { AppError } from "@/lib/errors";
import { rule, type Action, type LoanStatus } from "@/lib/loans/machine";
import { ago, dayToDate, deadline, dueDay, fmtDay, fmtDayTime, fmtRange, parseRange } from "@/lib/dates";
import { caseResponseLabel, statusLabel } from "@/lib/i18n/de-CH";
import { imageUrl } from "@/components/cover";
import { Dl, Notice, cx } from "@/components/ui";
import { BackLink, Chip, ModHead, PriorityChip, Quiet } from "@/components/moderation/ui";
import { CaseDecision } from "@/components/moderation/actions";
import { caseKindLabel, caseOutcomeLabel, caseStageLabel, handoverMethodLabel, kindLabel } from "../../labels";

export const metadata = { title: "Vorgang · Moderation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXTRA_EVENTS: Record<string, string> = {
  request: "Angefragt",
  copy_removed: "Buch aus dem Regal entfernt",
};

function eventLabel(action: string) {
  if (EXTRA_EVENTS[action]) return EXTRA_EVENTS[action];
  try {
    return rule(action as Action)?.label ?? action;
  } catch {
    return action;
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
  const { loan, events, cases, messages, chatAccess } = d;
  const range = parseRange(loan.wanted as string);
  const conditionPhotos = (loan.condition_photo_keys as string[] | null) ?? [];

  const facts: [ReactNode, ReactNode][] = [
    ["Art", kindLabel[loan.kind] ?? loan.kind],
    ["Status", statusLabel[loan.status as LoanStatus] ?? loan.status],
    ["Verleiher", <Link key="o" href={`/moderation/konto/${loan.owner_id}`} className="underline">{loan.owner_name}</Link>],
    ["Leiher", <Link key="b" href={`/moderation/konto/${loan.borrower_id}`} className="underline">{loan.borrower_name}</Link>],
    ["Zeitraum", range ? fmtRange(range) : "–"],
    ["Angefragt", fmtDayTime(loan.requested_at)],
  ];
  if (loan.accepted_at) facts.push(["Angenommen", fmtDayTime(loan.accepted_at)]);
  if (loan.handed_over_at) facts.push(["Übergeben", `${fmtDayTime(loan.handed_over_at)}${loan.handover_method ? ` · ${handoverMethodLabel[loan.handover_method] ?? loan.handover_method}` : ""}`]);
  if (loan.due_at) {
    const day = dueDay(loan.due_at);
    facts.push(["Fällig", ["active", "disputed"].includes(loan.status) ? deadline(day, "").trim() : fmtDay(dayToDate(day))]);
  }
  if (loan.extensions_used) facts.push(["Verlängerungen", String(loan.extensions_used)]);
  if (loan.recalled_at) facts.push(["Zurückgerufen", fmtDayTime(loan.recalled_at)]);
  if (loan.returned_at) facts.push(["Zurück", `${fmtDayTime(loan.returned_at)}${loan.late ? " · unpünktlich" : ""}`]);
  if (loan.closed_at) facts.push(["Abgeschlossen", fmtDayTime(loan.closed_at)]);
  if (loan.received_from_loan_id) facts.push(["Weitergabe von", <Link key="p" href={`/moderation/vorgang/${loan.received_from_loan_id}`} className="underline">Vorgänger-Leihe</Link>]);

  const openCases = cases.filter((c) => !c.closed_at).length;

  return (
    <div>
      <BackLink href="/moderation">Moderation</BackLink>
      <header className="mb-10 md:mb-14 anim-rise">
        <p className="eyebrow">Vorgang · {kindLabel[loan.kind] ?? loan.kind}</p>
        <h1 className="display text-[32px] md:text-[44px] mt-3">{loan.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <Chip tone={loan.status === "disputed" || loan.status === "lost" ? "late" : loan.status === "active" ? "lent" : "done"} strong={loan.status === "disputed" || loan.status === "lost"}>
            {statusLabel[loan.status as LoanStatus] ?? loan.status}
          </Chip>
          {openCases > 0 && <Chip tone="late" strong>{openCases === 1 ? "1 offener Fall" : `${openCases} offene Fälle`}</Chip>}
          <span className="text-[15px] text-ink-2 ml-1">
            <Link href={`/moderation/konto/${loan.owner_id}`} className="font-medium text-accent-hover hover:underline underline-offset-4">{loan.owner_name}</Link> verleiht an{" "}
            <Link href={`/moderation/konto/${loan.borrower_id}`} className="font-medium text-accent-hover hover:underline underline-offset-4">{loan.borrower_name}</Link>
          </span>
        </div>
      </header>

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="faelle">
            <ModHead id="faelle" title="Fälle" count={cases.length} />
            {cases.length === 0 && <Quiet>Zu diesem Vorgang gibt es keinen Fall.</Quiet>}
            <div className="space-y-3">
              {cases.map((c) => {
                const open = !c.closed_at;
                const urgent = open && (c.response === "object" || c.stage >= 2);
                const photos = (c.photo_keys as string[] | null) ?? [];
                return (
                  <article key={c.id} className={cx("rounded-[10px] border p-5 md:p-6", urgent ? "border-late/40" : "border-line", !open && "bg-paper-2 border-transparent")}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {open
                        ? <PriorityChip p={urgent ? "hoch" : "normal"} />
                        : <Chip>Geschlossen: {caseOutcomeLabel[c.outcome] ?? c.outcome ?? "–"}</Chip>}
                      <span className="text-[13px] text-muted">{ago(c.opened_at)}</span>
                    </div>
                    <h3 className="text-[20px] font-[560] tracking-[-0.025em] mt-4">{caseKindLabel[c.kind] ?? c.kind}</h3>
                    <p className="text-sm text-muted mt-1">
                      {open ? (urgent ? "Braucht Entscheidung" : caseStageLabel(c.stage)) : "Abgeschlossen"} · eröffnet {fmtDayTime(c.opened_at)} {c.opened_by ? `von ${c.opened_by === loan.owner_id ? loan.owner_name : loan.borrower_name}` : "automatisch"}
                    </p>
                    {c.description && <p className="mt-5 font-serif text-[22px] leading-snug max-w-prose">«{c.description}»</p>}
                    {photos.length > 0 && (
                      <div className="flex gap-3 mt-5 overflow-x-auto pb-1">
                        {photos.map((k) => (
                          <a key={k} href={imageUrl(k, false)} target="_blank" rel="noreferrer" className="flex-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl(k)} alt="Foto zum Fall" className="h-36 w-auto rounded-[8px] outline outline-1 outline-line hover:outline-ink transition-[outline-color]" />
                          </a>
                        ))}
                      </div>
                    )}
                    <Dl className="mt-6" items={[
                      ["Antwort Leiher", c.response ? caseResponseLabel[c.response as keyof typeof caseResponseLabel] ?? c.response : "Noch keine"],
                      ...(c.response_detail ? [["Begründung", c.response_detail] as [string, string]] : []),
                      ...(c.return_planned_at ? [["Rückgabe geplant", fmtDayTime(c.return_planned_at)] as [string, string]] : []),
                      ...(c.moderator_note ? [["Notiz Moderation", c.moderator_note] as [string, string]] : []),
                    ]} />
                    {open && (
                      <div className="mt-6 rounded-[12px] bg-paper-2 p-5">
                        <p className="eyebrow mb-4">Entscheid</p>
                        <CaseDecision caseId={c.id} kind={c.kind} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="chat">
            <ModHead id="chat" title="Chat" count={chatAccess ? messages.length : undefined} />
            {chatAccess ? (
              <>
                <Notice className="mb-4">Zugriff wird protokolliert. Einsicht nur, weil ein Fall oder eine Meldung offen ist.</Notice>
                {messages.length === 0 ? <Quiet>Keine Nachrichten.</Quiet> : (
                  <ol className="rounded-[10px] border border-line p-4 md:p-5 space-y-3">
                    {(messages as { id: string; sender: string | null; body: string | null; proposal_place: string | null; proposal_at: Date | null; flagged: boolean; created_at: Date }[]).map((m) => {
                      const mine = m.sender === loan.owner_name;
                      return (
                        <li key={m.id} className={cx("max-w-[85%]", mine ? "ml-auto" : "")}>
                          <p className={cx("text-[12.5px] text-muted mb-1", mine && "text-right")}>
                            <span className="text-ink font-medium">{m.sender ?? "System"}</span> · {fmtDayTime(m.created_at)}
                          </p>
                          <div className={cx("rounded-[8px] px-4 py-2.5 text-[15px]", m.flagged ? "bg-late/10 ring-1 ring-late/40" : mine ? "bg-accent-soft text-ink" : "bg-paper-2")}>
                            {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                            {m.proposal_at && <p>Terminvorschlag: {m.proposal_place ? `${m.proposal_place}, ` : ""}{fmtDayTime(m.proposal_at)}</p>}
                          </div>
                          {m.flagged && <p className={cx("text-[12.5px] text-late mt-1", mine && "text-right")}>zur Prüfung markiert</p>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            ) : (
              <Quiet>Der Chat ist privat. Die Moderation sieht ihn nur bei einem offenen Fall oder einer Meldung.</Quiet>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="stamm" className="rounded-[10px] border border-line p-5 md:p-6">
            <h2 id="stamm" className="font-medium text-[16px] mb-3">Stammdaten</h2>
            <Dl items={facts} className="border-line-strong/60" />
            {loan.condition_note && <p className="text-sm mt-4"><span className="text-muted">Zustandsnotiz Leiher: </span>{loan.condition_note}</p>}
            {(conditionPhotos.length > 0 || loan.dropoff_photo_key) && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                {conditionPhotos.map((k) => (
                  <a key={k} href={imageUrl(k, false)} target="_blank" rel="noreferrer" className="flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(k)} alt="Zustandsfoto bei Übergabe" className="h-24 w-auto rounded-[8px] outline outline-1 outline-line" />
                  </a>
                ))}
                {loan.dropoff_photo_key && (
                  <a href={imageUrl(loan.dropoff_photo_key, false)} target="_blank" rel="noreferrer" className="flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(loan.dropoff_photo_key)} alt="Foto der Ablage" className="h-24 w-auto rounded-[8px] outline outline-1 outline-line" />
                  </a>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="verlauf">
            <ModHead id="verlauf" title="Verlauf" count={events.length} />
            <ol className="relative ml-[5px] border-l border-line-strong">
              {events.map((ev, i) => (
                <li key={ev.id} className="relative pl-6 pb-6 last:pb-0">
                  <span aria-hidden className={cx("absolute -left-[6px] top-[0.35em] h-[11px] w-[11px] rounded-full ring-[3px] ring-paper", i === events.length - 1 ? "bg-accent" : "bg-line-strong")} />
                  <p className="text-[12.5px] text-muted tnum">{fmtDayTime(ev.created_at)}</p>
                  <p className="text-[15px] font-medium mt-0.5">
                    {eventLabel(ev.action)}
                    <span className="font-normal text-muted"> · {ev.actor_name ?? (ev.actor_id ? "Ehemaliges Mitglied" : "System")}</span>
                  </p>
                  {ev.from_status !== ev.to_status && (
                    <p className="text-sm text-ink-2 mt-0.5">{ev.from_status ? `${statusLabel[ev.from_status as LoanStatus]} → ` : ""}{statusLabel[ev.to_status as LoanStatus]}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
