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
import { Button, Check, Field, Input, LinkButton, Notice, Segmented, Textarea, cx } from "@/components/ui";

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

  const heading = kind === "lend" ? (freeNow ? "Jetzt frei" : `Frei ab ${firstFree ? fmtDay(dayToDate(firstFree.start)) : "–"}`) : kind === "swap" ? "Tauschen" : "Geschenkt bekommen";
  const ok = fits && !tooFar;

  return (
    <section className="panel !border-ink rounded-[18px] p-5 md:p-8 anim-rise" style={{ animationDelay: "140ms" }} aria-labelledby="anfrage">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 mb-6">
        <div>
          <p className="eyebrow flex items-center gap-2">
            {kind === "lend" && freeNow && <span aria-hidden className="h-2 w-2 rounded-full bg-ok live-dot" />}
            Anfrage
          </p>
          <h2 id="anfrage" className="font-serif text-[36px] md:text-[48px] leading-none mt-2">{heading}</h2>
        </div>
        {offers.length > 1 && (
          <Segmented name="Angebotsart" value={kind} onChange={setKind} className="w-full sm:w-auto sm:min-w-80" options={offers.map((o) => ({ value: o, label: offerLabel[o] }))} />
        )}
      </div>

      {kind === "lend" && (
        <>
          <CalendarView cal={calendar} selection={{ start, end, ok }} onPick={(_s, d) => { setStart(d); setDays(Math.min(loanDays, diffDays(d, _s.end))); }} />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[auto_auto_minmax(0,1fr)] gap-x-4 gap-y-4 mt-7 items-end">
            <Field label="Beginn" className="min-w-0">
              <Input type="date" value={start} min={calendar.today} max={addDays(calendar.horizonEnd, -1)} onChange={(e) => e.target.value && setStart(e.target.value)} className="sm:w-48" />
            </Field>
            <Field label={<>Dauer <span className="font-normal text-muted">· höchstens {maxDays} Tage</span></>}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(Math.max(1, Math.min(loanDays, Number(e.target.value) || 1)))} className="w-20 tnum" />
                <span className="text-muted text-sm">Tage</span>
              </div>
            </Field>
            <div className={cx("col-span-2 sm:col-span-3 rounded-[10px] px-4 py-3 min-h-12 flex flex-wrap items-baseline gap-x-2", ok ? "bg-paper-2" : "bg-late/[0.08]")} aria-live="polite">
              {ok ? (
                <>
                  <span className="text-[14px] text-muted">Zurück bis</span>
                  <span className="font-semibold leading-tight">{fmtDay(dayToDate(addDays(end, -1)))} <span className="font-normal text-muted">· {days} {days === 1 ? "Tag" : "Tage"}</span></span>
                </>
              ) : (
                <span className="text-late text-[14px] leading-snug">{tooFar ? "So weit im Voraus lässt sich dieses Buch nicht buchen." : "Dieser Zeitraum ist belegt. Tippe im Kalender auf einen freien Zeitraum."}</span>
              )}
            </div>
          </div>
        </>
      )}

      {kind === "swap" && (
        <div>
          <p className="text-ink-2 mb-4 max-w-xl">Biete 1 bis 5 deiner Bücher zur Auswahl an. Die andere Person wählt eines, oder schaut sich dein ganzes Tauschregal an. Es gibt keinen Wertausgleich.</p>
          {myOffers.length === 0 ? (
            <Notice>Du hast noch keine Bücher zum Tausch markiert. <Link href="/regal" className="underline underline-offset-4">Im Regal markieren</Link></Notice>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {myOffers.map((o) => {
                const on = swapIds.includes(o.id);
                return (
                  <Check key={o.id} className={cx("rounded-[10px] border px-4 py-3 transition-colors", on ? "border-ink bg-paper-2" : "border-line hover:border-line-strong")}
                    label={<span className="font-serif text-[19px] leading-tight">{o.title}</span>} checked={on}
                    onChange={(v) => setSwapIds((s) => (v ? (s.length < 5 ? [...s, o.id] : s) : s.filter((x) => x !== o.id)))} />
                );
              })}
            </div>
          )}
        </div>
      )}

      {kind === "gift" && <p className="text-ink-2 max-w-xl">Bei mehreren Anfragen wählt die schenkende Person frei. Geschenkte Bücher kannst du frühestens nach 30 Tagen weitergeben.</p>}

      <Field label="Nachricht (freiwillig)" className="mt-7">
        <Textarea maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Kurz hallo sagen, oder wann es dir passt." />
      </Field>

      <div className="mt-6 pt-6 border-t border-line flex flex-wrap items-center gap-x-5 gap-y-3">
        {!loggedIn ? (
          <LinkButton href={`/anmelden?next=/exemplar/${copyId}`} variant="primary" size="lg">Anmelden und anfragen</LinkButton>
        ) : paused ? (
          <Notice className="w-full">Dieses Regal ist gerade pausiert. Anfragen sind später wieder möglich.</Notice>
        ) : blocker ? (
          <Notice tone="accent" className="w-full">{blocker} <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4">Zu den Einstellungen</Link></Notice>
        ) : (
          <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={submit} disabled={busy || (kind === "lend" && !ok) || (kind === "swap" && swapIds.length === 0)}>
            {busy ? "Wird gesendet …" : kind === "swap" ? "Tausch anfragen" : "Anfragen"}
          </Button>
        )}
        {loggedIn && !blocker && !paused && <span className="text-sm text-muted max-w-xs">Die Antwort kommt innert 72 Stunden, sonst verfällt die Anfrage.</span>}
      </div>
      {error && <p className="text-late mt-4" role="alert">{error}</p>}
    </section>
  );
}
