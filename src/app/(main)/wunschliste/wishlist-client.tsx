"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { IconSearch, IconSwap } from "@/components/icons";
import { Button, LinkButton, Segmented, SectionTitle, Switch, cx } from "@/components/ui";
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

  return (
    <div className="space-y-14 md:space-y-16">
      {matches.length > 0 && (
        <section aria-labelledby="tauschtreffer">
          <SectionTitle aside={<span className="tnum">{matches.length === 1 ? "1 Treffer" : `${matches.length} Treffer`}</span>}>
            <span id="tauschtreffer">Tauschtreffer</span>
          </SectionTitle>
          <ul className="grid md:grid-cols-2 gap-3">
            {matches.map((m, i) => (
              <li key={m.id} className="anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="panel p-5 md:p-6 h-full flex flex-col gap-5 hover:border-ink transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="h-8 w-8 rounded-full bg-ink text-paper grid place-items-center"><IconSwap width={16} height={16} /></span>
                    <p className="eyebrow">Tausch mit {m.other_name}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-4">
                    <div><dt className="text-[13px] text-muted">Du bekommst</dt><dd className="font-serif text-[22px] leading-[1.05] mt-1">{m.their_title}</dd></div>
                    <div><dt className="text-[13px] text-muted">{genitive(m.other_name)} Wunsch</dt><dd className="font-serif text-[22px] leading-[1.05] mt-1">{m.my_title}</dd></div>
                  </dl>
                  <div className="mt-auto"><LinkButton href={`/exemplar/${m.their_copy}`} variant="secondary" size="sm">Tausch ansehen</LinkButton></div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titel">
        <SectionTitle aside={items.length > 0 && <span className="tnum">{items.length === 1 ? "1 Titel" : `${items.length} Titel`}</span>}>
          <span id="titel">Deine Titel</span>
        </SectionTitle>

        <AddTitle onList={new Set(items.map((i) => i.work_id))} autoFocus={items.length === 0} />

        {items.length === 0 ? (
          <div className="mt-6 panel-quiet rounded-[10px] p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6 anim-rise">
            <div aria-hidden className="flex items-end gap-[3px] flex-none">
              <span className="h-[62px] w-[34px] rounded-[3px] border border-dashed border-line-strong" />
              <span className="h-[74px] w-[40px] rounded-[3px] border border-dashed border-line-strong" />
              <span className="h-[56px] w-[30px] rounded-[3px] border border-dashed border-line-strong" />
            </div>
            <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[16px] text-ink-2 max-w-md">Noch leer. Such oben einen Titel, dann melden wir uns, sobald er in deiner Nähe frei wird.</p>
              <LinkButton href="/suche" variant="ghost">Im Bestand stöbern</LinkButton>
            </div>
          </div>
        ) : (
          <ul className="space-y-3 mt-6">
            {items.map((it, i) => (
              <li key={it.work_id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <div className="panel p-5 md:p-6 h-full flex flex-col xl:flex-row xl:items-center gap-5 xl:gap-8 hover:border-line-strong transition-colors">
                  <div className="flex gap-4 md:gap-5 flex-1 min-w-0">
                    <Link href={`/titel/${it.work_id}`} tabIndex={-1} aria-hidden className="book flex-none self-start">
                      <div className="book-face"><Cover data={{ title: it.title, authors: it.authors, coverKey: it.cover_key, seed: it.work_id }} width={68} /></div>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/titel/${it.work_id}`} className="font-serif text-[23px] md:text-[26px] leading-[1.05] hover:underline underline-offset-4 decoration-1 line-clamp-2">{it.title}</Link>
                      {it.authors.length > 0 && <p className="text-[14px] text-muted mt-1 truncate">{it.authors.join(", ")}</p>}
                      <div className="mt-3">
                        {it.available_near > 0 ? (
                          <Link href={`/titel/${it.work_id}`} className="chip !bg-ok/10 !text-ok font-semibold hover:!bg-ok/15 transition-colors">
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
                            <span className="tnum">{it.available_near}</span> jetzt frei in der Nähe
                          </Link>
                        ) : (
                          <span className="chip"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-done" />Bis {it.radius_km} km gerade nichts frei</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 xl:pt-0 border-t xl:border-t-0 border-line flex flex-wrap items-center gap-x-5 gap-y-1 xl:flex-none">
                    <Segmented<number>
                      name={`Umkreis für ${it.title}`}
                      value={it.radius_km}
                      onChange={(r) => setRadius(it, r)}
                      options={RADII.map((r) => ({ value: r, label: <span className="tnum whitespace-nowrap">{r} km</span> }))}
                      className="w-full sm:w-[280px]"
                    />
                    <div className="flex items-center gap-5 flex-1 xl:flex-none justify-between sm:justify-end">
                      <div className="w-[136px]"><Switch checked={it.alarm} onChange={(v) => setAlarm(it, v)} label={<span className="block text-[14px] font-medium leading-[32px]">Titelalarm</span>} /></div>
                      <Button variant="quiet" className="text-sm" onClick={() => remove(it)} aria-label={`«${it.title}» entfernen`}>Entfernen</Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
        <span aria-hidden className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-2 pointer-events-none"><IconSearch /></span>
        <input id="wunsch-q" ref={ref} type="search" autoComplete="off" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && hits?.[0] && !onList.has(hits[0].work_id)) { e.preventDefault(); add(hits[0]); } }}
          placeholder="Titel hinzufügen: Titel oder Autorin"
          className="w-full h-14 bg-paper border border-line-strong rounded-[6px] pl-13 pr-5 [&::-webkit-search-cancel-button]:appearance-none text-[17px] placeholder:text-muted/80 hover:border-ink-2 focus:outline-none focus:border-ink focus:ring-[4px] focus:ring-ink/10 transition-[border-color,box-shadow]" />
      </div>
      {hits && (
        <div className="anim-rise mt-2" aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted py-3 px-5">Im Katalog finden wir «{q.trim()}» nicht. Prüfe die Schreibweise.</p>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {hits.map((e) => {
                const on = onList.has(e.work_id);
                return (
                  <li key={e.work_id} className="px-4 md:px-5 py-3 grid grid-cols-[36px_minmax(0,1fr)_auto] gap-4 items-center">
                    <Cover data={{ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id }} width={36} />
                    <div className="min-w-0">
                      <div className="font-serif text-[19px] leading-tight truncate">{e.title}</div>
                      <div className="text-sm text-muted truncate">{e.authors.join(", ")}</div>
                    </div>
                    {on ? (
                      <span className="chip"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />Auf der Liste</span>
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
      <p className={cx("text-[13px] text-muted mt-2.5 px-5", hits && "hidden")}>Neue Titel starten mit einem Umkreis von 5 km und eingeschaltetem Titelalarm.</p>
    </div>
  );
}
