"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { IconSearch } from "@/components/icons";
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
    <div className="space-y-14">
      {matches.length > 0 && (
        <section aria-labelledby="tauschtreffer">
          <SectionTitle><span id="tauschtreffer">Tauschtreffer</span></SectionTitle>
          <ul className="divide-y divide-line border-b border-line">
            {matches.map((m) => (
              <li key={m.id} className="py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <p className="max-w-2xl text-[16px] leading-relaxed">
                  {m.other_name} hat <span className="font-serif text-lg">{m.their_title}</span> von deiner Wunschliste,
                  und du hast <span className="font-serif text-lg">{m.my_title}</span> von {genitive(m.other_name)} Liste.
                </p>
                <LinkButton href={`/exemplar/${m.their_copy}`} variant="secondary" size="sm">Tausch ansehen</LinkButton>
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
          <p className="text-ink-2 py-8 border-b border-line">Deine Wunschliste ist leer. Such oben einen Titel, dann melden wir uns, sobald er in deiner Nähe frei wird.</p>
        ) : (
          <ul className="divide-y divide-line border-b border-line mt-6">
            {items.map((it) => (
              <li key={it.work_id} className="py-5 grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 lg:grid-cols-[56px_minmax(0,1fr)_auto] lg:gap-x-8 items-start">
                <Link href={`/titel/${it.work_id}`} tabIndex={-1} aria-hidden>
                  <Cover data={{ title: it.title, authors: it.authors, coverKey: it.cover_key, seed: it.work_id }} width={56} />
                </Link>
                <div className="min-w-0">
                  <Link href={`/titel/${it.work_id}`} className="font-serif text-xl leading-tight hover:underline line-clamp-2">{it.title}</Link>
                  {it.authors.length > 0 && <div className="text-sm text-muted mt-0.5 truncate">{it.authors.join(", ")}</div>}
                  <div className="mt-2 text-[15px]">
                    {it.available_near > 0 ? (
                      <Link href={`/titel/${it.work_id}`} className="text-ok font-medium hover:underline underline-offset-4">
                        Jetzt verfügbar in der Nähe: <span className="tnum">{it.available_near}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">Im Umkreis von {it.radius_km} km gerade nichts frei</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 lg:col-span-1 mt-4 lg:mt-0 flex flex-wrap items-center gap-x-6 gap-y-1">
                  <Segmented<number>
                    name={`Umkreis für ${it.title}`}
                    value={it.radius_km}
                    onChange={(r) => setRadius(it, r)}
                    options={RADII.map((r) => ({ value: r, label: <span className="tnum">{r} km</span> }))}
                    className="w-full sm:w-64"
                  />
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between">
                    <div className="w-36"><Switch checked={it.alarm} onChange={(v) => setAlarm(it, v)} label="Titelalarm" /></div>
                    <Button variant="quiet" className="text-sm" onClick={() => remove(it)} aria-label={`«${it.title}» entfernen`}>Entfernen</Button>
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
      <label htmlFor="wunsch-q" className="block text-sm font-medium mb-1.5">Titel hinzufügen</label>
      <div className="relative">
        <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><IconSearch /></span>
        <input id="wunsch-q" ref={ref} type="search" autoComplete="off" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && hits?.[0] && !onList.has(hits[0].work_id)) { e.preventDefault(); add(hits[0]); } }}
          placeholder="Titel oder Autorin"
          className="w-full h-11 bg-transparent border border-line-strong rounded-sm pl-10 pr-3 [&::-webkit-search-cancel-button]:appearance-none text-[16px] placeholder:text-muted/70 focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink" />
      </div>
      {hits && (
        <div className="anim-rise" aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted py-3">Im Katalog finden wir «{q.trim()}» nicht. Prüfe die Schreibweise.</p>
          ) : (
            <ul className="divide-y divide-line border-b border-line">
              {hits.map((e) => {
                const on = onList.has(e.work_id);
                return (
                  <li key={e.work_id} className="py-2.5 grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 items-center">
                    <Cover data={{ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id }} width={32} />
                    <div className="min-w-0">
                      <div className="font-serif text-[17px] leading-tight truncate">{e.title}</div>
                      <div className="text-sm text-muted truncate">{e.authors.join(", ")}</div>
                    </div>
                    {on ? (
                      <span className="text-sm text-muted">Schon auf der Liste</span>
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
      <p className={cx("text-xs text-muted mt-2", hits && "hidden")}>Neue Titel starten mit einem Umkreis von 5 km und eingeschaltetem Titelalarm.</p>
    </div>
  );
}
