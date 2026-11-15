"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { IconArrowRight, IconBell, IconCheck, IconClose, IconScan, IconSearch, IconSwap } from "@/components/icons";
import { Modal, ModalClose } from "@/components/modal";
import { Scanner } from "@/components/scanner";
import { StepSection } from "@/components/step-section";
import { Button, LinkButton, cx } from "@/components/ui";
import { api } from "@/lib/client";
import type { CircleHit, WishRow } from "@/lib/wishlist";
import { COMMUNITY } from "@/lib/i18n/messages/community";
import { fmtDistance } from "@/lib/geo";
import { dayToDate, diffDays, fmtDay, todayCH } from "@/lib/dates";
import { useLocale } from "@/components/locale-provider";
import { WISHLIST } from "@/lib/i18n/messages/wishlist";

export type WishItem = WishRow & {
  cover_key: string | null;
  cover_w: number | null;
  cover_h: number | null;
  /** Exemplar dieses Titels im Regal eines meiner Kreise */
  circle_hit?: CircleHit | null;
};
export type Match = { id: string; other_name: string; their_copy: string; their_title: string; my_title: string };

const RADII = [2, 5, 10, 25];

export function WishlistClient({ items: initial, matches, sms = "on" }: { items: WishItem[]; matches: Match[]; sms?: "on" | "off" | "no_phone" }) {
  const router = useRouter();
  const toast = useToast();
  const t = WISHLIST[useLocale()];
  const tc = COMMUNITY[useLocale()].wish;
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);

  const patch = (workId: string, p: Partial<WishItem>) => setItems((all) => all.map((i) => (i.work_id === workId ? { ...i, ...p } : i)));

  async function setRadius(it: WishItem, r: number) {
    patch(it.work_id, { radius_km: r });
    try {
      await api("/wishlist", { method: "PATCH", body: { workId: it.work_id, radiusKm: r } });
      router.refresh();
    } catch (e) {
      patch(it.work_id, { radius_km: it.radius_km });
      toast.error((e as Error).message);
    }
  }

  async function setAlarm(it: WishItem, on: boolean) {
    patch(it.work_id, { alarm: on });
    try {
      await api("/wishlist", { method: "PATCH", body: { workId: it.work_id, alarm: on } });
      toast.show({ text: on ? t.alarmOn(it.title) : t.alarmOff(it.title) }, 3000);
    } catch (e) {
      patch(it.work_id, { alarm: it.alarm });
      toast.error((e as Error).message);
    }
  }

  /** Wunsch in den eigenen Kreisen als «gesucht» zeigen (Brett auf der Kreisseite, Hinweis beim Besitzer) */
  async function setShare(it: WishItem, on: boolean) {
    patch(it.work_id, { share_circles: on });
    try {
      await api("/wishlist", { method: "PATCH", body: { workId: it.work_id, shareCircles: on } });
      toast.show({ text: on ? tc.shareOn(it.title) : tc.shareOff(it.title) }, 3000);
    } catch (e) {
      patch(it.work_id, { share_circles: it.share_circles });
      toast.error((e as Error).message);
    }
  }

  async function remove(it: WishItem) {
    setItems((all) => all.filter((i) => i.work_id !== it.work_id));
    try {
      await api(`/wishlist?work=${it.work_id}`, { method: "DELETE" });
      toast.show({
        text: t.removed(it.title),
        undo: async () => {
          try {
            await api("/wishlist", { body: { workId: it.work_id, radiusKm: it.radius_km } });
            if (!it.alarm) await api("/wishlist", { method: "PATCH", body: { workId: it.work_id, alarm: false } });
          } catch (e) {
            toast.error((e as Error).message);
          }
          router.refresh();
        },
      });
      router.refresh();
    } catch (e) {
      setItems(initial);
      toast.error((e as Error).message);
    }
  }

  let n = 0;
  return (
    <div>
      <StepSection id="hinzufuegen" n={++n} first title={t.add} desc={t.addDesc}>
        <AddTitle onList={new Set(items.map((i) => i.work_id))} autoFocus={items.length === 0} />
        {/* Titelalarm per SMS: was passiert, wenn ein Wunschbuch frei wird */}
        {sms === "on" && <p className="text-meta text-muted mt-3 flex items-start gap-2"><IconBell width={14} height={14} className="mt-0.5 flex-none" aria-hidden />{t.addTitle.smsHint}</p>}
        {sms === "no_phone" && (
          <p className="text-meta text-muted mt-3 flex items-start gap-2"><IconBell width={14} height={14} className="mt-0.5 flex-none" aria-hidden />
            <span>{t.addTitle.smsNoPhone[0]}<Link href="/einstellungen#mobilnummer" className="text-ink-2 underline underline-offset-4">{t.addTitle.smsNoPhone[1]}</Link>{t.addTitle.smsNoPhone[2]}</span>
          </p>
        )}
      </StepSection>

      {matches.length > 0 && (
        <StepSection id="tauschtreffer" n={++n} title={t.matches} aside={t.nMatches(matches.length)}
          desc={t.matchesDesc}>
          <ul className="grid xl:grid-cols-2 gap-3">
            {matches.map((m, i) => (
              <li key={m.id}>
                <Link href={`/exemplar/${m.their_copy}`} className="press-card group rounded-md border border-line p-5 h-full flex flex-col gap-4 hover:border-accent">
                  <p className="text-meta text-muted flex items-center gap-2">
                    <span aria-hidden className="h-7 w-7 rounded-sm bg-accent-soft text-accent-hover grid place-items-center"><IconSwap width={15} height={15} /></span>
                    {t.swapWith(m.other_name)}
                  </p>
                  <dl className="grid grid-cols-2 gap-4">
                    <div><dt className="text-meta text-muted">{t.youGet}</dt><dd className="font-serif text-title-sm leading-title mt-1">{m.their_title}</dd></div>
                    <div><dt className="text-meta text-muted">{t.theirWish(m.other_name)}</dt><dd className="font-serif text-title-sm leading-title mt-1">{m.my_title}</dd></div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-hover">{t.viewSwap} <IconArrowRight width={15} height={15} className="transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </StepSection>
      )}

      <StepSection id="titel" n={++n} title={t.yourTitles} aside={items.length > 0 ? t.nTitles(items.length) : undefined}
        desc={t.titlesDesc}>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6 anim-rise">
            <div aria-hidden className="flex items-end gap-1.5 flex-none">
              {[0, 1, 2].map((k) => <span key={k} className="block w-[34px] h-[51px] rounded-xs border border-dashed border-line-strong" />)}
            </div>
            <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
              <p className="text-body text-ink-2 max-w-md">{t.empty}</p>
              <LinkButton href="/suche" variant="secondary">{t.browse}</LinkButton>
            </div>
          </div>
        ) : (
          <ul className="grid xl:grid-cols-2 gap-3">
            {items.map((it, i) => <WishCard key={it.work_id} it={it} i={i} onRadius={(r) => setRadius(it, r)} onAlarm={(v) => setAlarm(it, v)} onShare={(v) => setShare(it, v)} onRemove={() => remove(it)} />)}
          </ul>
        )}
        {items.length > 0 && <p className="text-meta text-muted mt-4 max-w-2xl">{tc.shareHint}</p>}
      </StepSection>
    </div>
  );
}

