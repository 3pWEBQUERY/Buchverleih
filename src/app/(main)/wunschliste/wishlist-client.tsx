"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { IconArrowRight, IconCheck, IconSearch, IconSwap } from "@/components/icons";
import { StepSection } from "@/components/step-section";
import { Button, LinkButton, Switch, cx } from "@/components/ui";
import { api } from "@/lib/client";

export type WishItem = {
  work_id: string;
  title: string;
  authors: string[];
  radius_km: number;
  alarm: boolean;
  available_near: number;
  cover_key: string | null;
  cover_w: number | null;
  cover_h: number | null;
};
export type Match = { id: string; other_name: string; their_copy: string; their_title: string; my_title: string };

const RADII = [2, 5, 10, 25];

/** «Jonas’», «Leas» */
function genitive(name: string) {
  return /[sßxz]$/i.test(name) ? `${name}’` : `${name}s`;
}

export function WishlistClient({ items: initial, matches }: { items: WishItem[]; matches: Match[] }) {
  const router = useRouter();
  const toast = useToast();
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
      toast.show({ text: on ? `Titelalarm für «${it.title}» an.` : `Titelalarm für «${it.title}» aus.` }, 3000);
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
        text: `«${it.title}» entfernt.`,
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
      <StepSection id="hinzufuegen" n={++n} first title="Titel hinzufügen" desc="Such im Katalog nach Titel, Autorin oder Autor. Neue Titel starten mit 5 km Umkreis und eingeschaltetem Titelalarm.">
        <AddTitle onList={new Set(items.map((i) => i.work_id))} autoFocus={items.length === 0} />
      </StepSection>

      {matches.length > 0 && (
        <StepSection id="tauschtreffer" n={++n} title="Tauschtreffer" aside={matches.length === 1 ? "1 Treffer" : `${matches.length} Treffer`}
          desc="Jemand hat, was du suchst, und sucht etwas, das du hast. Ein Tausch ohne Wertausgleich.">
          <ul className="grid xl:grid-cols-2 gap-3">
            {matches.map((m, i) => (
              <li key={m.id} className="anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link href={`/exemplar/${m.their_copy}`} className="group rounded-[10px] border border-line p-5 h-full flex flex-col gap-4 hover:border-accent transition-colors">
                  <p className="text-[13px] text-muted flex items-center gap-2">
                    <span aria-hidden className="h-7 w-7 rounded-[6px] bg-accent-soft text-accent-hover grid place-items-center"><IconSwap width={15} height={15} /></span>
                    Tausch mit {m.other_name}
                  </p>
                  <dl className="grid grid-cols-2 gap-4">
                    <div><dt className="text-[12.5px] text-muted">Du bekommst</dt><dd className="font-serif text-[19px] leading-[1.15] mt-1">{m.their_title}</dd></div>
                    <div><dt className="text-[12.5px] text-muted">{genitive(m.other_name)} Wunsch</dt><dd className="font-serif text-[19px] leading-[1.15] mt-1">{m.my_title}</dd></div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-hover">Tausch ansehen <IconArrowRight width={15} height={15} className="transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </StepSection>
      )}

      <StepSection id="titel" n={++n} title="Deine Titel" aside={items.length > 0 ? (items.length === 1 ? "1 Titel" : `${items.length} Titel`) : undefined}
        desc="Pro Titel bestimmst du den Umkreis und ob wir uns melden, sobald ein Exemplar frei wird.">
        {items.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-line-strong p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6 anim-rise">
            <div aria-hidden className="flex items-end gap-1.5 flex-none">
              {[0, 1, 2].map((k) => <span key={k} className="block w-[34px] h-[51px] rounded-[3px] border border-dashed border-line-strong" />)}
            </div>
            <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[15px] text-ink-2 max-w-md">Noch leer. Such oben einen Titel, dann melden wir uns, sobald er in deiner Nähe frei wird.</p>
              <LinkButton href="/suche" variant="secondary">Im Bestand stöbern</LinkButton>
            </div>
          </div>
        ) : (
          <ul className="rounded-[10px] border border-line divide-y divide-line">
            {items.map((it, i) => (
              <li key={it.work_id} className="anim-rise px-4 md:px-5 py-4" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <div className="grid grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[64px_minmax(0,1fr)] gap-4 md:gap-5">
                  <Link href={`/titel/${it.work_id}`} tabIndex={-1} aria-hidden className="book self-start">
                    <span className="book-face block md:hidden"><Cover data={{ title: it.title, authors: it.authors, coverKey: it.cover_key, seed: it.work_id }} width={56} height={84} uniform /></span>
                    <span className="book-face hidden md:block"><Cover data={{ title: it.title, authors: it.authors, coverKey: it.cover_key, seed: it.work_id }} width={64} height={96} uniform /></span>
                  </Link>
                  <div className="min-w-0 flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-8">
                    <div className="min-w-0 flex-1">
                      <Link href={`/titel/${it.work_id}`} className="font-serif text-[19px] md:text-[21px] leading-[1.15] hover:underline underline-offset-4 decoration-1 line-clamp-2">{it.title}</Link>
                      {it.authors.length > 0 && <p className="text-[13.5px] text-muted mt-0.5 truncate">{it.authors.join(", ")}</p>}
                      <p className="mt-2.5 text-[13px] flex items-center gap-1.5">
                        {it.available_near > 0 ? (
                          <Link href={`/titel/${it.work_id}`} className="inline-flex items-center gap-1.5 font-medium text-ok hover:underline underline-offset-4">
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
                            <span className="tnum">{it.available_near}</span> jetzt frei in der Nähe <IconArrowRight width={13} height={13} />
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-done" />Bis {it.radius_km} km gerade nichts frei</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 xl:flex-none">
                      <div role="radiogroup" aria-label={`Umkreis für ${it.title}`} className="flex gap-1">
                        {RADII.map((r) => {
                          const on = it.radius_km === r;
                          return (
                            <button key={r} type="button" role="radio" aria-checked={on} onClick={() => !on && setRadius(it, r)}
                              className={cx("h-9 px-3 rounded-[6px] border text-[13px] font-medium tnum whitespace-nowrap transition-colors",
                                on ? "border-accent bg-accent-soft/40 text-accent-hover" : "border-line text-ink-2 hover:border-ink-2")}>
                              {r} km
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-[132px]"><Switch checked={it.alarm} onChange={(v) => setAlarm(it, v)} label={<span className="block text-[13.5px] font-medium leading-[32px]">Titelalarm</span>} /></div>
                        <Button variant="quiet" className="text-[13.5px]" onClick={() => remove(it)} aria-label={`«${it.title}» entfernen`}>Entfernen</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </StepSection>
    </div>
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
      toast.show({ text: `«${e.title}» ist auf der Wunschliste. Titelalarm an.` });
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
      <label htmlFor="wunsch-q" className="sr-only">Titel hinzufügen</label>
      <div className="relative">
        <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch width={19} height={19} /></span>
        <input id="wunsch-q" ref={ref} type="search" autoComplete="off" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && hits?.[0] && !onList.has(hits[0].work_id)) { e.preventDefault(); add(hits[0]); } }}
          placeholder="Titel hinzufügen: Titel oder Autorin"
          className="w-full h-13 bg-paper border border-line-strong rounded-[8px] pl-12 pr-5 [&::-webkit-search-cancel-button]:appearance-none text-[16px] placeholder:text-muted/80 hover:border-ink-2 focus:outline-none focus:border-accent transition-colors" />
      </div>
      {hits && (
        <div className="anim-rise mt-2" aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted py-3 px-5">Im Katalog finden wir «{q.trim()}» nicht. Prüfe die Schreibweise.</p>
          ) : (
            <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
              {hits.map((e) => {
                const on = onList.has(e.work_id);
                return (
                  <li key={e.work_id} className="px-4 md:px-5 py-3 grid grid-cols-[36px_minmax(0,1fr)_auto] gap-4 items-center">
                    <Cover data={{ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id }} width={36} height={54} uniform />
                    <div className="min-w-0">
                      <div className="font-serif text-[17px] leading-tight truncate">{e.title}</div>
                      <div className="text-sm text-muted truncate">{e.authors.join(", ")}</div>
                    </div>
                    {on ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-ok font-medium"><IconCheck width={15} height={15} />Auf der Liste</span>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={busy === e.work_id} onClick={() => add(e)}>Hinzufügen</Button>
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
