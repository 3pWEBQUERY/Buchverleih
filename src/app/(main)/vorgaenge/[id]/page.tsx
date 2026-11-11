import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { loanView } from "@/lib/loans/queries";
import { listMessages } from "@/lib/chat";
import { sql } from "@/lib/db";
import { Cover, imageUrl } from "@/components/cover";
import { Notice, cx } from "@/components/ui";
import { Timeline } from "@/components/loan/timeline";
import { History } from "@/components/loan/history";
import { NextStep } from "@/components/loan/next-step";
import { LiveChat } from "./live";
import { loanTone, toneDot } from "@/components/loan/loan-row";
import { IconArrowLeft, IconArrowRight, IconChat } from "@/components/icons";
import { offerNoun, statusLabel, trustLabel } from "@/lib/i18n/de-CH";
import { dayToDate, deadline, dueDay, fmtDay, fmtMonthYear, fmtRange } from "@/lib/dates";
import { CalendarView } from "@/components/calendar";

export const metadata = { title: "Vorgang" };

/** Vorgang (PRD 7.4, 8.4): Zeitachse oben, nächster Schritt, Chat darunter. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await pageUser(`/vorgaenge/${id}`);
  const loan = await loanView(id, user.id).catch(() => null);
  if (!loan) notFound();
  const [messages] = await Promise.all([listMessages({ type: "loan", id })]);
  await sql`update notifications set read_at = now() where user_id = ${user.id} and loan_id = ${id} and read_at is null`;
  const owner = loan.role === "owner";
  const other = loan.other;
  const before = loan.status === "requested";
  const t = loan.times;
  const overdue = loan.status === "active" && t.due_at && new Date(t.due_at) < new Date();
  const tone = loanTone(loan.status, t.due_at);
  const cover = { title: loan.title, authors: loan.authors, photoKey: loan.photo?.key, photoW: loan.photo?.w, photoH: loan.photo?.h, seed: loan.workId };
  const chatClosed = ["declined", "withdrawn", "expired", "cancelled"].includes(loan.status);

  const details: [string, ReactNode][] = [
    ...(loan.kind === "lend" && loan.wanted ? [["Zeitraum", fmtRange(loan.wanted)] as [string, string]] : []),
    ...(t.due_at && loan.status !== "completed" ? [["Fällig", deadline(dueDay(t.due_at), "bis")] as [string, string]] : []),
    ...(loan.spot ? [["Übergabeort", <span key="s">{loan.spot.label}{loan.spot.detail && <span className="block text-muted text-[13px]">{loan.spot.detail}</span>}</span>] as [string, ReactNode]] : []),
    ...(!loan.spot && loan.circle?.fixed_spot && loan.status !== "requested" ? [["Übergabeort", loan.circle.fixed_spot] as [string, string]] : []),
    ...(loan.circle ? [["Kreis", <Link key="c" href={`/kreise/${loan.circle.id}`} className="link-grow">{loan.circle.name}</Link>] as [string, ReactNode]] : []),
    ...(loan.extensionsUsed ? [["Verlängert", `${loan.extensionsUsed}×`] as [string, string]] : []),
    ...(loan.swapCopyId ? [["Im Tausch", loan.swapOffered.find((o) => o.id === loan.swapCopyId)?.title ?? "–"] as [string, string]] : []),
    ["Angefragt", fmtDay(t.requested_at)],
  ];

  return (
    <div>
      <Link href="/vorgaenge" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Alle Vorgänge
      </Link>

      {/* Kopf: Cover, Titel, Status */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 md:gap-10 items-end">
        <Link href={`/exemplar/${loan.copyId}`} className="book block anim-cover" aria-label={`Exemplar ansehen: ${loan.title}`}>
          <span className="book-face block md:hidden"><Cover data={cover} height={132} priority /></span>
          <span className="book-face hidden md:block"><Cover data={cover} height={212} priority /></span>
        </Link>
        <div className="min-w-0 anim-rise" style={{ animationDelay: "60ms" }}>
          <p className="eyebrow">{offerNoun[loan.kind]} · {owner ? `an ${other?.first_name}` : `von ${other?.first_name}`}</p>
          <h1 lang="de" className="display text-[38px] md:text-[76px] mt-2.5 md:mt-3 break-words hyphens-auto">{loan.title}</h1>
          {loan.authors[0] && <p className="text-[15px] md:text-[17px] text-ink-2 mt-2 truncate">{loan.authors.join(", ")}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cx("chip", overdue && "!bg-late/10 !text-late")}>
              <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", toneDot(tone))} />
              {overdue ? `Überfällig seit ${fmtDay(dayToDate(dueDay(t.due_at!)))}` : statusLabel[loan.status]}
            </span>
            {loan.kind === "lend" && loan.wanted && <span className="hidden sm:inline-flex text-[13px] text-muted tnum">{fmtRange(loan.wanted)}</span>}
          </div>
        </div>
      </header>

      <div className="mt-10 md:mt-12 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:items-start">
        {/* Hauptspalte (mobil per `contents` in die Reihenfolge der Seitenleiste verschränkt) */}
        <div className="contents lg:flex lg:flex-col lg:gap-8 lg:min-w-0">
          <div className="order-1 lg:order-none"><Timeline loan={loan} /></div>

          {(loan.waiting && overdue) || (loan.waiting && !overdue && loan.status === "active" && !owner) ? (
            <div className="order-2 lg:order-none">
              {loan.waiting && overdue ? (
                <Notice tone="late">{loan.waiting.name} wartet ab {fmtDay(dayToDate(loan.waiting.start))}. Bitte gib das Buch so bald wie möglich zurück.</Notice>
              ) : (
                <p className="text-[14px] text-muted">Nach dir ist das Buch ab {fmtDay(dayToDate(loan.waiting!.start))} gebucht. Verlängern geht nur bis zum Puffer davor.</p>
              )}
            </div>
          ) : null}

          <div className="order-3 lg:order-none empty:hidden"><NextStep loan={loan} me={user.id} /></div>

          <section aria-labelledby="chat" className="order-5 lg:order-none panel !rounded-[18px] overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-4 px-5 md:px-6 h-16 border-b border-line">
              <h2 id="chat" className="ui-title text-[19px] flex items-center gap-2.5">
                <IconChat width={18} height={18} className="text-muted" /> Chat mit {other?.first_name}
              </h2>
              {!chatClosed && <span className="text-[12.5px] text-muted inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok live-dot" /> Live</span>}
            </div>
            <LiveChat loanId={loan.id} me={user.id} initial={JSON.parse(JSON.stringify(messages))} readOnly={chatClosed} defaultPlace={loan.spot?.label ?? loan.circle?.fixed_spot ?? null} />
          </section>

          {(loan.prevChat || loan.nextLoan?.chat_id) && (
            <div className="order-6 lg:order-none grid gap-2">
              {loan.prevChat && (
                <Link href={`/uebergabe/${loan.prevChat.id}`} className="group panel px-5 py-4 flex items-center justify-between gap-4 hover:border-ink transition-colors">
                  <span><span className="font-semibold">Übergabe-Chat mit {loan.prevChat.prev_name}</span><span className="block text-[14px] text-muted">Wechsel von der vorherigen Leihe absprechen.</span></span>
                  <IconArrowRight className="flex-none transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              {loan.nextLoan?.chat_id && (
                <Link href={`/uebergabe/${loan.nextLoan.chat_id}`} className="group panel px-5 py-4 flex items-center justify-between gap-4 hover:border-ink transition-colors">
                  <span><span className="font-semibold">Übergabe-Chat zur nächsten Leihe</span><span className="block text-[14px] text-muted">{loan.nextLoan.borrower_name}, ab {fmtDay(dayToDate(loan.nextLoan.start))}</span></span>
                  <IconArrowRight className="flex-none transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          )}

          <details className="order-8 lg:order-none panel !rounded-[18px] group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 md:px-6 min-h-16 [&::-webkit-details-marker]:hidden">
              <span className="ui-title text-[19px]">Verlauf</span>
              <span className="text-[13px] text-muted inline-flex items-center gap-2">
                {loan.events.length === 1 ? "1 Eintrag" : `${loan.events.length} Einträge`}
                <span aria-hidden className="h-8 w-8 rounded-full bg-paper-2 grid place-items-center transition-transform duration-200 group-open:rotate-90"><IconArrowRight width={14} height={14} /></span>
              </span>
            </summary>
            <div className="px-5 md:px-6 pb-6 pt-1"><History events={loan.events} /></div>
          </details>
        </div>

        {/* Seitenleiste */}
        <aside className="contents lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-8">
          {other && (
            <div className="order-4 lg:order-none panel !rounded-[18px] p-5 md:p-6">
              <p className="eyebrow">{owner ? "Leiht" : "Verleiht"}</p>
              <Link href={`/profil/${other.id}`} className="group mt-3 flex items-center gap-3.5">
                <span aria-hidden className="h-12 w-12 flex-none rounded-full bg-ink text-paper grid place-items-center font-serif text-[24px] leading-none">{other.first_name.slice(0, 1)}</span>
                <span className="min-w-0">
                  <span className="block font-serif text-[28px] leading-none group-hover:underline underline-offset-4 decoration-1 truncate">{other.first_name}</span>
                  {/* Vor der Annahme zeigt der Vorgang das Profil der anderen Seite (PRD 6.1) */}
                  <span className="block text-[13px] text-muted mt-1.5">{trustLabel[other.trust_level ?? 0]} · seit {fmtMonthYear(other.member_since)}</span>
                </span>
              </Link>
              <dl className="grid grid-cols-3 gap-1.5 mt-5">
                {([["verliehen", other.lent], ["geliehen", other.borrowed], ["pünktlich", other.punctual_pct != null ? `${other.punctual_pct}%` : "–"]] as [string, ReactNode][]).map(([l, v]) => (
                  <div key={l} className="panel-quiet px-3 py-3">
                    <dd className={cx("font-serif tnum leading-none", before ? "text-[34px]" : "text-[28px]")}>{v}</dd>
                    <dt className="text-[12px] text-muted mt-1.5">{l}</dt>
                  </div>
                ))}
              </dl>
              {other.visible_losses > 0 && <p className="text-[14px] text-late mt-4">{other.visible_losses} verlorene{other.visible_losses === 1 ? "s Buch" : " Bücher"} in den letzten 24 Monaten</p>}
              {other.shared_circles.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] text-muted mr-0.5">Gemeinsam in</span>
                  {other.shared_circles.map((c) => <span key={c} className="chip">{c}</span>)}
                </div>
              )}
            </div>
          )}

          <div className="order-7 lg:order-none panel !rounded-[18px] px-5 md:px-6 py-2">
            <p className="eyebrow pt-3 pb-1">Details</p>
            <dl className="divide-y divide-line">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 py-3 text-[14.5px]">
                  <dt className="text-muted flex-none">{k}</dt>
                  <dd className="text-right min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {(loan.conditionNote || loan.conditionPhotoKeys.length > 0 || loan.dropoffPhotoKey || loan.case) && (
            <div className="order-7 lg:order-none panel !rounded-[18px] p-5 md:p-6 space-y-6">
              {loan.conditionNote || loan.conditionPhotoKeys.length ? (
                <div>
                  <p className="eyebrow mb-2">Zustandsnotiz</p>
                  {loan.conditionNote && <p className="text-[15px]">{loan.conditionNote}</p>}
                  <Thumbs keys={loan.conditionPhotoKeys} alt="Foto zum Zustand" />
                </div>
              ) : null}
              {loan.dropoffPhotoKey && (
                <div>
                  <p className="eyebrow mb-2">Foto der Ablage</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <a href={imageUrl(loan.dropoffPhotoKey, false)} target="_blank"><img src={imageUrl(loan.dropoffPhotoKey)} alt="Foto der Ablage" className="w-full rounded-[10px]" /></a>
                </div>
              )}
              {loan.case && (
                <div>
                  <p className="eyebrow mb-2 !text-late">{loan.case.kind === "damage" ? "Schadenfall" : "Fall: Rückgabe bleibt aus"}</p>
                  {loan.case.description && <p className="text-[15px]">{loan.case.description}</p>}
                  <Thumbs keys={loan.case.photo_keys} alt="Foto zum Schaden" />
                  {loan.case.kind === "nonreturn" && !loan.case.closed_at && (
                    <p className="text-[13.5px] text-muted mt-2">Tag 7: zweite Aufforderung. Tag 14: Sperre für Leihen. Tag 30: Abschluss als verloren.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {owner && loan.calendar && loan.kind === "lend" && (
            <div className="order-7 lg:order-none panel !rounded-[18px] p-5 md:p-6">
              <p className="eyebrow mb-3">Verleihkalender</p>
              <CalendarView cal={loan.calendar} compact showLegend={false} selection={loan.status === "requested" && loan.wanted?.end ? { start: loan.wanted.start, end: loan.wanted.end, ok: true } : undefined} />
            </div>
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
        <a key={k} href={imageUrl(k, false)} target="_blank" className="block hover:opacity-90 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(k)} alt={alt} className="h-16 w-16 object-cover rounded-[8px]" />
        </a>
      ))}
    </div>
  );
}