/** Eine Karte pro Wunschtitel: Buch, Verfügbarkeit im Umkreis, nächster Schritt, Umkreis und Titelalarm */
function WishCard({ it, i, onRadius, onAlarm, onShare, onRemove }: { it: WishItem; i: number; onRadius: (r: number) => void; onAlarm: (v: boolean) => void; onShare: (v: boolean) => void; onRemove: () => void }) {
  const free = it.available_near > 0;
  const busy = !free && it.total_near > 0;
  const widen = !free && it.nearest_beyond != null ? RADII.find((r) => r * 1000 >= it.nearest_beyond!) ?? null : null;
  const waitDays = it.next_free ? Math.max(0, diffDays(todayCH(), it.next_free)) : null;
  const cover = { title: it.title, authors: it.authors, coverKey: it.cover_key, seed: it.work_id };
  const l = useLocale();
  const c = WISHLIST[l].card;
  const tc = COMMUNITY[l].wish;
  const hit = it.circle_hit;

  return (
    <li className="min-w-0">
      <article className={cx("h-full rounded-md border p-4 md:p-5 flex flex-col gap-4 transition-colors", free ? "border-ok/40" : "border-line")}>
        {/* Buch */}
        <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4">
          <Link href={`/titel/${it.work_id}`} tabIndex={-1} aria-hidden className="book self-start">
            <span className="book-face block"><Cover l={l} data={cover} width={64} height={96} uniform /></span>
          </Link>
          <div className="min-w-0">
            <p className="text-meta text-muted flex items-center gap-2 flex-wrap">
              <span>{c.since(fmtDay(it.since, l))}</span>
              {it.alarm && (
                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-sm bg-accent-soft text-accent-hover text-caption font-semibold">
                  <IconBell width={11} height={11} /> {c.alarmOn}
                </span>
              )}
            </p>
            <Link href={`/titel/${it.work_id}`} className="block font-serif text-title-sm leading-title mt-1.5 hover:underline underline-offset-4 decoration-1 line-clamp-2">{it.title}</Link>
            {it.authors.length > 0 && <p className="text-body-sm text-muted mt-0.5 truncate">{it.authors.join(", ")}</p>}
          </div>
          <button type="button" onClick={onRemove} aria-label={c.removeAria(it.title)} title={c.remove}
            className="h-9 w-9 -mt-1 -mr-1 rounded-sm text-muted hover:text-ink hover:bg-paper-3 grid place-items-center transition-colors">
            <IconClose width={16} height={16} />
          </button>
        </div>

        {/* Verfügbarkeit */}
        <div className={cx("rounded-md px-4 py-3.5", free ? "bg-ok/[0.07]" : "bg-paper-2")}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-end">
            <p className={cx("text-caption", free ? "text-ok" : "text-muted")}>
              {free ? c.freeUpTo(it.radius_km) : busy ? (waitDays === 0 ? c.freeAgain : c.freeAgainIn) : c.inRadius(it.radius_km)}
            </p>
            <p className="text-caption text-muted text-right">{free ? c.nearest : busy ? c.freeFrom : it.nearest_beyond != null ? c.nextCopy : ""}</p>
            <p className={cx("flex items-baseline gap-1.5 leading-none", free && "text-ok")}>
              {free ? (
                <><span className="text-title font-title tracking-display tnum">{it.available_near}</span><span className="text-body font-medium">{c.copies(it.available_near)}</span></>
              ) : busy && waitDays != null ? (
                waitDays === 0 ? <span className="text-title font-title tracking-display">{c.today}</span>
                  : <><span className="text-title font-title tracking-display tnum">{waitDays}</span><span className="text-body font-medium">{c.days(waitDays)}</span></>
              ) : (
                <span className="text-title-sm font-title tracking-title text-ink-2">{busy ? c.taken : c.noCopy}</span>
              )}
            </p>
            <p className="text-body-sm font-medium tnum text-right truncate pb-0.5">
              {free ? <>{fmtDistance(it.free_dist, l)}{it.free_owner && <span className="text-muted font-normal"> · {it.free_owner}</span>}</>
                : busy && it.next_free ? fmtDay(dayToDate(it.next_free), l)
                : it.nearest_beyond != null ? fmtDistance(it.nearest_beyond, l) : ""}
            </p>
          </div>
          <p className="mt-2.5 text-meta text-muted leading-snug">
            {free
              ? it.total_near > it.available_near ? c.moreLent(it.total_near - it.available_near) : c.askNow
              : busy ? c.allLent(it.total_near, it.radius_km, it.alarm)
              : it.nearest_beyond != null ? c.outside(fmtDistance(it.nearest_beyond, l) ?? "")
              : c.nobody(it.alarm)}
          </p>
          {(free || widen) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {free && it.free_copy && (
                <Link href={`/exemplar/${it.free_copy}`} className="h-9 px-3.5 rounded-sm bg-accent text-accent-ink text-body-sm font-medium inline-flex items-center gap-1.5 hover:bg-accent-hover transition-colors">
                  {c.request} <IconArrowRight width={15} height={15} />
                </Link>
              )}
              {free && it.available_near > 1 && (
                <Link href={`/titel/${it.work_id}`} className="text-body-sm font-medium text-accent-hover hover:underline underline-offset-4">{c.compare(it.available_near)}</Link>
              )}
              {widen && (
                <button type="button" onClick={() => onRadius(widen)} className="h-9 px-3.5 rounded-sm bg-accent-soft text-accent-hover text-body-sm font-medium hover:bg-accent hover:text-accent-ink transition-colors">
                  {c.widen(widen)}
                </button>
              )}
            </div>
          )}
        </div>

        {hit && (
          <p className="text-body-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", hit.free_now ? "bg-ok" : "bg-lent")} />
            <span className="font-medium">{tc.inCircle(hit.circle_name)}</span>
            <span className="text-muted">{hit.free_now ? tc.freeNow : hit.free_from ? tc.freeFrom(fmtDay(dayToDate(hit.free_from), l)) : tc.taken}</span>
            <Link href={`/exemplar/${hit.copy_id}`} className="font-medium text-accent-hover underline underline-offset-4 min-h-11 md:min-h-0 inline-flex items-center">{tc.view}</Link>
          </p>
        )}

        {/* Einstellungen */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 sm:gap-x-5 gap-y-3">
          <div role="radiogroup" aria-label={c.radiusFor(it.title)} className="inline-flex p-0.5 rounded-md bg-paper-2 border border-line">
            {RADII.map((r) => {
              const on = it.radius_km === r;
              return (
                <button key={r} type="button" role="radio" aria-checked={on} onClick={() => !on && onRadius(r)}
                  className={cx("h-8 px-2 sm:px-2.5 rounded-sm text-meta font-medium tnum whitespace-nowrap transition-colors relative after:absolute after:content-[''] after:-inset-y-1.5",
                    on ? "bg-paper text-accent-hover outline outline-1 outline-accent/50" : "text-ink-2 hover:text-ink")}>
                  {r} km
                </button>
              );
            })}
          </div>
          <button type="button" role="switch" aria-checked={it.alarm} aria-label={c.alarmFor(it.title)} onClick={() => onAlarm(!it.alarm)}
            className="inline-flex items-center gap-2.5 h-9 text-body-sm font-medium">
            <span><span className="sm:hidden">{c.alarmShort}</span><span className="hidden sm:inline">{c.alarm}</span></span>
            <span aria-hidden className={cx("relative h-6 w-10 flex-none rounded-full transition-colors duration-fast", it.alarm ? "bg-accent" : "bg-field")}>
              <span className={cx("absolute top-1 left-1 h-4 w-4 rounded-full bg-paper transition-transform duration-base ease-spring", it.alarm && "translate-x-4")} />
            </span>
          </button>
          <button type="button" role="switch" aria-checked={it.share_circles} aria-label={tc.shareFor(it.title)} onClick={() => onShare(!it.share_circles)}
            className="inline-flex items-center gap-2.5 h-9 text-body-sm font-medium">
            <span>{tc.share}</span>
            <span aria-hidden className={cx("relative h-6 w-10 flex-none rounded-full transition-colors duration-fast", it.share_circles ? "bg-accent" : "bg-field")}>
              <span className={cx("absolute top-1 left-1 h-4 w-4 rounded-full bg-paper transition-transform duration-base ease-spring", it.share_circles && "translate-x-4")} />
            </span>
          </button>
        </div>
      </article>
    </li>
  );
}

