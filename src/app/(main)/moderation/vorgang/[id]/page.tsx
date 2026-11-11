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
import { Dl, Notice } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
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

  return (
    <div>
      <Link href="/moderation" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6"><IconArrowLeft /> Moderation</Link>
      <header className="mb-10">
        <p className="eyebrow">Vorgang · {kindLabel[loan.kind] ?? loan.kind}</p>
        <h1 className="display text-4xl md:text-6xl mt-3">{loan.title}</h1>
        <p className="text-lg text-ink-2 mt-3">{loan.owner_name} verleiht an {loan.borrower_name} · {statusLabel[loan.status as LoanStatus] ?? loan.status}</p>
      </header>

      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="faelle">
            <h2 id="faelle" className="text-xl md:text-2xl border-b border-line pb-2">Fälle</h2>
            {cases.length === 0 && <p className="py-4 text-ink-2">Zu diesem Vorgang gibt es keinen Fall.</p>}
            <div className="divide-y divide-line">
              {cases.map((c) => {
                const open = !c.closed_at;
                const photos = (c.photo_keys as string[] | null) ?? [];
                return (
                  <article key={c.id} className="py-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <h3 className="text-lg">{caseKindLabel[c.kind] ?? c.kind}</h3>
                      <span className={open ? "text-sm text-late font-medium" : "text-sm text-muted"}>
                        {open ? (c.response === "object" || c.stage >= 2 ? "Braucht Entscheidung" : caseStageLabel(c.stage)) : `Geschlossen: ${caseOutcomeLabel[c.outcome] ?? c.outcome ?? "–"}`}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      Eröffnet {fmtDayTime(c.opened_at)} ({ago(c.opened_at)}) {c.opened_by ? `von ${c.opened_by === loan.owner_id ? loan.owner_name : loan.borrower_name}` : "automatisch"}
                    </p>
                    {c.description && <p className="mt-4 text-[15px] max-w-prose">«{c.description}»</p>}
                    {photos.length > 0 && (
                      <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                        {photos.map((k) => (
                          <a key={k} href={imageUrl(k, false)} target="_blank" rel="noreferrer" className="flex-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl(k)} alt="Foto zum Fall" className="h-36 w-auto rounded-xs outline outline-1 outline-line" />
                          </a>
                        ))}
                      </div>
                    )}
                    <Dl className="mt-5" items={[
                      ["Antwort Leiher", c.response ? caseResponseLabel[c.response as keyof typeof caseResponseLabel] ?? c.response : "Noch keine"],
                      ...(c.response_detail ? [["Begründung", c.response_detail] as [string, string]] : []),
                      ...(c.return_planned_at ? [["Rückgabe geplant", fmtDayTime(c.return_planned_at)] as [string, string]] : []),
                      ...(c.moderator_note ? [["Notiz Moderation", c.moderator_note] as [string, string]] : []),
                    ]} />
                    {open && (
                      <div className="mt-6">
                        <p className="text-sm font-medium mb-3">Entscheid</p>
                        <CaseDecision caseId={c.id} kind={c.kind} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="chat">
            <h2 id="chat" className="text-xl md:text-2xl border-b border-line pb-2">Chat</h2>
            {chatAccess ? (
              <>
                <Notice className="my-4">Zugriff wird protokolliert. Einsicht nur, weil ein Fall oder eine Meldung offen ist.</Notice>
                {messages.length === 0 ? <p className="text-ink-2">Keine Nachrichten.</p> : (
                  <ol className="divide-y divide-line border-y border-line">
                    {(messages as { id: string; sender: string | null; body: string | null; proposal_place: string | null; proposal_at: Date | null; flagged: boolean; created_at: Date }[]).map((m) => (
                      <li key={m.id} className="py-3">
                        <p className="text-sm text-muted">
                          <span className="text-ink font-medium">{m.sender ?? "System"}</span> · {fmtDayTime(m.created_at)}
                          {m.flagged && <span className="text-late"> · zur Prüfung markiert</span>}
                        </p>
                        {m.body && <p className="text-[15px] mt-0.5 whitespace-pre-line">{m.body}</p>}
                        {m.proposal_at && <p className="text-[15px] mt-0.5">Terminvorschlag: {m.proposal_place ? `${m.proposal_place}, ` : ""}{fmtDayTime(m.proposal_at)}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="py-4 text-ink-2 max-w-prose">Der Chat ist privat. Die Moderation sieht ihn nur bei einem offenen Fall oder einer Meldung.</p>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5 min-w-0 flex flex-col gap-12">
          <section aria-labelledby="stamm">
            <h2 id="stamm" className="text-xl md:text-2xl pb-2">Stammdaten</h2>
            <Dl items={facts} />
            {loan.condition_note && <p className="text-sm mt-4"><span className="text-muted">Zustandsnotiz Leiher: </span>{loan.condition_note}</p>}
            {(conditionPhotos.length > 0 || loan.dropoff_photo_key) && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                {conditionPhotos.map((k) => (
                  <a key={k} href={imageUrl(k, false)} target="_blank" rel="noreferrer" className="flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(k)} alt="Zustandsfoto bei Übergabe" className="h-24 w-auto rounded-xs outline outline-1 outline-line" />
                  </a>
                ))}
                {loan.dropoff_photo_key && (
                  <a href={imageUrl(loan.dropoff_photo_key, false)} target="_blank" rel="noreferrer" className="flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(loan.dropoff_photo_key)} alt="Foto der Ablage" className="h-24 w-auto rounded-xs outline outline-1 outline-line" />
                  </a>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="verlauf">
            <h2 id="verlauf" className="text-xl md:text-2xl pb-2 border-b border-line">Verlauf</h2>
            <ol className="relative mt-5 ml-1 border-l border-line-strong">
              {events.map((ev) => (
                <li key={ev.id} className="relative pl-5 pb-5 last:pb-0">
                  <span aria-hidden className="absolute left-0 top-[0.7em] w-3 h-px bg-line-strong" />
                  <p className="text-sm text-muted">{fmtDayTime(ev.created_at)}</p>
                  <p className="text-[15px]">
                    {eventLabel(ev.action)}
                    <span className="text-muted"> · {ev.actor_name ?? (ev.actor_id ? "Ehemaliges Mitglied" : "System")}</span>
                  </p>
                  {ev.from_status !== ev.to_status && (
                    <p className="text-sm text-ink-2">{ev.from_status ? `${statusLabel[ev.from_status as LoanStatus]} → ` : ""}{statusLabel[ev.to_status as LoanStatus]}</p>
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
