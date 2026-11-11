import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { loanView } from "@/lib/loans/queries";
import { listMessages } from "@/lib/chat";
import { sql } from "@/lib/db";
import { Cover, imageUrl } from "@/components/cover";
import { Dl, Notice } from "@/components/ui";
import { StatusText } from "@/components/status";
import { Timeline } from "@/components/loan/timeline";
import { History } from "@/components/loan/history";
import { NextStep } from "@/components/loan/next-step";
import { LiveChat } from "./live";
import { loanTone } from "@/components/loan/loan-row";
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

  return (
    <div className="max-w-4xl">
      <header className="grid grid-cols-[auto_1fr] gap-5 md:gap-8 items-end pb-8 border-b border-line">
        <Link href={`/exemplar/${loan.copyId}`} className="anim-cover block">
          <Cover data={{ title: loan.title, authors: loan.authors, photoKey: loan.photo?.key, photoW: loan.photo?.w, photoH: loan.photo?.h, seed: loan.workId }} height={132} />
        </Link>
        <div className="min-w-0">
          <p className="eyebrow">{offerNoun[loan.kind]} · {owner ? `an ${other?.first_name}` : `von ${other?.first_name}`}</p>
          <h1 className="display text-3xl md:text-5xl mt-2">{loan.title}</h1>
          <div className="mt-3"><StatusText tone={loanTone(loan.status, t.due_at)}>{overdue ? `Überfällig seit ${fmtDay(dayToDate(dueDay(t.due_at!)))}` : statusLabel[loan.status]}</StatusText></div>
        </div>
      </header>

      <div className="py-8 border-b border-line"><Timeline loan={loan} /></div>

      {loan.waiting && overdue && (
        <Notice tone="late" className="mt-8">{loan.waiting.name} wartet ab {fmtDay(dayToDate(loan.waiting.start))}. Bitte gib das Buch so bald wie möglich zurück.</Notice>
      )}
      {loan.waiting && !overdue && loan.status === "active" && !owner && (
        <p className="mt-8 text-sm text-muted">Nach dir ist das Buch ab {fmtDay(dayToDate(loan.waiting.start))} gebucht. Verlängern geht nur bis zum Puffer davor.</p>
      )}

      <div className="py-8 border-b border-line">
        <NextStep loan={loan} me={user.id} />
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-10 py-8">
        <section aria-labelledby="chat" className="min-w-0 order-2 md:order-1">
          <h2 id="chat" className="text-2xl mb-5">Chat</h2>
          <LiveChat loanId={loan.id} me={user.id} initial={JSON.parse(JSON.stringify(messages))} readOnly={["declined", "withdrawn", "expired"].includes(loan.status)} defaultPlace={loan.spot?.label ?? loan.circle?.fixed_spot ?? null} />
          {loan.prevChat && <p className="mt-6 text-sm"><Link href={`/uebergabe/${loan.prevChat.id}`} className="underline underline-offset-4">Übergabe-Chat mit {loan.prevChat.prev_name}</Link>: Wechsel von der vorherigen Leihe absprechen.</p>}
          {loan.nextLoan?.chat_id && <p className="mt-3 text-sm"><Link href={`/uebergabe/${loan.nextLoan.chat_id}`} className="underline underline-offset-4">Übergabe-Chat zur nächsten Leihe</Link> ({loan.nextLoan.borrower_name}, ab {fmtDay(dayToDate(loan.nextLoan.start))}).</p>}
        </section>

        <aside className="order-1 md:order-2 space-y-8">
          <div>
            <p className="eyebrow mb-2">{owner ? "Leiht" : "Verleiht"}</p>
            <Link href={`/profil/${other?.id}`} className="font-serif text-2xl hover:underline">{other?.first_name}</Link>
            {/* Vor der Annahme zeigt der Vorgang das Profil der anderen Seite (PRD 6.1) */}
            <p className="text-sm text-muted mt-1">{trustLabel[other?.trust_level ?? 0]} · Mitglied seit {fmtMonthYear(other!.member_since)}</p>
            <div className={`grid grid-cols-3 gap-2 mt-4 ${before ? "" : "text-sm"}`}>
              {[["verliehen", other?.lent], ["geliehen", other?.borrowed], ["pünktlich", other?.punctual_pct != null ? `${other.punctual_pct}%` : "–"]].map(([l, v]) => (
                <div key={String(l)}><div className={`font-serif tnum ${before ? "text-3xl" : "text-xl"}`}>{v}</div><div className="text-xs text-muted">{l}</div></div>
              ))}
            </div>
            {other && other.visible_losses > 0 && <p className="text-sm text-late mt-3">{other.visible_losses} verlorene{other.visible_losses === 1 ? "s Buch" : " Bücher"} in den letzten 24 Monaten</p>}
            {other && other.shared_circles.length > 0 && <p className="text-sm mt-3">Gemeinsame Kreise: {other.shared_circles.join(", ")}</p>}
          </div>

          <Dl items={[
            ...(loan.kind === "lend" && loan.wanted ? [["Zeitraum", fmtRange(loan.wanted)] as [string, string]] : []),
            ...(t.due_at && loan.status !== "completed" ? [["Fällig", deadline(dueDay(t.due_at), "bis")] as [string, string]] : []),
            ...(loan.spot ? [["Übergabeort", <span key="s">{loan.spot.label}{loan.spot.detail && <span className="block text-muted text-sm">{loan.spot.detail}</span>}</span>] as [string, React.ReactNode]] : []),
            ...(!loan.spot && loan.circle?.fixed_spot && loan.status !== "requested" ? [["Übergabeort", loan.circle.fixed_spot] as [string, string]] : []),
            ...(loan.circle ? [["Kreis", loan.circle.name] as [string, string]] : []),
            ...(loan.extensionsUsed ? [["Verlängert", `${loan.extensionsUsed}×`] as [string, string]] : []),
            ...(loan.swapCopyId ? [["Im Tausch", loan.swapOffered.find((o) => o.id === loan.swapCopyId)?.title ?? "–"] as [string, string]] : []),
          ]} />

          {loan.conditionNote || loan.conditionPhotoKeys.length ? (
            <div>
              <p className="eyebrow mb-2">Zustandsnotiz</p>
              {loan.conditionNote && <p className="text-[15px]">{loan.conditionNote}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {loan.conditionPhotoKeys.map((k) => <a key={k} href={imageUrl(k, false)} target="_blank"><img src={imageUrl(k)} alt="Foto zum Zustand" className="h-16 w-16 object-cover rounded-xs" /></a>)}
              </div>
            </div>
          ) : null}
          {loan.dropoffPhotoKey && (
            <div>
              <p className="eyebrow mb-2">Foto der Ablage</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={imageUrl(loan.dropoffPhotoKey, false)} target="_blank"><img src={imageUrl(loan.dropoffPhotoKey)} alt="Foto der Ablage" className="w-full rounded-xs" /></a>
            </div>
          )}
          {loan.case && (
            <div>
              <p className="eyebrow mb-2">{loan.case.kind === "damage" ? "Schadenfall" : "Fall: Rückgabe bleibt aus"}</p>
              {loan.case.description && <p className="text-[15px]">{loan.case.description}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {loan.case.photo_keys.map((k) => <a key={k} href={imageUrl(k, false)} target="_blank"><img src={imageUrl(k)} alt="Foto zum Schaden" className="h-16 w-16 object-cover rounded-xs" /></a>)}
              </div>
              {loan.case.kind === "nonreturn" && !loan.case.closed_at && (
                <p className="text-sm text-muted mt-2">Tag 7: zweite Aufforderung. Tag 14: Sperre für Leihen. Tag 30: Abschluss als verloren.</p>
              )}
            </div>
          )}
          {owner && loan.calendar && loan.kind === "lend" && (
            <div>
              <p className="eyebrow mb-3">Verleihkalender</p>
              <CalendarView cal={loan.calendar} compact showLegend={false} selection={loan.status === "requested" && loan.wanted?.end ? { start: loan.wanted.start, end: loan.wanted.end, ok: true } : undefined} />
            </div>
          )}
        </aside>
      </div>

      <details className="border-t border-line py-6 group">
        <summary className="cursor-pointer list-none flex items-center justify-between text-[15px]">
          <span className="font-serif text-xl">Verlauf</span>
          <span className="text-sm text-muted group-open:hidden">{loan.events.length === 1 ? "1 Eintrag" : `${loan.events.length} Einträge`} anzeigen</span>
        </summary>
        <div className="mt-5"><History events={loan.events} /></div>
      </details>
    </div>
  );
}