type Edition = { id: string; work_id: string; title: string; authors: string[]; year: number | null; cover_key: string | null; cover_color?: string | null; cover_w: number | null; cover_h: number | null };

/** ISBN-10/-13 mit Bindestrichen oder Leerzeichen erkennen (Prüfziffer prüft der Server) */
const ISBN_LIKE = /^(97[89][\s-]?)?\d[\d\s-]{7,15}[\dXx]$/;
const isbnDigits = (q: string) => q.replace(/[^0-9Xx]/g, "").toUpperCase();
const looksLikeIsbn = (q: string) => ISBN_LIKE.test(q.trim()) && [10, 13].includes(isbnDigits(q).length);

function AddTitle({ onList, autoFocus }: { onList: Set<string>; autoFocus: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Edition[] | null>(null);
  const [isbnState, setIsbnState] = useState<null | "looking" | "invalid" | "none" | "found">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const l = useLocale();
  const w = WISHLIST[l];
  const a = w.addTitle;

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits(null);
      setIsbnState(null);
      return;
    }
    let alive = true;
    const isbn = looksLikeIsbn(needle);
    if (isbn) setIsbnState("looking");
    else setIsbnState(null);
    const t = setTimeout(async () => {
      try {
        if (isbn) {
          // ISBN: eigene Datenbank, dann DNB, Open Library, Google Books – das Cover lädt der Worker nach
          const d = await api<{ edition: Edition | null }>(`/catalog/isbn/${isbnDigits(needle)}`);
          if (!alive) return;
          setHits(d.edition ? [d.edition] : []);
          setIsbnState(d.edition ? "found" : "none");
          return;
        }
        const d = await api<{ editions: Edition[] }>(`/catalog/search?q=${encodeURIComponent(needle)}`);
        if (!alive) return;
        const seen = new Set<string>();
        setHits(d.editions.filter((e) => (seen.has(e.work_id) ? false : (seen.add(e.work_id), true))).slice(0, 6));
      } catch (e) {
        if (!alive) return;
        setHits([]);
        if (isbn) setIsbnState((e as { code?: string }).code === "invalid" ? "invalid" : "none");
      }
    }, isbn ? 320 : 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  async function add(e: Edition) {
    setBusy(e.work_id);
    try {
      await api("/wishlist", { body: { workId: e.work_id } });
      toast.show({ text: a.added(e.title) });
      setQ("");
      setHits(null);
      setIsbnState(null);
      router.refresh();
      // Das Original-Cover holt der Worker im Hintergrund; danach die Liste noch einmal auffrischen
      if (!e.cover_key) window.setTimeout(() => router.refresh(), 6000);
      ref.current?.focus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <label htmlFor="wunsch-q" className="sr-only">{w.add}</label>
      <div className="relative">
        <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch width={19} height={19} /></span>
        <button type="button" onClick={() => setScanning(true)} aria-label={a.scan} title={a.scan}
          className="press absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-sm text-ink-2 hover:bg-paper-2 hover:text-ink">
          <IconScan width={20} height={20} />
        </button>
        <input id="wunsch-q" ref={ref} type="search" autoComplete="off" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && hits?.[0] && !onList.has(hits[0].work_id)) { e.preventDefault(); add(hits[0]); } }}
          placeholder={a.placeholderIsbn} inputMode="search"
          className="w-full h-13 bg-paper border border-field rounded-md pl-12 pr-14 [&::-webkit-search-cancel-button]:appearance-none text-body-lg placeholder:text-muted hover:border-ink-2 focus:outline-none focus:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 transition-colors" />
      </div>
      {scanning && (
        <Modal label={a.scanTitle} onClose={() => setScanning(false)} className="surface-night flex flex-col">
          <div className="flex items-center justify-between px-5 md:px-8 h-16 flex-none">
            <span className="text-meta font-medium text-night-muted">{a.scanTitle}</span>
            <ModalClose className="press h-11 w-11 -mr-2 grid place-items-center rounded-md hover:bg-night-2" label={a.close}><IconClose width={24} height={24} /></ModalClose>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-8 max-w-lg w-full mx-auto">
            <p className="text-body text-night-muted">{a.scanHint}</p>
            <Scanner mode="isbn" fallbackHint={a.scanFallback} className="mt-6 !rounded-md !border-night-line"
              onResult={(code) => { setScanning(false); setQ(code); ref.current?.focus(); }} />
          </div>
        </Modal>
      )}
      {isbnState === "looking" && <p className="text-body-sm text-muted mt-2 px-5" aria-live="polite">{a.isbnLooking}</p>}
      {isbnState === "invalid" && <p className="text-body-sm text-late mt-2 px-5" role="alert">{a.isbnInvalid}</p>}
      {hits && isbnState !== "looking" && isbnState !== "invalid" && (
        <div className="anim-rise mt-2" aria-live="polite">
          {isbnState === "found" && <p className="eyebrow mb-2 px-1">{a.isbnFound}</p>}
          {hits.length === 0 ? (
            <p className="text-body-sm text-muted py-3 px-5">{isbnState === "none" ? a.isbnNotFound(isbnDigits(q)) : a.notFound(q.trim())}</p>
          ) : (
            <ul className="rounded-md border border-line divide-y divide-line overflow-hidden">
              {hits.map((e) => {
                const on = onList.has(e.work_id);
                return (
                  <li key={e.work_id} className="px-4 md:px-5 py-3 grid grid-cols-[36px_minmax(0,1fr)_auto] gap-4 items-center">
                    <Cover l={l} data={{ title: e.title, authors: e.authors, coverKey: e.cover_key, coverColor: e.cover_color, seed: e.work_id }} width={36} height={54} uniform />
                    <div className="min-w-0">
                      <div className="font-serif text-lead leading-tight truncate">{e.title}</div>
                      <div className="text-body-sm text-muted truncate">{e.authors.join(", ")}</div>
                    </div>
                    {on ? (
                      <span className="inline-flex items-center gap-1.5 text-meta text-ok font-medium"><IconCheck width={15} height={15} />{a.onList}</span>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={busy === e.work_id} onClick={() => add(e)}>{a.add}</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
