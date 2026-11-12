"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { IconArrowRight, IconBell, IconCheck, IconClose, IconSearch, IconSwap } from "@/components/icons";
import { StepSection } from "@/components/step-section";
import { Button, LinkButton, cx } from "@/components/ui";
import { api } from "@/lib/client";
import type { WishRow } from "@/lib/wishlist";
import { fmtDistance } from "@/lib/geo";
import { dayToDate, diffDays, fmtDay, todayCH } from "@/lib/dates";
import { useLocale } from "@/components/locale-provider";
import { WISHLIST } from "@/lib/i18n/messages/wishlist";

export type WishItem = WishRow & {
  cover_key: string | null;
  cover_w: number | null;
  cover_h: number | null;
};
export type Match = { id: string; other_name: string; their_copy: string; their_title: string; my_title: string };

const RADII = [2, 5, 10, 25];

export function WishlistClient({ items: initial, matches }: { items: WishItem[]; matches: Match[] }) {
  const router = useRouter();
  const toast = useToast();
  const t = WISHLIST[useLocale()];
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
      </StepSection>

      {matches.length > 0 && (
        <StepSection id="tauschtreffer" n={++n} title={t.matches} aside={t.nMatches(matches.length)}
          desc={t.matchesDesc}>
          <ul className="grid xl:grid-cols-2 gap-3">
            {matches.map((m, i) => (
              <li key={m.id} className="anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link href={`/exemplar/${m.their_copy}`} className="group rounded-[10px] border border-line p-5 h-full flex flex-col gap-4 hover:border-accent transition-colors">
                  <p className="text-[13px] text-muted flex items-center gap-2">
                    <span aria-hidden className="h-7 w-7 rounded-[6px] bg-accent-soft text-accent-hover grid place-items-center"><IconSwap width={15} height={15} /></span>
                    {t.swapWith(m.other_name)}
                  </p>
                  <dl className="grid grid-cols-2 gap-4">
                    <div><dt className="text-[12.5px] text-muted">{t.youGet}</dt><dd className="font-serif text-[19px] leading-[1.15] mt-1">{m.their_title}</dd></div>
                    <div><dt className="text-[12.5px] text-muted">{t.theirWish(m.other_name)}</dt><dd className="font-serif text-[19px] leading-[1.15] mt-1">{m.my_title}</dd></div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-hover">{t.viewSwap} <IconArrowRight width={15} height={15} className="transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </StepSection>
      )}

      <StepSection id="titel" n={++n} title={t.yourTitles} aside={items.length > 0 ? t.nTitles(items.length) : undefined}
        desc={t.titlesDesc}>
        {items.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-line-strong p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6 anim-rise">
            <div aria-hidden className="flex items-end gap-1.5 flex-none">
              {[0, 1, 2].map((k) => <span key={k} className="block w-[34px] h-[51px] rounded-[3px] border border-dashed border-line-strong" />)}
            </div>
            <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[15px] text-ink-2 max-w-md">{t.empty}</p>
              <LinkButton href="/suche" variant="secondary">{t.browse}</LinkButton>
            </div>
          </div>
        ) : (
          <ul className="grid xl:grid-cols-2 gap-3">
            {items.map((it, i) => <WishCard key={it.work_id} it={it} i={i} onRadius={(r) => setRadius(it, r)} onAlarm={(v) => setAlarm(it, v)} onRemove={() => remove(it)} />)}
          </ul>
        )}
      </StepSection>
    </div>
  );
}

/** Eine Karte pro Wunschtitel: Buch, Verfügbarkeit im Umkreis, nächster Schritt, Umkreis und Titelalarm */
function WishCard({ it, i, onRadius, onAlarm, onRemove }: { it: WishItem; i: number; onRadius: (r: number) => void; onAlarm: (v: boolean) => void; onRemove: () => void }) {
  const free = it.available_near > 0;
  const busy = !free && it.total_near > 0;
  const widen = !free && it.nearest_beyond != null ? RADII.find((r) => r * 1000 >= it.nearest_beyond!) ?? null : null;
  const waitDays = it.next_free ? Math.max(0, diffDays(todayCH(), it.next_free)) : null;
  const cover = { title: it.title, authors: it.authors, coverKey: it.cover_key, seed: it.work_id };
  const l = useLocale();
  const c = WISHLIST[l].card;

  return (
    <li className="anim-rise min-w-0" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
      <article className={cx("h-full rounded-[10px] border p-4 md:p-5 flex flex-col gap-4 transition-colors", free ? "border-ok/40" : "border-line")}>
        {/* Buch */}
        <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4">
          <Link href={`/titel/${it.work_id}`} tabIndex={-1} aria-hidden className="book self-start">
            <span className="book-face block"><Cover l={l} data={cover} width={64} height={96} uniform /></span>
          </Link>
          <div className="min-w-0">
            <p className="text-[12.5px] text-muted flex items-center gap-2 flex-wrap">
              <span>{c.since(fmtDay(it.since, l))}</span>
              {it.alarm && (
                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-[5px] bg-accent-soft text-accent-hover text-[11.5px] font-semibold">
                  <IconBell width={11} height={11} /> {c.alarmOn}
                </span>
              )}
            </p>
            <Link href={`/titel/${it.work_id}`} className="block font-serif text-[19px] md:text-[21px] leading-[1.15] mt-1.5 hover:underline underline-offset-4 decoration-1 line-clamp-2">{it.title}</Link>
            {it.authors.length > 0 && <p className="text-[13.5px] text-muted mt-0.5 truncate">{it.authors.join(", ")}</p>}
          </div>
          <button type="button" onClick={onRemove} aria-label={c.removeAria(it.title)} title={c.remove}
            className="h-9 w-9 -mt-1 -mr-1 rounded-[6px] text-muted hover:text-ink hover:bg-paper-3 grid place-items-center transition-colors">
            <IconClose width={16} height={16} />
          </button>
        </div>

        {/* Verfügbarkeit */}
        <div className={cx("rounded-[8px] px-4 py-3.5", free ? "bg-ok/[0.07]" : "bg-paper-2")}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-end">
            <p className={cx("text-[12px]", free ? "text-ok" : "text-muted")}>
              {free ? c.freeUpTo(it.radius_km) : busy ? (waitDays === 0 ? c.freeAgain : c.freeAgainIn) : c.inRadius(it.radius_km)}
            </p>
            <p className="text-[12px] text-muted text-right">{free ? c.nearest : busy ? c.freeFrom : it.nearest_beyond != null ? c.nextCopy : ""}</p>
            <p className={cx("flex items-baseline gap-1.5 leading-none", free && "text-ok")}>
              {free ? (
                <><span className="text-[30px] font-[560] tracking-[-0.045em] tnum">{it.available_near}</span><span className="text-[15px] font-medium">{c.copies(it.available_near)}</span></>
              ) : busy && waitDays != null ? (
                waitDays === 0 ? <span className="text-[24px] font-[560] tracking-[-0.04em]">{c.today}</span>
                  : <><span className="text-[30px] font-[560] tracking-[-0.045em] tnum">{waitDays}</span><span className="text-[15px] font-medium">{c.days(waitDays)}</span></>
              ) : (
                <span className="text-[20px] font-[560] tracking-[-0.03em] text-ink-2">{busy ? c.taken : c.noCopy}</span>
              )}
            </p>
            <p className="text-[14px] font-medium tnum text-right truncate pb-0.5">
              {free ? <>{fmtDistance(it.free_dist, l)}{it.free_owner && <span className="text-muted font-normal"> · {it.free_owner}</span>}</>
                : busy && it.next_free ? fmtDay(dayToDate(it.next_free), l)
                : it.nearest_beyond != null ? fmtDistance(it.nearest_beyond, l) : ""}
            </p>
          </div>
          <p className="mt-2.5 text-[12.5px] text-muted leading-snug">
            {free
              ? it.total_near > it.available_near ? c.moreLent(it.total_near - it.available_near) : c.askNow
              : busy ? c.allLent(it.total_near, it.radius_km, it.alarm)
              : it.nearest_beyond != null ? c.outside(fmtDistance(it.nearest_beyond, l) ?? "")
              : c.nobody(it.alarm)}
          </p>
          {(free || widen) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {free && it.free_copy && (
                <Link href={`/exemplar/${it.free_copy}`} className="h-9 px-3.5 rounded-[6px] bg-accent text-accent-ink text-[13.5px] font-medium inline-flex items-center gap-1.5 hover:bg-accent-hover transition-colors">
                  {c.request} <IconArrowRight width={15} height={15} />
                </Link>
              )}
              {free && it.available_near > 1 && (
                <Link href={`/titel/${it.work_id}`} className="text-[13.5px] font-medium text-accent-hover hover:underline underline-offset-4">{c.compare(it.available_near)}</Link>
              )}
              {widen && (
                <button type="button" onClick={() => onRadius(widen)} className="h-9 px-3.5 rounded-[6px] bg-accent-soft text-accent-hover text-[13.5px] font-medium hover:bg-accent hover:text-accent-ink transition-colors">
                  {c.widen(widen)}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Einstellungen */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 sm:gap-x-5 gap-y-3">
          <div role="radiogroup" aria-label={c.radiusFor(it.title)} className="inline-flex p-0.5 rounded-[8px] bg-paper-2 border border-line">
            {RADII.map((r) => {
              const on = it.radius_km === r;
              return (
                <button key={r} type="button" role="radio" aria-checked={on} onClick={() => !on && onRadius(r)}
                  className={cx("h-8 px-2 sm:px-2.5 rounded-[6px] text-[12.5px] font-medium tnum whitespace-nowrap transition-colors relative after:absolute after:content-[''] after:-inset-y-1.5",
                    on ? "bg-paper text-accent-hover outline outline-1 outline-accent/50" : "text-ink-2 hover:text-ink")}>
                  {r} km
                </button>
              );
            })}
          </div>
          <button type="button" role="switch" aria-checked={it.alarm} aria-label={c.alarmFor(it.title)} onClick={() => onAlarm(!it.alarm)}
            className="inline-flex items-center gap-2.5 h-9 text-[13.5px] font-medium">
            <span><span className="sm:hidden">{c.alarmShort}</span><span className="hidden sm:inline">{c.alarm}</span></span>
            <span aria-hidden className={cx("relative h-6 w-10 flex-none rounded-full transition-colors duration-200", it.alarm ? "bg-accent" : "bg-paper-3")}>
              <span className={cx("absolute top-1 h-4 w-4 rounded-full bg-paper transition-[left] duration-300 ease-[var(--ease-spring)]", it.alarm ? "left-5" : "left-1")} />
            </span>
          </button>
        </div>
      </article>
    </li>
  );
}

type Edition = { id: string; work_id: string; title: string; authors: string[]; year: number | null; cover_key: string | null; cover_w: number | null; cover_h: number | null };

function AddTitle({ onList, autoFocus }: { onList: Set<string>; autoFocus: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Edition[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const l = useLocale();
  const w = WISHLIST[l];
  const a = w.addTitle;

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const d = await api<{ editions: Edition[] }>(`/catalog/search?q=${encodeURIComponent(needle)}`);
        if (!alive) return;
        const seen = new Set<string>();
        setHits(d.editions.filter((e) => (seen.has(e.work_id) ? false : (seen.add(e.work_id), true))).slice(0, 6));
      } catch {
        if (alive) setHits([]);
      }
    }, 220);
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
      router.refresh();
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
        <input id="wunsch-q" ref={ref} type="search" autoComplete="off" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && hits?.[0] && !onList.has(hits[0].work_id)) { e.preventDefault(); add(hits[0]); } }}
          placeholder={a.placeholder}
          className="w-full h-13 bg-paper border border-line-strong rounded-[8px] pl-12 pr-5 [&::-webkit-search-cancel-button]:appearance-none text-[16px] placeholder:text-muted/80 hover:border-ink-2 focus:outline-none focus:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 transition-colors" />
      </div>
      {hits && (
        <div className="anim-rise mt-2" aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted py-3 px-5">{a.notFound(q.trim())}</p>
          ) : (
            <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
              {hits.map((e) => {
                const on = onList.has(e.work_id);
                return (
                  <li key={e.work_id} className="px-4 md:px-5 py-3 grid grid-cols-[36px_minmax(0,1fr)_auto] gap-4 items-center">
                    <Cover l={l} data={{ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id }} width={36} height={54} uniform />
                    <div className="min-w-0">
                      <div className="font-serif text-[17px] leading-tight truncate">{e.title}</div>
                      <div className="text-sm text-muted truncate">{e.authors.join(", ")}</div>
                    </div>
                    {on ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-ok font-medium"><IconCheck width={15} height={15} />{a.onList}</span>
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
