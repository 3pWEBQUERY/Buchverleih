"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Calendar } from "@/lib/loans/calendar";
import { fitsFree } from "@/lib/loans/calendar";
import { addDays, dayToDate, diffDays, fmtDay } from "@/lib/dates";
import type { OfferKind } from "@/lib/loans/machine";
import { CalendarView } from "@/components/calendar";
import { OptionCard, Stepper } from "@/components/form-controls";
import { Button, Input, LinkButton, Notice, Textarea, cx } from "@/components/ui";
import { IconBookmark, IconLoans, IconSwap } from "@/components/icons";

/**
 * Anfrage (PRD 4.2, 4.8, 5): Eine Anfrage ist immer eine Anfrage für einen Zeitraum.
 * «Ab heute» ist nur der häufigste Fall. Freie Zeiträume im Kalender sind antippbar.
 * Unten läuft eine Zusammenfassung mit dem einzigen Akzent-Knopf mit.
 */
export function RequestPanel({
  copyId, offers, calendar, loggedIn, blocker, paused, myOffers, loanDays, title,
}: {
  copyId: string; offers: OfferKind[]; calendar: Calendar; loggedIn: boolean; blocker: string | null; paused: boolean;
  myOffers: { id: string; title: string }[]; loanDays: number; title: string;
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

  const slot = calendar.free.find((f) => f.start <= start && start < f.end);
  const maxDays = slot ? Math.max(1, Math.min(loanDays, diffDays(start, slot.end))) : loanDays;
  const d = Math.min(days, maxDays);
  const end = addDays(start, d);
  const fits = useMemo(() => fitsFree(calendar.free, start, end), [calendar.free, start, end]);
  const tooFar = diffDays(calendar.today, start) > diffDays(calendar.today, calendar.horizonEnd) - 1;
  const freeNow = calendar.free.some((f) => f.start === calendar.today);
  const ok = fits && !tooFar;

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

  let n = 0;
  const step = () => ++n;
  const canSend = loggedIn && !blocker && !paused && !busy && (kind !== "lend" || ok) && (kind !== "swap" || swapIds.length > 0);

  return (
    <div className="mt-2" aria-label="Anfrage">
      {offers.length > 1 && (
        <Section n={step()} title="Was möchtest du?">
          <div className="grid sm:grid-cols-3 gap-3">
            {offers.map((o) => (
              <OptionCard key={o} on={kind === o} onClick={() => setKind(o)}
                icon={o === "lend" ? <IconLoans /> : o === "swap" ? <IconSwap /> : <IconBookmark />}
                title={o === "lend" ? "Leihen" : o === "swap" ? "Tauschen" : "Geschenkt bekommen"}
                desc={o === "lend" ? `Bis zu ${loanDays} Tage, dann zurück.` : o === "swap" ? "Gegen eines deiner Bücher." : "Gehört danach dir."} />
            ))}
          </div>
        </Section>
      )}

      {kind === "lend" && (
        <Section n={step()} title="Zeitraum wählen" desc={freeNow ? "Das Buch ist jetzt frei. Tippe im Kalender auf einen freien Zeitraum, um später zu beginnen." : `Gerade belegt. Frei ab ${firstFree ? fmtDay(dayToDate(firstFree.start)) : "–"} – du kannst den Zeitraum schon jetzt buchen.`}>
          <div className="rounded-[10px] border border-line p-5 md:p-6">
            <CalendarView cal={calendar} selection={{ start, end, ok }} onPick={(s, dd) => { setStart(dd); setDays(Math.min(loanDays, diffDays(dd, s.end))); }} />
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="rounded-[10px] border border-line p-4">
              <label htmlFor="beginn" className="font-medium text-[15px] block">Beginn</label>
              <p className="text-[13px] text-muted mt-0.5 mb-3">Frühestens heute, höchstens {diffDays(calendar.today, calendar.horizonEnd) - 1} Tage im Voraus.</p>
              <Input id="beginn" type="date" value={start} min={calendar.today} max={addDays(calendar.horizonEnd, -1)} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </div>
            <div className="rounded-[10px] border border-line p-4">
              <p className="font-medium text-[15px]">Dauer</p>
              <p className="text-[13px] text-muted mt-0.5 mb-3">Höchstens {maxDays} {maxDays === 1 ? "Tag" : "Tage"} ab diesem Beginn.</p>
              <Stepper value={d} min={1} max={maxDays} format={(x) => `${x} ${x === 1 ? "Tag" : "Tage"}`} onChange={setDays} label="Dauer" full />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[7, 14, 21, maxDays].filter((x, i, a) => x <= maxDays && a.indexOf(x) === i).map((x) => (
                  <button key={x} type="button" onClick={() => setDays(x)}
                    className={cx("h-8 px-3 rounded-[6px] border text-[13px] font-medium transition-colors", d === x ? "border-accent bg-accent-soft/35 text-accent-hover" : "border-line hover:border-ink-2 text-ink-2")}>
                    {x === maxDays && x !== 7 && x !== 14 && x !== 21 ? "Maximum" : `${x / 7} ${x === 7 ? "Woche" : "Wochen"}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {kind === "swap" && (
        <Section n={step()} title="Deine Tauschbücher" desc="Biete 1 bis 5 deiner Bücher zur Auswahl an. Die andere Person wählt eines aus. Es gibt keinen Wertausgleich.">
          {myOffers.length === 0 ? (
            <Notice>Du hast noch keine Bücher zum Tausch markiert. <Link href="/regal" className="underline underline-offset-4">Im Regal markieren</Link></Notice>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {myOffers.map((o) => {
                const on = swapIds.includes(o.id);
                return (
                  <OptionCard key={o.id} multi compact on={on} title={o.title}
                    onClick={() => setSwapIds((s) => (on ? s.filter((x) => x !== o.id) : s.length < 5 ? [...s, o.id] : s))} />
                );
              })}
            </div>
          )}
        </Section>
      )}

      {kind === "gift" && (
        <Section n={step()} title="So funktioniert ein Geschenk" desc="Bei mehreren Anfragen wählt die schenkende Person frei. Geschenkte Bücher kannst du frühestens nach 30 Tagen weitergeben.">
          <></>
        </Section>
      )}

      <Section n={step()} title="Nachricht" desc="Freiwillig. Kurz hallo sagen, oder wann und wo es dir passt.">
        <Textarea maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Hallo, ich würde «${title}» gerne lesen …`} />
      </Section>

      {/* Zusammenfassung mit dem einzigen Akzent-Knopf */}
      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-6 z-20 mt-10 anim-rise">
        <div className="rounded-[12px] border border-line-strong bg-paper/95 backdrop-blur-md p-3 pl-4 md:p-5 flex items-center justify-between gap-3 md:gap-4">
          <div className="min-w-0" aria-live="polite">
            {kind === "lend" ? (
              ok ? (
                <>
                  <p className="hidden md:block text-[13px] text-muted">Deine Anfrage</p>
                  <p className="text-[14.5px] md:text-[19px] font-[560] tracking-[-0.02em] tnum leading-snug">
                    {fmtDay(dayToDate(start))} – {fmtDay(dayToDate(addDays(end, -1)))} <span className="text-muted font-normal text-[13px] md:text-[15px] whitespace-nowrap">· {d} {d === 1 ? "Tag" : "Tage"}</span>
                  </p>
                </>
              ) : (
                <p className="text-late text-[13.5px] md:text-[14.5px] leading-snug max-w-md">{tooFar ? "So weit im Voraus lässt sich dieses Buch nicht buchen." : "Dieser Zeitraum ist belegt. Tippe im Kalender auf einen freien Zeitraum."}</p>
              )
            ) : kind === "swap" ? (
              <>
                <p className="text-[13px] text-muted">Deine Anfrage</p>
                <p className="text-[17px] font-[560] tracking-[-0.02em]">{swapIds.length === 0 ? "Wähle mindestens ein Buch" : `Tausch, ${swapIds.length} ${swapIds.length === 1 ? "Buch" : "Bücher"} zur Auswahl`}</p>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted">Deine Anfrage</p>
                <p className="text-[17px] font-[560] tracking-[-0.02em]">Geschenk</p>
              </>
            )}
            <p className="hidden md:block text-[12.5px] text-muted mt-0.5">Antwort innert 72 Stunden, sonst verfällt die Anfrage.</p>
          </div>
          {!loggedIn ? (
            <LinkButton href={`/anmelden?next=/exemplar/${copyId}`} variant="primary" size="lg">Anmelden und anfragen</LinkButton>
          ) : (
            <Button variant="primary" size="lg" className="flex-none !px-4 md:!px-6" onClick={submit} disabled={!canSend}>
              {busy ? "Sendet …" : kind === "swap" ? "Tausch anfragen" : <><span className="md:hidden">Anfragen</span><span className="hidden md:inline">Anfrage senden</span></>}
            </Button>
          )}
        </div>
        {paused && <Notice className="mt-3">Dieses Regal ist gerade pausiert. Anfragen sind später wieder möglich.</Notice>}
        {blocker && <Notice tone="accent" className="mt-3">{blocker} <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4">Zu den Einstellungen</Link></Notice>}
        {error && <p className="text-late mt-3" role="alert">{error}</p>}
      </div>
    </div>
  );
}

function Section({ n, title, desc, children }: { n: number; title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="pt-10 md:pt-12 mt-10 md:mt-12 border-t border-line" aria-label={title}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-6">
        <span className="text-[13px] tnum text-muted pt-1.5">0{n}</span>
        <div>
          <h3 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em]">{title}</h3>
          {desc && <p className="text-[15px] text-muted mt-1.5 max-w-2xl">{desc}</p>}
        </div>
      </div>
      <div className="md:pl-[72px]">{children}</div>
    </section>
  );
}
