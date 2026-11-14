"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { PostKind } from "@/lib/pinboard";
import { api } from "@/lib/client";
import { todayCH } from "@/lib/dates";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { Cover } from "@/components/cover";
import { IconCheck, IconSearch } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { Button, Field, Input, Notice, Segmented, Textarea, cx } from "@/components/ui";
import { Counter, TAP, errText, type Post } from "./pin-post";

export type OwnCopy = { id: string; work_id: string; title: string; authors: string[]; cover_key: string | null; photo_key: string | null; photo_w: number | null; photo_h: number | null };
type Edition = { id: string; work_id: string; title: string; authors: string[]; cover_key: string | null };
export type PinLimits = { text: Record<PostKind, number>; comment: number };

/**
 * Zettel schreiben: zuerst die Art, dann nur die Felder dieser Art. Kein freier Chat.
 * Solange jemand schreibt, ist «Anheften» der nächste Schritt und trägt die Akzentfarbe.
 */
export function PinComposer({ circleId, admin, ownCopies, limits, onPosted, onClose }: {
  circleId: string; admin: boolean; ownCopies: OwnCopy[]; limits: PinLimits;
  onPosted: (post: Post) => void; onClose: () => void;
}) {
  const l = useLocale();
  const t = CIRCLES[l].pin;
  const toast = useToast();
  const uid = useId();
  const box = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<PostKind>("search");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Suche
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Edition[] | null>(null);
  const [work, setWork] = useState<Edition | null>(null);
  const [neededBy, setNeededBy] = useState("");
  // Empfehlung
  const [copyId, setCopyId] = useState<string | null>(ownCopies.length === 1 ? ownCopies[0].id : null);
  // Ankündigung
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const search = useRef<HTMLInputElement>(null);

  const max = limits.text[kind];
  const body = text.trim();
  const valid = kind === "search" ? Boolean(work) : kind === "recommend" ? Boolean(copyId && body) : Boolean(body);
  const dirty = Boolean(text || q || work || when || place || neededBy);

  // Beim Öffnen steht der Fokus auf der Wahl der Art
  useEffect(() => { box.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus(); }, []);

  // Titelsuche wie auf der Wunschliste: derselbe Endpunkt, ein Treffer pro Werk
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) return;
    let alive = true;
    const tm = setTimeout(async () => {
      try {
        const d = await api<{ editions: Edition[] }>(`/catalog/search?q=${encodeURIComponent(needle)}`);
        if (!alive) return;
        const seen = new Set<string>();
        setHits(d.editions.filter((e) => (seen.has(e.work_id) ? false : (seen.add(e.work_id), true))).slice(0, 5));
      } catch {
        if (alive) setHits([]);
      }
    }, 220);
    return () => { alive = false; clearTimeout(tm); };
  }, [q]);

  function switchKind(k: PostKind) {
    setKind(k);
    setText((cur) => cur.slice(0, limits.text[k]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      const payload = kind === "search"
        ? { kind, workId: work!.work_id, neededBy: neededBy || null, text: body || null }
        : kind === "recommend"
          ? { kind, copyId: copyId!, text: body }
          : { kind, text: body, eventAt: when ? new Date(when).toISOString() : null, eventPlace: place.trim() || null };
      const r = await api<{ id: string; post: Post | null }>(`/circles/${circleId}/posts`, { body: payload });
      if (r.post) onPosted(r.post);
      else onClose();
    } catch (err) {
      toast.error(errText(err, t));
      setBusy(false);
    }
  }

  const kinds: { value: PostKind; label: string }[] = [
    { value: "search", label: t.kinds.search },
    { value: "recommend", label: t.kinds.recommend },
    ...(admin ? [{ value: "announce" as const, label: t.kinds.announce }] : []),
  ];
  const minLocal = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); })();
  const textLabel = kind === "search" ? <>{t.search.text} <span className="font-medium text-muted">{t.optional}</span></> : kind === "recommend" ? t.recommend.text : t.announce.text;
  const noCopies = kind === "recommend" && ownCopies.length === 0;

  return (
    <form ref={box} onSubmit={submit} aria-label={t.compose} className="rounded-md border border-line-strong bg-paper p-4 md:p-5 space-y-5"
      onKeyDown={(e) => { if (e.key === "Escape" && !dirty) onClose(); }}>
      <Segmented name={t.kindLabel} value={kind} onChange={switchKind} options={kinds} size="lg" className="max-w-md" />

      {kind === "search" && (
        work ? (
          <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 items-center">
            <Cover l={l} data={{ title: work.title, authors: work.authors, coverKey: work.cover_key, seed: work.work_id }} width={40} />
            <div className="min-w-0">
              <p className="font-serif text-lead leading-tight break-words">{work.title}</p>
              {work.authors.length > 0 && <p className="text-body-sm text-muted truncate">{work.authors.join(", ")}</p>}
            </div>
            <Button type="button" variant="quiet" className="text-body-sm" onClick={() => { setWork(null); setHits(null); setQ(""); requestAnimationFrame(() => search.current?.focus()); }}>{t.search.change}</Button>
          </div>
        ) : (
          <div>
            <label htmlFor={`${uid}-q`} className="block text-meta font-semibold text-ink mb-2">{t.search.work}</label>
            <div className="relative">
              <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch width={18} height={18} /></span>
              <Input id={`${uid}-q`} ref={search} type="search" autoComplete="off" value={q} placeholder={t.search.placeholder} className="pl-11 [&::-webkit-search-cancel-button]:appearance-none"
                onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setHits(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits?.[0]) setWork(hits[0]); } }} />
            </div>
            <div aria-live="polite">
              {hits && q.trim().length >= 2 && (hits.length === 0 ? (
                <p className="text-body-sm text-muted mt-2">{t.search.notFound(q.trim())}</p>
              ) : (
                <ul aria-label={t.search.results} className="mt-2 rounded-sm border border-line divide-y divide-line overflow-hidden">
                  {hits.map((e) => (
                    <li key={e.work_id}>
                      <button type="button" onClick={() => setWork(e)}
                        className="w-full text-left px-3 py-2 min-h-11 grid grid-cols-[32px_minmax(0,1fr)] gap-3 items-center hover:bg-paper-2 focus-visible:bg-paper-2 transition-colors">
                        <Cover l={l} data={{ title: e.title, authors: e.authors, coverKey: e.cover_key, seed: e.work_id }} width={32} height={48} uniform />
                        <span className="min-w-0">
                          <span className="block font-serif text-body-lg leading-tight break-words">{e.title}</span>
                          <span className="block text-body-sm text-muted truncate">{e.authors.join(", ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )
      )}

      {kind === "recommend" && (
        noCopies ? (
          <Notice>
            <p>{t.recommend.none}</p>
            <Link href="/regal" className={cx(TAP, "inline-flex items-center font-medium underline underline-offset-4")}>{t.recommend.toShelf}</Link>
          </Notice>
        ) : (
          <div>
            <p id={`${uid}-copy`} className="text-meta font-semibold text-ink mb-2">{t.recommend.copy}</p>
            <div role="radiogroup" aria-labelledby={`${uid}-copy`} className="grid sm:grid-cols-2 gap-2">
              {ownCopies.map((c) => {
                const on = c.id === copyId;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setCopyId(c.id)}
                    className={cx("press-card text-left rounded-sm border px-3 py-2 min-h-14 grid grid-cols-[28px_minmax(0,1fr)_16px] gap-3 items-center",
                      on ? "border-ink bg-paper-2" : "border-line hover:border-ink-2")}>
                    <Cover l={l} data={{ title: c.title, authors: c.authors, coverKey: c.cover_key, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, seed: c.work_id }} width={28} height={42} uniform />
                    <span className="min-w-0 font-serif text-body-lg leading-tight break-words">{c.title}</span>
                    {on && <IconCheck width={16} height={16} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}

      {!noCopies && (
        <Field label={textLabel}>
          <Textarea value={text} maxLength={max} rows={kind === "announce" ? 3 : 2} required={kind !== "search"} aria-describedby={`${uid}-n`}
            placeholder={kind === "search" ? t.search.textPlaceholder : kind === "recommend" ? t.recommend.textPlaceholder : t.announce.textPlaceholder}
            onChange={(e) => setText(e.target.value)} className="min-h-0" />
          <span className="flex justify-end mt-1"><Counter id={`${uid}-n`} len={text.length} max={max} t={t} /></span>
        </Field>
      )}

      {kind === "search" && (
        <Field label={<>{t.search.neededBy} <span className="font-medium text-muted">{t.optional}</span></>} className="max-w-xs">
          <Input type="date" value={neededBy} min={todayCH()} onChange={(e) => setNeededBy(e.target.value)} />
        </Field>
      )}

      {kind === "announce" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={<>{t.announce.when} <span className="font-medium text-muted">{t.optional}</span></>}>
            <Input type="datetime-local" value={when} min={minLocal} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label={<>{t.announce.place} <span className="font-medium text-muted">{t.optional}</span></>}>
            <Input value={place} maxLength={120} placeholder={t.announce.placePlaceholder} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {!noCopies && <Button type="submit" variant="primary" disabled={!valid || busy}>{busy ? t.submitting : t.submit}</Button>}
        <Button type="button" variant="quiet" onClick={onClose}>{t.cancel}</Button>
      </div>
    </form>
  );
}
