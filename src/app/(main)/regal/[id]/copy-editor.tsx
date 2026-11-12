"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { CopyDetail } from "@/lib/copies";
import type { Calendar } from "@/lib/loans/calendar";
import type { OfferKind } from "@/lib/loans/machine";
import { api, uploadPhoto } from "@/lib/client";
import { addDays, dayToDate, dueDay, fmtDay, fmtMonthYear, fmtRange, relDays, todayCH } from "@/lib/dates";
import { conditionHint, conditionLabel, languageLabel } from "@/lib/i18n/de-CH";
import { CalendarView } from "@/components/calendar";
import { Cover, imageUrl } from "@/components/cover";
import { shelfStatusText } from "@/components/status";
import { useToast } from "@/components/toast";
import { Button, Field, Input, Notice, Switch, Textarea, cx } from "@/components/ui";
import { OptionCard, Stepper } from "@/components/form-controls";
import { timeMeter, TimeMeter } from "@/components/loan/loan-row";
import { Monogram } from "@/components/person/monogram";
import { offerNoun, statusLabel } from "@/lib/i18n/de-CH";
import { IconArrowLeft, IconArrowRight, IconCamera, IconCheck, IconClose, IconLoans, IconSwap, IconBookmark, IconCircles, IconUser, IconShield, IconPlus } from "@/components/icons";

/**
 * Exemplar bearbeiten. Links ein ruhiges Produktblatt (Cover, Status, Daten),
 * rechts die Einstellungen in nummerierten Abschnitten. Jede Änderung speichert sofort.
 */
type Settings = {
  condition: number;
  conditionNote: string | null;
  offers: OfferKind[];
  visibility: CopyDetail["visibility"];
  circleIds: string[];
  loanDays: 14 | 28 | 42 | 56;
  autoExtend: boolean;
  maxExtensions: number;
  horizonDays: 30 | 60 | 90 | 180;
  bufferDays: number;
  maxFutureBookings: number;
  passOn: CopyDetail["pass_on"];
  chainMax: number;
  dropoffAllowed: boolean;
};

export type HistoryRow = {
  id: string; kind: OfferKind; status: string; late: boolean;
  borrower_id: string; borrower_name: string; borrower_avatar: string | null;
  requested_at: string; handed_over_at: string | null; ended_at: string | null; due_at: string | null;
};

const SECTIONS = [
  ["angebot", "Angebot"],
  ["leihe", "Leihe"],
  ["kalender", "Kalender"],
  ["weitergabe", "Weitergabe"],
  ["zustand", "Zustand"],
  ["verlauf", "Verlauf"],
] as const;

