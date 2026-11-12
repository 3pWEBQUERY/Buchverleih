"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CopyDetail } from "@/lib/copies";
import type { Calendar } from "@/lib/loans/calendar";
import type { OfferKind } from "@/lib/loans/machine";
import { api } from "@/lib/client";
import { fmtDay, fmtMonthYear } from "@/lib/dates";
import { labels } from "@/lib/i18n/labels";
import { COPY } from "@/lib/i18n/messages/copy";
import { shelfStatusLocal } from "@/lib/i18n/messages/shelf-status";
import { CalendarView } from "@/components/calendar";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { Field, Notice, Switch, Textarea, cx } from "@/components/ui";
import { OptionCard, Stepper } from "@/components/form-controls";
import { timeMeter, TimeMeter } from "@/components/loan/loan-row";
import { Monogram } from "@/components/person/monogram";
import { IconArrowLeft, IconArrowRight, IconCheck, IconLoans, IconSwap, IconBookmark, IconCircles, IconUser, IconShield } from "@/components/icons";
import { BlockForm, Label, Photos, SaveState, Section, StatTile } from "./copy-parts";

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

const SECTIONS = ["angebot", "leihe", "kalender", "weitergabe", "zustand", "verlauf"] as const;

export function CopyEditor({ copy, calendar, circles, history }: { copy: CopyDetail; calendar: Calendar; circles: { id: string; name: string; loanDays: number }[]; history: HistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const l = useLocale();
  const t = COPY[l];
  const L = labels(l);
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
          text: t.removed(copy.title),
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

  const st = shelfStatusLocal(copy, l);
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
    ? timeMeter({ status: "active", kind: "lend", role: "owner", other_name: copy.lent_to ?? t.thePerson, wanted: "", due_at: copy.lent_until, respond_by: new Date(), requested_at: new Date(),
        handed_over_at: copy.lent_since ?? null, handover_by: null, returned_at: null, inspection_until: null }, l)
    : null;

  return (
    <div>
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {t.myShelf}
      </Link>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
        {/* ------------------------------------------------ Produktblatt */}
        <aside className="lg:sticky lg:top-8 space-y-5">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
              <Link href={`/exemplar/${copy.id}`} className="book block" aria-label={t.asOthers}>
                <span className="book-face block lg:hidden"><Cover priority data={coverData} width={104} height={156} uniform l={l} /></span>
                <span className="book-face hidden lg:block"><Cover priority large data={coverData} width={220} height={330} uniform l={l} /></span>
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
                  {t.loan} <IconArrowRight width={14} height={14} />
                </Link>
              )}
            </div>
            {meter && <div className="p-2"><TimeMeter m={meter} /></div>}
            {copy.open_requests > 0 && (
              <Link href="/vorgaenge?seite=verleihe" className="px-4 py-3 flex items-center justify-between gap-3 text-[13.5px] font-medium text-accent-hover hover:bg-accent-soft/20 transition-colors">
                <span className="inline-flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />{t.openRequests(copy.open_requests)}</span>
                <IconArrowRight width={14} height={14} />
              </Link>
            )}
            <dl className="grid grid-cols-3 divide-x divide-line">
              {([[handed.length, t.statLoans(handed.length)], [daysOut, t.statDays], [people, t.statPeople(people)]] as [number, string][]).map(([n, lab]) => (
                <div key={lab} className="px-3 py-3 flex flex-col-reverse">
                  <dt className="text-[11.5px] text-muted mt-1 leading-tight">{lab}</dt>
                  <dd className="text-[20px] font-[560] tracking-[-0.04em] leading-none tnum">{n}</dd>
                </div>
              ))}
            </dl>
            <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {[
                [t.edition, [copy.publisher, copy.year, copy.binding === "hardcover" ? t.hardcover : copy.binding === "paperback" ? t.paperback : null].filter(Boolean).join(", ") || "–"],
                [t.language, copy.language ? L.languageLabel[copy.language] ?? copy.language : "–"],
                ["ISBN", copy.isbn13 ?? "–"],
                [t.since, fmtMonthYear(copy.created_at, l)],
              ].map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <Link href={`/exemplar/${copy.id}`} className="h-11 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
              {t.asOthers} <IconArrowRight width={16} height={16} />
            </Link>
            <button type="button" onClick={remove} disabled={removing}
              className="h-11 rounded-[6px] text-[14px] font-medium text-late hover:bg-late/[0.07] transition-colors disabled:opacity-40">
              {t.removeFromShelf}
            </button>
          </div>
        </aside>

        {/* ------------------------------------------------ Einstellungen */}
        <div className="min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-4 anim-rise">
            <div>
              <p className="eyebrow">{t.eyebrow}</p>
              <h2 className="display text-[28px] md:text-[38px] mt-2">{t.heading[0]}<em>{t.heading[1]}</em></h2>
            </div>
            <SaveState state={saving} />
          </header>

          <nav aria-label={t.sectionsAria} className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mt-8 bg-paper/95 backdrop-blur-sm border-b border-line">
            <ol className="flex gap-6 overflow-x-auto text-[14px] font-medium" style={{ scrollbarWidth: "none" }}>
              {SECTIONS.map((id, i) => (
                <li key={id}>
                  <a href={`#${id}`} className="group flex items-center gap-2 h-12 border-b-2 border-transparent hover:border-accent text-muted hover:text-ink transition-colors whitespace-nowrap">
                    <span className="tnum text-[12px] text-muted/70 group-hover:text-accent">0{i + 1}</span>{t.sections[id]}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* 01 Angebot */}
          <Section id="angebot" n={1} title={t.offer.title} desc={t.offer.desc}>
            <Label title={t.offer.label} hint={locked ? t.offer.locked(fmtDay(locked, l)) : t.offer.hint} />
            <div className="grid sm:grid-cols-3 gap-3">
              {([
                ["lend", <IconLoans key="i" />],
                ["swap", <IconSwap key="i" />],
                ["gift", <IconBookmark key="i" />],
              ] as const).map(([o, icon]) => {
                const [title, desc] = t.offer[o];
                const on = s.offers.includes(o);
                return (
                  <OptionCard key={o} multi on={on} icon={icon} title={title} desc={desc}
                    onClick={() => save({ offers: (["lend", "swap", "gift"] as OfferKind[]).filter((x) => (x === o ? !on : s.offers.includes(x))) })} />
                );
              })}
            </div>
            {!offered && <Notice className="mt-4">{t.offer.notOffered}</Notice>}

            <Label title={t.offer.who} className="mt-10" />
            <div role="radiogroup" aria-label={t.offer.whoAria} className="grid sm:grid-cols-3 gap-3">
              {([
                ["all", <IconUser key="i" />],
                ["proven", <IconShield key="i" />],
                ["circles", <IconCircles key="i" />],
              ] as const).map(([v, icon]) => (
                <OptionCard key={v} on={s.visibility === v} icon={icon} title={t.offer[v][0]} desc={t.offer[v][1]} onClick={() => save({ visibility: v })} />
              ))}
            </div>

            <Label title={t.offer.inCircles} hint={t.offer.inCirclesHint} className="mt-10" />
            {circles.length === 0 ? (
              <p className="text-[15px] text-ink-2">{t.offer.noCircle} <Link href="/kreise/neu" className="font-medium text-accent-hover underline underline-offset-4">{t.offer.newCircle}</Link></p>
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
              <Notice tone="late" className="mt-4">{t.offer.noneChosen}</Notice>
            )}
          </Section>

          {/* 02 Leihe */}
          <Section id="leihe" n={2} title={t.lend.title} desc={t.lend.desc}>
            <Label title={t.lend.period} hint={circleDays.length > 0
              ? t.lend.circleHint(circleDays.length === 1 ? circleDays[0].name : null, circleDays.length === 1 ? circleDays[0].loanDays : null)
              : undefined} />
            <div className="grid grid-cols-4 gap-3">
              {([14, 28, 42, 56] as const).map((d) => {
                const on = s.loanDays === d;
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => save({ loanDays: d })}
                    className={cx("rounded-[10px] border px-4 py-4 text-left transition-colors", on ? "border-accent bg-accent-soft/35" : "border-line hover:border-ink-2")}>
                    <span className={cx("block text-[30px] md:text-[36px] font-[560] tracking-[-0.04em] leading-none tnum", on && "text-accent-hover")}>{d}</span>
                    <span className="block text-[13px] text-muted mt-1.5">{t.lend.days}{d === 28 ? t.lend.standard : ""}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 rounded-[10px] border border-line divide-y divide-line">
              <div className="px-5">
                <Switch checked={s.autoExtend} onChange={(v) => save({ autoExtend: v })} label={<span className="font-medium">{t.lend.autoExtend}</span>}
                  hint={t.lend.autoExtendHint} />
              </div>
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-[15px]">{t.lend.maxExt}</p>
                  <p className="text-[13.5px] text-muted mt-0.5">{s.maxExtensions === 0 ? t.lend.noExt : t.lend.upTo(s.maxExtensions * 14)}</p>
                </div>
                <Stepper value={s.maxExtensions} min={0} max={2} format={(n) => (n === 0 ? t.lend.never : `${n}×`)} onChange={(v) => save({ maxExtensions: v })} label={t.lend.extensions} />
              </div>
              <div className="px-5">
                <Switch checked={s.dropoffAllowed} onChange={(v) => save({ dropoffAllowed: v })} label={<span className="font-medium">{t.lend.dropoff}</span>}
                  hint={t.lend.dropoffHint} />
              </div>
            </div>
          </Section>

          {/* 03 Kalender */}
          <Section id="kalender" n={3} title={t.cal.title} desc={t.cal.desc}>
            <div className="rounded-[10px] border border-line p-5 md:p-6">
              <CalendarView cal={calendar} />
              <BlockForm copyId={copy.id} calendar={calendar} />
            </div>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <StatTile label={t.cal.horizon} hint={t.cal.horizonHint}>
                <Stepper value={[30, 60, 90, 180].indexOf(s.horizonDays)} min={0} max={3} format={(i) => t.cal.days([30, 60, 90, 180][i])}
                  onChange={(i) => save({ horizonDays: [30, 60, 90, 180][i] as Settings["horizonDays"] })} label={t.cal.horizonLabel} full />
              </StatTile>
              <StatTile label={t.cal.buffer} hint={t.cal.bufferHint}>
                <Stepper value={s.bufferDays} min={0} max={7} format={(n) => t.cal.dayN(n)} onChange={(v) => save({ bufferDays: v })} label={t.cal.buffer} full />
              </StatTile>
              <StatTile label={t.cal.future} hint={t.cal.futureHint}>
                <Stepper value={s.maxFutureBookings} min={1} max={6} format={(n) => String(n)} onChange={(v) => save({ maxFutureBookings: v })} label={t.cal.future} full />
              </StatTile>
            </div>
          </Section>

          {/* 04 Weitergabe */}
          <Section id="weitergabe" n={4} title={t.pass.title} desc={t.pass.desc}>
            <div role="radiogroup" aria-label={t.pass.title} className="grid sm:grid-cols-3 gap-3">
              {(["never", "on_request", "always"] as const).map((v) => (
                <OptionCard key={v} on={s.passOn === v} title={t.pass[v][0]} desc={t.pass[v][1]} onClick={() => save({ passOn: v })} />
              ))}
            </div>
            <div className={cx("mt-4 rounded-[10px] border border-line px-5 py-4 flex flex-wrap items-center justify-between gap-4 transition-opacity", s.passOn === "never" && "opacity-45 pointer-events-none")} aria-disabled={s.passOn === "never"}>
              <div>
                <p className="font-medium text-[15px]">{t.pass.back}</p>
                <p className="text-[13.5px] text-muted mt-0.5">{t.pass.backHint}</p>
              </div>
              <Stepper value={s.chainMax} min={1} max={4} format={(n) => t.pass.after(n)} onChange={(v) => save({ chainMax: v })} label={t.pass.chain} />
            </div>
          </Section>

          {/* 05 Zustand */}
          <Section id="zustand" n={5} title={t.cond.title} desc={t.cond.desc}>
            <div role="radiogroup" aria-label={t.cond.aria} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((c) => (
                <OptionCard key={c} on={s.condition === c} title={L.conditionLabel[c]} desc={L.conditionHint[c]} compact onClick={() => save({ condition: c })} />
              ))}
            </div>
            <Field label={t.cond.note} hint={<>{t.cond.noteHint[0]}<span className="tnum">{200 - note.length}</span>{t.cond.noteHint[1]}</>} className="mt-8">
              <Textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
                onBlur={() => { const v = note.trim() || null; if (v !== (s.conditionNote ?? null)) save({ conditionNote: v }); }} />
            </Field>
            <Label title={t.cond.photos} hint={copy.cover_key ? t.cond.photosCover : t.cond.photosNoCover} className="mt-8" />
            <Photos copy={copy} />
          </Section>

          {/* 06 Verlauf */}
          <Section id="verlauf" n={6} title={t.hist.title} desc={t.hist.desc} last>
            {history.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-line-strong p-6 text-[14.5px] text-ink-2">
                {t.hist.empty}
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
                          <p className="text-[15px] font-medium truncate group-hover:underline underline-offset-4 decoration-1">{h.borrower_name} <span className="text-muted font-normal">· {L.offerNoun[h.kind]}</span></p>
                          <p className="text-[13px] text-muted tnum truncate mt-0.5">
                            {h.handed_over_at
                              ? `${fmtDay(h.handed_over_at, l)} – ${h.ended_at ? fmtDay(h.ended_at, l) : t.hist.today}${days ? ` · ${t.hist.days(days)}` : ""}`
                              : t.hist.requestedOn(fmtDay(h.requested_at, l))}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
                          <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", tone)} />
                          {h.status === "completed" && h.late ? t.hist.late : h.status === "completed" && h.kind === "lend" ? t.hist.onTime : L.statusLabel[h.status as keyof typeof L.statusLabel] ?? h.status}
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

