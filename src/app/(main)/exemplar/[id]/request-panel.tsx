"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Calendar } from "@/lib/loans/calendar";
import { fitsFree } from "@/lib/loans/calendar";
import { addDays, dayToDate, diffDays, fmtDay } from "@/lib/dates";
import { offerLabel } from "@/lib/i18n/de-CH";
import type { OfferKind } from "@/lib/loans/machine";
import { CalendarView } from "@/components/calendar";
import { Button, Check, Field, Input, LinkButton, Notice, Segmented, Textarea } from "@/components/ui";

/**
 * Anfrage (PRD 4.2, 4.8, 5): Eine Anfrage ist immer eine Anfrage für einen Zeitraum.
 * «Ab heute» ist nur der häufigste Fall. Freie Zeiträume im Kalender sind antippbar.
 */
export function RequestPanel({
  copyId, offers, calendar, loggedIn, blocker, paused, myOffers, loanDays,
}: {
  copyId: string; offers: OfferKind[]; calendar: Calendar; loggedIn: boolean; blocker: string | null; paused: boolean;
  myOffers: { id: string; title: string }[]; loanDays: number;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<OfferKind>(offers[0] ?? "lend");
  const firstFree = calendar.free[0];
  const [start, setStart] = useState(firstFree?.start ?? calendar.today);
  const [days, setDays] = useState(loanDays);
  const [message, setMessage] = useState("");
  const [swapIds, setSwapIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const end = addDays(start, days);
  const fits = useMemo(() => fitsFree(calendar.free, start, end), [calendar.free, start, end]);
  const tooFar = diffDays(calendar.today, start) > diffDays(calendar.today, calendar.horizonEnd) - 1;
  const freeNow = calendar.free.some((f) => f.start === calendar.today);
  const slot = calendar.free.find((f) => f.start <= start && start < f.end);
  const maxDays = slot ? Math.min(loanDays, diffDays(start, slot.end)) : loanDays;

  if (!offers.length) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body =
        kind === "lend"
          ? { copyId, kind, start, end, message: message || undefined }
          : kind === "swap"
            ? { copyId, kind, swapOfferedCopyIds: swapIds, message: message || undefined }
            : { copyId, kind, message: message || undefined };
      const r = await api<{ id: string }>("/loans", { body });
      router.push(`/vorgaenge/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="anfrage">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
        <h2 id="anfrage" className="text-2xl md:text-3xl">{kind === "lend" ? (freeNow ? "Jetzt frei" : `Frei ab ${firstFree ? fmtDay(dayToDate(firstFree.start)) : "–"}`) : kind === "swap" ? "Tauschen" : "Geschenkt bekommen"}</h2>
        {offers.length > 1 && (
          <Segmented name="Angebotsart" value={kind} onChange={setKind} className="w-full sm:w-auto sm:min-w-80" options={offers.map((o) => ({ value: o, label: offerLabel[o] }))} />
        )}
      </div>

      {kind === "lend" && (
        <>
          <CalendarView cal={calendar} selection={{ start, end, ok: fits && !tooFar }} onPick={(_s, d) => { setStart(d); setDays(Math.min(loanDays, diffDays(d, _s.end))); }} />
          <div className="grid sm:grid-cols-[auto_auto_1fr] gap-5 mt-8 items-end">
            <Field label="Beginn">
              <Input type="date" value={start} min={calendar.today} max={addDays(calendar.horizonEnd, -1)} onChange={(e) => e.target.value && setStart(e.target.value)} className="w-48" />
            </Field>
            <Field label="Dauer">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(Math.max(1, Math.min(loanDays, Number(e.target.value) || 1)))} className="w-24 tnum" />
                <span className="text-muted text-sm whitespace-nowrap">Tage, höchstens {maxDays}</span>
              </div>
            </Field>
            <p className="text-[15px] pb-2.5">
              {fits && !tooFar ? (
                <>Bis <strong className="font-medium">{fmtDay(dayToDate(addDays(end, -1)))}</strong></>
              ) : (
                <span className="text-late">{tooFar ? "So weit im Voraus lässt sich dieses Buch nicht buchen." : "Dieser Zeitraum ist belegt. Tippe im Kalender auf einen freien Zeitraum."}</span>
              )}
            </p>
          </div>
        </>
      )}

      {kind === "swap" && (
        <div>
          <p className="text-ink-2 mb-4">Biete 1 bis 5 deiner Bücher zur Auswahl an. Die andere Person wählt eines, oder schaut sich dein ganzes Tauschregal an. Es gibt keinen Wertausgleich.</p>
          {myOffers.length === 0 ? (
            <Notice>Du hast noch keine Bücher zum Tausch markiert. <Link href="/regal" className="underline underline-offset-4">Im Regal markieren</Link></Notice>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4">
              {myOffers.map((o) => (
                <Check key={o.id} label={<span className="font-serif text-lg">{o.title}</span>} checked={swapIds.includes(o.id)}
                  onChange={(v) => setSwapIds((s) => (v ? (s.length < 5 ? [...s, o.id] : s) : s.filter((x) => x !== o.id)))} />
              ))}
            </div>
          )}
        </div>
      )}

      {kind === "gift" && <p className="text-ink-2">Bei mehreren Anfragen wählt die schenkende Person frei. Geschenkte Bücher kannst du frühestens nach 30 Tagen weitergeben.</p>}

      <Field label="Nachricht (freiwillig)" className="mt-8">
        <Textarea maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Kurz hallo sagen, oder wann es dir passt." />
      </Field>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {!loggedIn ? (
          <LinkButton href={`/anmelden?next=/exemplar/${copyId}`} variant="primary" size="lg">Anmelden und anfragen</LinkButton>
        ) : paused ? (
          <Notice>Dieses Regal ist gerade pausiert. Anfragen sind später wieder möglich.</Notice>
        ) : blocker ? (
          <Notice tone="accent">{blocker} <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4">Zu den Einstellungen</Link></Notice>
        ) : (
          <Button variant="primary" size="lg" onClick={submit} disabled={busy || (kind === "lend" && (!fits || tooFar)) || (kind === "swap" && swapIds.length === 0)}>
            {busy ? "Wird gesendet …" : kind === "lend" ? "Anfragen" : kind === "swap" ? "Tausch anfragen" : "Anfragen"}
          </Button>
        )}
        {loggedIn && !blocker && <span className="text-sm text-muted">Die Antwort kommt innert 72 Stunden, sonst verfällt die Anfrage.</span>}
      </div>
      {error && <p className="text-late mt-4" role="alert">{error}</p>}
    </section>
  );
}