export function CopyEditor({ copy, calendar, circles, history }: { copy: CopyDetail; calendar: Calendar; circles: { id: string; name: string; loanDays: number }[]; history: HistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<Settings>({
    condition: copy.condition,
    conditionNote: copy.condition_note,
    offers: copy.offers,
    visibility: copy.visibility,
    circleIds: copy.circle_ids,
    loanDays: copy.loan_days as Settings["loanDays"],
    autoExtend: copy.auto_extend,
    maxExtensions: copy.max_extensions,
    horizonDays: copy.horizon_days as Settings["horizonDays"],
    bufferDays: copy.buffer_days,
    maxFutureBookings: copy.max_future_bookings,
    passOn: copy.pass_on,
    chainMax: copy.chain_max,
    dropoffAllowed: copy.dropoff_allowed,
  });
  const [note, setNote] = useState(copy.condition_note ?? "");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [removing, setRemoving] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Optimistisch speichern: sofort anzeigen, bei Fehler zurücksetzen. */
  async function save(patch: Partial<Settings>) {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, s[k as keyof Settings]])) as Partial<Settings>;
    setS((cur) => ({ ...cur, ...patch }));
    setSaving("saving");
    try {
      await api(`/copies/${copy.id}`, { method: "PATCH", body: patch });
      setSaving("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaving("idle"), 2400);
      router.refresh();
    } catch (e) {
      setS((cur) => ({ ...cur, ...before }));
      setSaving("idle");
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await api(`/copies/${copy.id}`, { method: "DELETE" });
      toast.show(
        {
          text: `«${copy.title}» ist nicht mehr in deinem Regal.`,
          undo: async () => {
            try {
              await api(`/copies/${copy.id}/restore`, { method: "POST" });
              router.push(`/regal/${copy.id}`);
            } catch (e) {
              toast.error((e as Error).message);
            }
          },
        },
        7000,
      );
      router.push("/regal");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setRemoving(false);
    }
  }

  const st = shelfStatusText(copy);
  const photo = copy.photos[0];
  const locked = copy.transfer_locked_until && new Date(copy.transfer_locked_until) > new Date() ? copy.transfer_locked_until : null;
  const circleDays = circles.filter((c) => s.circleIds.includes(c.id));
  const coverData = { title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id };
  const dot = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" }[st.tone];
  const offered = s.offers.length > 0;
  const handed = history.filter((h) => h.handed_over_at);
  const daysOut = handed.reduce((n, h) => n + Math.max(0, Math.round(((h.ended_at ? new Date(h.ended_at) : new Date()).getTime() - new Date(h.handed_over_at!).getTime()) / 86_400_000)), 0);
  const people = new Set(handed.map((h) => h.borrower_id)).size;
  const meter = copy.lent_until
    ? timeMeter({ status: "active", kind: "lend", role: "owner", other_name: copy.lent_to ?? "der Person", wanted: "", due_at: copy.lent_until, respond_by: new Date(), requested_at: new Date(),
        handed_over_at: copy.lent_since ?? null, handover_by: null, returned_at: null, inspection_until: null })
    : null;

  return (
    <div>
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Mein Regal
      </Link>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
        {/* ------------------------------------------------ Produktblatt */}
        <aside className="lg:sticky lg:top-8 space-y-5">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
              <Link href={`/exemplar/${copy.id}`} className="book block" aria-label="So sehen es andere">
                <span className="book-face block lg:hidden"><Cover priority data={coverData} width={104} height={156} uniform /></span>
                <span className="book-face hidden lg:block"><Cover priority large data={coverData} width={220} height={330} uniform /></span>
              </Link>
            </div>
            <div className="anim-rise min-w-0">
              <h1 lang="de" className="font-serif text-[24px] md:text-[32px] leading-[1.1] hyphens-auto break-words">{copy.title}</h1>
              <p className="text-[14.5px] md:text-[15px] text-ink-2 mt-1.5">{copy.authors.join(", ")}</p>
            </div>
          </div>

          <div className="rounded-[10px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[14px] font-medium"><span aria-hidden className={cx("h-2 w-2 rounded-full", dot)} />{st.text}</span>
              {copy.loan_id && (
                <Link href={`/vorgaenge/${copy.loan_id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-hover hover:underline underline-offset-4">
                  Vorgang <IconArrowRight width={14} height={14} />
                </Link>
              )}
            </div>
            {meter && <div className="p-2"><TimeMeter m={meter} /></div>}
            {copy.open_requests > 0 && (
              <Link href="/vorgaenge?seite=verleihe" className="px-4 py-3 flex items-center justify-between gap-3 text-[13.5px] font-medium text-accent-hover hover:bg-accent-soft/20 transition-colors">
                <span className="inline-flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />{copy.open_requests === 1 ? "1 offene Anfrage" : `${copy.open_requests} offene Anfragen`}</span>
                <IconArrowRight width={14} height={14} />
              </Link>
            )}
            <dl className="grid grid-cols-3 divide-x divide-line">
              {([[handed.length, handed.length === 1 ? "Leihe" : "Leihen"], [daysOut, "Tage unterwegs"], [people, people === 1 ? "Person" : "Personen"]] as [number, string][]).map(([n, l]) => (
                <div key={l} className="px-3 py-3 flex flex-col-reverse">
                  <dt className="text-[11.5px] text-muted mt-1 leading-tight">{l}</dt>
                  <dd className="text-[20px] font-[560] tracking-[-0.04em] leading-none tnum">{n}</dd>
                </div>
              ))}
            </dl>
            <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {[
                ["Ausgabe", [copy.publisher, copy.year, copy.binding === "hardcover" ? "gebunden" : copy.binding === "paperback" ? "Taschenbuch" : null].filter(Boolean).join(", ") || "–"],
                ["Sprache", copy.language ? languageLabel[copy.language] ?? copy.language : "–"],
                ["ISBN", copy.isbn13 ?? "–"],
                ["Im Regal seit", fmtMonthYear(copy.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <Link href={`/exemplar/${copy.id}`} className="h-11 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
              So sehen es andere <IconArrowRight width={16} height={16} />
            </Link>
            <button type="button" onClick={remove} disabled={removing}
              className="h-11 rounded-[6px] text-[14px] font-medium text-late hover:bg-late/[0.07] transition-colors disabled:opacity-40">
              Aus dem Regal nehmen
            </button>
          </div>
        </aside>

        {/* ------------------------------------------------ Einstellungen */}
        <div className="min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-4 anim-rise">
            <div>
              <p className="eyebrow">Buch bearbeiten</p>
              <h2 className="display text-[28px] md:text-[38px] mt-2">So teilst du <em>dieses Buch.</em></h2>
            </div>
            <SaveState state={saving} />
          </header>

          <nav aria-label="Abschnitte" className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mt-8 bg-paper/95 backdrop-blur-sm border-b border-line">
            <ol className="flex gap-6 overflow-x-auto text-[14px] font-medium" style={{ scrollbarWidth: "none" }}>
              {SECTIONS.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="group flex items-center gap-2 h-12 border-b-2 border-transparent hover:border-accent text-muted hover:text-ink transition-colors whitespace-nowrap">
                    <span className="tnum text-[12px] text-muted/70 group-hover:text-accent">0{i + 1}</span>{label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* 01 Angebot */}
          <Section id="angebot" n={1} title="Angebot und Sichtbarkeit" desc="Was andere mit dem Buch tun können, und wer es überhaupt sieht.">
            <Label title="Angebot" hint={locked ? `Du hast es geschenkt bekommen. Tauschen und Verschenken geht ab ${fmtDay(locked)}.` : "Mehrere möglich. Ohne Auswahl bleibt das Buch privat in deinem Regal."} />
            <div className="grid sm:grid-cols-3 gap-3">
              {([
                ["lend", "Leihen", "Kommt nach der Leihfrist zurück.", <IconLoans key="i" />],
                ["swap", "Tauschen", "Gegen ein Buch der anderen Person.", <IconSwap key="i" />],
                ["gift", "Verschenken", "Wechselt dauerhaft den Besitzer.", <IconBookmark key="i" />],
              ] as const).map(([o, title, desc, icon]) => {
                const on = s.offers.includes(o);
                return (
                  <OptionCard key={o} multi on={on} icon={icon} title={title} desc={desc}
                    onClick={() => save({ offers: (["lend", "swap", "gift"] as OfferKind[]).filter((x) => (x === o ? !on : s.offers.includes(x))) })} />
                );
              })}
            </div>
            {!offered && <Notice className="mt-4">Nicht angeboten: Das Buch steht in deinem Regal, andere sehen es nicht.</Notice>}

            <Label title="Wer es sieht" className="mt-10" />
            <div role="radiogroup" aria-label="Wer das Buch sieht" className="grid sm:grid-cols-3 gap-3">
              {([
                ["all", "Alle", "Mitglieder in deiner Umgebung.", <IconUser key="i" />],
                ["proven", "Ab Bewährt", "Mit mindestens drei pünktlichen Leihen.", <IconShield key="i" />],
                ["circles", "Nur Kreise", "Nur die Kreise, die du unten wählst.", <IconCircles key="i" />],
              ] as const).map(([v, title, desc, icon]) => (
                <OptionCard key={v} on={s.visibility === v} icon={icon} title={title} desc={desc} onClick={() => save({ visibility: v })} />
              ))}
            </div>

            <Label title="In meinen Kreisen" hint="Ausgewählte Kreise zeigen das Buch in ihrem gemeinsamen Regal." className="mt-10" />
            {circles.length === 0 ? (
              <p className="text-[15px] text-ink-2">Du bist in keinem Kreis. <Link href="/kreise/neu" className="font-medium text-accent-hover underline underline-offset-4">Kreis gründen</Link></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {circles.map((c) => {
                  const on = s.circleIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" aria-pressed={on}
                      onClick={() => save({ circleIds: on ? s.circleIds.filter((x) => x !== c.id) : [...s.circleIds, c.id] })}
                      className={cx("h-11 pl-3 pr-4 rounded-[6px] border inline-flex items-center gap-2.5 text-[14.5px] font-medium transition-colors",
                        on ? "border-accent bg-accent-soft/35 text-ink" : "border-line-strong hover:border-ink-2")}>
                      <span className={cx("h-5 w-5 rounded-[4px] grid place-items-center border transition-colors", on ? "bg-accent border-accent text-accent-ink" : "border-line-strong")}>
                        {on && <IconCheck width={13} height={13} strokeWidth={2.4} />}
                      </span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {s.visibility === "circles" && s.circleIds.length === 0 && (
              <Notice tone="late" className="mt-4">Kein Kreis ausgewählt. So sieht das Buch niemand. Wähle mindestens einen Kreis.</Notice>
            )}
          </Section>

          {/* 02 Leihe */}
          <Section id="leihe" n={2} title="Leihe" desc="Wie lange das Buch weg sein darf und wie es übergeben wird.">
            <Label title="Leihfrist" hint={circleDays.length > 0
              ? `In ${circleDays.length === 1 ? `«${circleDays[0].name}»` : "deinen Kreisen"} gilt die Leihfrist des Kreises${circleDays.length === 1 ? ` (${circleDays[0].loanDays} Tage)` : ""}.`
              : undefined} />
            <div className="grid grid-cols-4 gap-3">
              {([14, 28, 42, 56] as const).map((d) => {
                const on = s.loanDays === d;
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => save({ loanDays: d })}
                    className={cx("rounded-[10px] border px-4 py-4 text-left transition-colors", on ? "border-accent bg-accent-soft/35" : "border-line hover:border-ink-2")}>
                    <span className={cx("block text-[30px] md:text-[36px] font-[560] tracking-[-0.04em] leading-none tnum", on && "text-accent-hover")}>{d}</span>
                    <span className="block text-[13px] text-muted mt-1.5">Tage{d === 28 ? " · Standard" : ""}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 rounded-[10px] border border-line divide-y divide-line">
              <div className="px-5">
                <Switch checked={s.autoExtend} onChange={(v) => save({ autoExtend: v })} label={<span className="font-medium">Verlängerung automatisch gewähren</span>}
                  hint="Um 14 Tage, wenn der Kalender danach frei ist. Sonst fragt die Person bei dir an." />
              </div>
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-[15px]">Höchstens so oft verlängern</p>
                  <p className="text-[13.5px] text-muted mt-0.5">{s.maxExtensions === 0 ? "Keine Verlängerung möglich." : `Bis zu ${s.maxExtensions * 14} Tage zusätzlich.`}</p>
                </div>
                <Stepper value={s.maxExtensions} min={0} max={2} format={(n) => (n === 0 ? "nie" : `${n}×`)} onChange={(v) => save({ maxExtensions: v })} label="Verlängerungen" />
              </div>
              <div className="px-5">
                <Switch checked={s.dropoffAllowed} onChange={(v) => save({ dropoffAllowed: v })} label={<span className="font-medium">Ablage erlaubt</span>}
                  hint="Übergabe über Milchkasten oder Briefkasten, mit Foto der Ablage." />
              </div>
            </div>
          </Section>

          {/* 03 Kalender */}
          <Section id="kalender" n={3} title="Verleihkalender" desc="Belegung, Puffer und eigene Sperrzeiten. Andere sehen nur frei und belegt.">
            <div className="rounded-[10px] border border-line p-5 md:p-6">
              <CalendarView cal={calendar} />
              <BlockForm copyId={copy.id} calendar={calendar} />
            </div>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <StatTile label="Buchbar im Voraus" hint="Wie weit andere vorausbuchen können.">
                <Stepper value={[30, 60, 90, 180].indexOf(s.horizonDays)} min={0} max={3} format={(i) => `${[30, 60, 90, 180][i]} Tage`}
                  onChange={(i) => save({ horizonDays: [30, 60, 90, 180][i] as Settings["horizonDays"] })} label="Buchungshorizont" full />
              </StatTile>
              <StatTile label="Puffer" hint="Tage zwischen zwei Leihen.">
                <Stepper value={s.bufferDays} min={0} max={7} format={(n) => `${n} ${n === 1 ? "Tag" : "Tage"}`} onChange={(v) => save({ bufferDays: v })} label="Puffer" full />
              </StatTile>
              <StatTile label="Künftige Buchungen" hint="Höchstens gleichzeitig vorgemerkt.">
                <Stepper value={s.maxFutureBookings} min={1} max={6} format={(n) => String(n)} onChange={(v) => save({ maxFutureBookings: v })} label="Künftige Buchungen" full />
              </StatTile>
            </div>
          </Section>

          {/* 04 Weitergabe */}
          <Section id="weitergabe" n={4} title="Direkte Weitergabe" desc="Folgen zwei Leihen aufeinander, kann das Buch direkt von Hand zu Hand gehen – ohne Umweg über dich.">
            <div role="radiogroup" aria-label="Direkte Weitergabe" className="grid sm:grid-cols-3 gap-3">
              {([
                ["never", "Nie", "Jede Leihe geht über dich."],
                ["on_request", "Auf Anfrage", "Du wirst bei jeder Folgeleihe gefragt."],
                ["always", "Immer", "Du stimmst im Voraus zu. Die beiden Leihenden werden trotzdem gefragt."],
              ] as const).map(([v, title, desc]) => (
                <OptionCard key={v} on={s.passOn === v} title={title} desc={desc} onClick={() => save({ passOn: v })} />
              ))}
            </div>
            <div className={cx("mt-4 rounded-[10px] border border-line px-5 py-4 flex flex-wrap items-center justify-between gap-4 transition-opacity", s.passOn === "never" && "opacity-45 pointer-events-none")} aria-disabled={s.passOn === "never"}>
              <div>
                <p className="font-medium text-[15px]">Danach zurück zu mir</p>
                <p className="text-[13.5px] text-muted mt-0.5">Nach so vielen Weitergaben in Folge kommt das Buch zu dir zurück.</p>
              </div>
              <Stepper value={s.chainMax} min={1} max={4} format={(n) => `nach ${n}`} onChange={(v) => save({ chainMax: v })} label="Kettenlänge" />
            </div>
          </Section>

          {/* 05 Zustand */}
          <Section id="zustand" n={5} title="Zustand und Fotos" desc="Bei einem Schaden wird mit diesen Angaben verglichen. Normale Lesespuren sind kein Schaden.">
            <div role="radiogroup" aria-label="Zustand" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((c) => (
                <OptionCard key={c} on={s.condition === c} title={conditionLabel[c]} desc={conditionHint[c]} compact onClick={() => save({ condition: c })} />
              ))}
            </div>
            <Field label="Notiz" hint={<>Zum Beispiel «Widmung auf Seite 1». <span className="tnum">{200 - note.length}</span> Zeichen frei.</>} className="mt-8">
              <Textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
                onBlur={() => { const v = note.trim() || null; if (v !== (s.conditionNote ?? null)) save({ conditionNote: v }); }} />
            </Field>
            <Label title="Fotos" hint={copy.cover_key ? "Das Original-Cover erscheint im Regal. Fotos zeigen den Zustand deines Exemplars." : "Ohne Cover erscheint das erste Foto im Regal."} className="mt-8" />
            <Photos copy={copy} />
          </Section>

          {/* 06 Verlauf */}
          <Section id="verlauf" n={6} title="Leihverlauf" desc="Wer das Buch schon hatte und wie es lief. Ein Tippen öffnet den Vorgang." last>
            {history.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-line-strong p-6 text-[14.5px] text-ink-2">
                Noch keine Anfrage für dieses Buch. Sobald jemand es leiht, steht es hier.
              </div>
            ) : (
              <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
                {history.map((h) => {
                  const open = ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(h.status);
                  const ended = ["declined", "withdrawn", "expired", "cancelled"].includes(h.status);
                  const days = h.handed_over_at ? Math.max(1, Math.round(((h.ended_at ? new Date(h.ended_at) : new Date()).getTime() - new Date(h.handed_over_at).getTime()) / 86_400_000)) : null;
                  const tone = h.status === "lost" || h.status === "disputed" || (h.late && h.status === "completed") ? "bg-late" : open ? "bg-accent" : ended ? "bg-done" : "bg-ok";
                  return (
                    <li key={h.id}>
                      <Link href={`/vorgaenge/${h.id}`} className="group grid grid-cols-[36px_minmax(0,1fr)_auto] gap-x-3.5 items-center px-4 md:px-5 py-3.5 hover:bg-paper-2 transition-colors">
                        <Monogram name={h.borrower_name} seed={h.borrower_id} size={36} photo={h.borrower_avatar} />
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium truncate group-hover:underline underline-offset-4 decoration-1">{h.borrower_name} <span className="text-muted font-normal">· {offerNoun[h.kind]}</span></p>
                          <p className="text-[13px] text-muted tnum truncate mt-0.5">
                            {h.handed_over_at
                              ? `${fmtDay(h.handed_over_at)} – ${h.ended_at ? fmtDay(h.ended_at) : "heute"}${days ? ` · ${days} ${days === 1 ? "Tag" : "Tage"}` : ""}`
                              : `Angefragt am ${fmtDay(h.requested_at)}`}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
                          <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", tone)} />
                          {h.status === "completed" && h.late ? "Verspätet zurück" : h.status === "completed" && h.kind === "lend" ? "Pünktlich zurück" : statusLabel[h.status as keyof typeof statusLabel] ?? h.status}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Bausteine

function SaveState({ state }: { state: "idle" | "saving" | "saved" }) {
  return (
    <p className="h-8 px-3 rounded-[6px] border border-line text-[13px] text-muted inline-flex items-center gap-2" aria-live="polite">
      {state === "saving" ? (
        <><span className="h-1.5 w-1.5 rounded-full bg-accent live-dot" /> Wird gespeichert</>
      ) : state === "saved" ? (
        <><IconCheck width={14} height={14} className="text-ok" /> Gespeichert</>
      ) : (
        <><span className="h-1.5 w-1.5 rounded-full bg-ok" /> Änderungen werden sofort gespeichert</>
      )}
    </p>
  );
}

function Section({ id, n, title, desc, children, last }: { id: string; n: number; title: string; desc?: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <section id={id} className={cx("scroll-mt-28 pt-12 md:pt-14", !last && "pb-12 md:pb-14 border-b border-line")} aria-labelledby={`${id}-t`}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-7">
        <span className="text-[13px] tnum text-muted pt-1.5">0{n}</span>
        <div>
          <h2 id={`${id}-t`} className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em]">{title}</h2>
          {desc && <p className="text-[15px] text-muted mt-1.5 max-w-2xl">{desc}</p>}
        </div>
      </div>
      <div className="md:pl-[72px]">{children}</div>
    </section>
  );
}

function Label({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cx("mb-3", className)}>
      <p className="text-[15px] font-medium">{title}</p>
      {hint && <p className="text-[13.5px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

function StatTile({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line p-4">
      <p className="font-medium text-[15px]">{label}</p>
      <p className="text-[13px] text-muted mt-0.5 mb-4">{hint}</p>
      {children}
    </div>
  );
}

function Photos({ copy }: { copy: CopyDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const photos = copy.photos.filter((p) => !hidden.has(p.id));

  async function add(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadPhoto(file, "copy_photo", copy.id);
      await api(`/copies/${copy.id}/photos`, { body: { uploadId: up.id } });
      toast.show({ text: "Foto hinzugefügt" }, 2000);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function remove(id: string) {
    setHidden((h) => new Set(h).add(id));
    // Erst nach Ablauf der Rückgängig-Frist wirklich löschen
    const t = setTimeout(async () => {
      try {
        await api(`/copies/${copy.id}/photos?photo=${id}`, { method: "DELETE" });
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    }, 5000);
    toast.show({
      text: "Foto entfernt",
      undo: () => {
        clearTimeout(t);
        setHidden((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        });
      },
    });
  }

  return (
    <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {photos.map((p) => (
        <li key={p.id} className="relative aspect-[3/4] group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-full w-full object-cover rounded-[8px] outline outline-1 -outline-offset-1 outline-black/10" />
          <button type="button" onClick={() => remove(p.id)} aria-label="Foto entfernen"
            className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-[6px] bg-paper/95 border border-line text-muted hover:text-late hover:border-late transition-colors">
            <IconClose width={14} height={14} />
          </button>
        </li>
      ))}
      <li className="aspect-[3/4]">
        <label className={cx("h-full w-full rounded-[8px] border border-dashed border-line-strong grid place-items-center text-center cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]", uploading && "opacity-45 pointer-events-none")}>
          <span className="flex flex-col items-center gap-2 text-[13px] font-medium text-ink-2 px-2">
            <IconCamera width={22} height={22} className="text-accent-hover" />
            {uploading ? "Lädt …" : "Foto hinzufügen"}
          </span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading}
            onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </li>
    </ul>
  );
}

function BlockForm({ copyId, calendar }: { copyId: string; calendar: Calendar }) {
  const router = useRouter();
  const toast = useToast();
  const today = todayCH();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [last, setLast] = useState(addDays(today, 13));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const blocks = calendar.bars.filter((b) => b.kind === "block" && (!b.note || !b.note.startsWith("Tausch ")));
  useEffect(() => { if (last < start) setLast(start); }, [start, last]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/copies/${copyId}/blocks`, { body: { start, end: addDays(last, 1), note: note.trim() || undefined } });
      toast.show({ text: `Gesperrt: ${fmtRange({ start, end: addDays(last, 1) })}` }, 2500);
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Calendar["bars"][number]) {
    try {
      await api(`/copies/${copyId}/blocks?block=${b.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: "Sperrzeit entfernt",
        undo: async () => {
          try {
            await api(`/copies/${copyId}/blocks`, { body: { start: b.start, end: b.end, note: b.note ?? undefined } });
            router.refresh();
          } catch (err) {
            toast.error((err as Error).message);
          }
        },
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-line">
      {blocks.length > 0 && (
        <ul className="mb-4 space-y-2" aria-label="Sperrzeiten">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 rounded-[8px] bg-paper-2 px-4 py-2.5 text-[14.5px]">
              <span>{fmtRange({ start: b.start, end: b.end })}<span className="text-muted">{b.note ? ` · ${b.note}` : " · gesperrt"}</span></span>
              <button type="button" className="text-[13px] font-medium text-muted hover:text-late" onClick={() => remove(b)}>Entfernen</button>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-[14px] font-medium text-accent-hover hover:underline underline-offset-4">
          <IconPlus width={16} height={16} /> Sperrzeit eintragen
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-[10px] bg-paper-2 p-4 md:p-5 anim-rise">
          <p className="text-[13.5px] text-muted mb-4">Zeiten, in denen du das Buch selbst brauchst, zum Beispiel zum Lesen oder in den Ferien.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Erster Tag"><Input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required /></Field>
            <Field label="Letzter Tag"><Input type="date" value={last} min={start} onChange={(e) => setLast(e.target.value)} required /></Field>
            <Field label="Notiz (nur für dich)"><Input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="Selbst lesen" /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Button type="submit" variant="primary" disabled={busy}>Sperrzeit eintragen</Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Abbrechen</Button>
            {start && last >= start && (
              <span className="text-[13px] text-muted ml-auto">{fmtDay(dayToDate(start))} bis {fmtDay(dayToDate(last))} · {(() => { const n = Math.round((dayToDate(last).getTime() - dayToDate(start).getTime()) / 86_400_000) + 1; return `${n} ${n === 1 ? "Tag" : "Tage"}`; })()}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
