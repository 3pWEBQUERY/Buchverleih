"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { Edition } from "@/lib/catalog/works";
import type { CopySettings, ShelfCopy } from "@/lib/copies";
import { ApiError, api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { CAPTURE } from "@/lib/i18n/messages/capture";
import { Cover } from "@/components/cover";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { OptionCard } from "@/components/form-controls";
import { Button, Notice, Select, cx } from "@/components/ui";
import { IconCheck, IconClose } from "@/components/icons";
import { ConditionGrid, coverOf } from "./erfassen-parts";
import type { Added } from "./erfassen";

/**
 * Erfassen im Stapel: die Kamera bleibt offen, erkannte Bücher sammeln sich am unteren Rand,
 * am Schluss gibt es einen gemeinsamen Schritt für Zustand und Sichtbarkeit.
 * Ins Regal kommt jedes Buch über POST /api/v1/copies – derselbe Weg wie beim einzelnen Buch.
 */

/** Dieselben Werte wie die Mehrfachauswahl im Regal (regal-view.tsx: Bulk, VIS_OPTIONS) */
type Visibility = ShelfCopy["visibility"];
type Shared = Required<Pick<CopySettings, "condition">> & { visibility: Visibility };
const VIS_OPTIONS: Visibility[] = ["all", "proven", "circles"];
const CONDITIONS = [1, 2, 3, 4] as const;

export type StackMessage =
  | { kind: "added"; title: string }
  | { kind: "duplicate"; title: string }
  | { kind: "unknown"; isbn: string }
  | { kind: "offline"; isbn: string }
  | { kind: "error"; isbn: string; text: string };

const STORE_KEY = "lr_batch_stack";
const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useStack({ onCreated, onDeleted, libraryCircleId }: { onCreated: (a: Added) => void; onDeleted: (ids: string[]) => void; libraryCircleId?: string }) {
  const toast = useToast();
  const c = CAPTURE[useLocale()];
  const t = c.batch;
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [phase, setPhase] = useState<"scan" | "review">("scan");
  const [stack, setStack] = useState<Edition[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const [message, setMessage] = useState<StackMessage | null>(null);
  const [shared, setShared] = useState<Shared>({ condition: 2, visibility: "all" });
  const [overrides, setOverrides] = useState<Record<string, Partial<Shared>>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [run, setRun] = useState<{ i: number; total: number; current: string } | null>(null);
  const [result, setResult] = useState<{ ok: number; total: number } | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  // Der Scanner meldet Treffer ausserhalb des Render-Takts: der Stapel muss sofort lesbar sein
  const list = useRef<Edition[]>([]);
  const busy = useRef(false);
  // Was aus diesem Stapel schon im Regal steht – auch über mehrere Anläufe hinweg (für «Rückgängig»)
  const placed = useRef<{ copyId: string; edition: Edition }[]>([]);

  const commit = useCallback((next: Edition[]) => {
    list.current = next;
    setStack(next);
    try {
      if (next.length) sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(STORE_KEY);
    } catch {}
  }, []);

  // Ein angefangener Stapel übersteht das Neuladen der Seite (nichts ist bis «Fertig» gespeichert)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]") as Edition[];
      if (Array.isArray(saved) && saved.length) {
        list.current = saved;
        setStack(saved);
        setMode("batch");
      }
    } catch {}
  }, []);

  const lookup = useCallback(async (raw: string, source: "scan" | "manual"): Promise<boolean> => {
    const isbn = raw.replace(/[^\dXx]/g, "");
    if (!/^97[89]\d{10}$/.test(isbn) && !/^\d{9}[\dXx]$/.test(isbn)) {
      toast.error(c.notIsbn);
      return false;
    }
    if (busy.current) return false;
    const known = list.current.find((e) => e.isbn13 === isbn);
    if (known) {
      setMessage({ kind: "duplicate", title: known.title });
      return true;
    }
    if (!navigator.onLine) {
      setMessage({ kind: "offline", isbn });
      return false;
    }
    busy.current = true;
    setLooking(isbn);
    setMessage(null);
    try {
      const r = await api<{ edition: Edition | null }>(`/catalog/isbn/${isbn}`);
      const e = r.edition;
      if (!e) {
        setMessage({ kind: "unknown", isbn });
        return false;
      }
      // ISBN-10 und ISBN-13 derselben Ausgabe: am Ende zählt die Ausgabe
      if (list.current.some((x) => x.id === e.id)) {
        setMessage({ kind: "duplicate", title: e.title });
        return true;
      }
      commit([...list.current, e]);
      setFresh(e.id);
      setMessage({ kind: "added", title: e.title });
      // Der Scanner vibriert beim Treffer selbst; von Hand eingegeben fehlt dieses Zeichen sonst
      if (source === "manual") {
        try { navigator.vibrate?.(40); } catch {}
      }
      return true;
    } catch (err) {
      // Ohne Antwort der API (fetch scheitert) ist die Verbindung weg, nicht die ISBN falsch
      setMessage(err instanceof ApiError ? { kind: "error", isbn, text: err.message } : { kind: "offline", isbn });
      return false;
    } finally {
      busy.current = false;
      setLooking(null);
    }
  }, [c.notIsbn, commit, toast]);

  const remove = useCallback((e: Edition) => {
    const at = list.current.findIndex((x) => x.id === e.id);
    if (at < 0) return;
    commit(list.current.filter((x) => x.id !== e.id));
    setFresh(null);
    setMessage(null);
    if (!list.current.length) setPhase("scan");
    toast.show({
      text: t.removed(e.title),
      undo: () => {
        if (list.current.some((x) => x.id === e.id)) return;
        const next = [...list.current];
        next.splice(Math.min(at, next.length), 0, e);
        commit(next);
      },
    });
  }, [commit, t, toast]);

  /** Stellt den Stapel (oder ein einzelnes Buch daraus) ins Regal: ein POST /copies pro Buch. */
  async function submit(only?: string) {
    const items = list.current.filter((e) => !only || e.id === only);
    if (!items.length || run) return;
    let ok = 0;
    const errors: Record<string, string> = only ? { ...failed } : {};
    delete errors[only ?? ""];
    let offline = false;
    setResult(null);
    for (const [i, e] of items.entries()) {
      setRun({ i: i + 1, total: items.length, current: e.id });
      if (offline) {
        errors[e.id] = t.offlineSave;
        continue;
      }
      const s = { ...shared, ...overrides[e.id] };
      try {
        const r = await api<{ id: string }>("/copies", { body: { editionId: e.id, condition: s.condition, visibility: s.visibility, ...(libraryCircleId ? { libraryCircleId } : {}) } });
        placed.current.push({ copyId: r.id, edition: e });
        ok++;
        onCreated({ id: r.id, title: e.title, authors: e.authors, condition: s.condition, circlesOnly: s.visibility === "circles", cover: coverOf(e) });
        commit(list.current.filter((x) => x.id !== e.id));
      } catch (err) {
        if (err instanceof ApiError) errors[e.id] = err.message;
        else {
          offline = true;
          errors[e.id] = t.offlineSave;
        }
      }
      setFailed({ ...errors });
    }
    setRun(null);
    setFailed(errors);
    if (list.current.length) {
      setResult({ ok, total: items.length });
      return;
    }
    setOverrides({});
    setFresh(null);
    setMessage(null);
    setPhase("scan");
    const created = placed.current;
    placed.current = [];
    if (!created.length) return;
    toast.show({
      text: t.allDone(created.length),
      // Rückgängig: die Exemplare wieder aus dem Regal nehmen und zurück in den Stapel legen
      undo: async () => {
        const gone: typeof created = [];
        try {
          for (const x of created) {
            await api(`/copies/${x.copyId}`, { method: "DELETE" });
            gone.push(x);
          }
        } catch (err) {
          toast.error((err as Error).message);
        }
        onDeleted(gone.map((x) => x.copyId));
        commit([...list.current, ...gone.map((x) => x.edition).filter((e) => !list.current.some((y) => y.id === e.id))]);
      },
    }, 8000);
  }

  return {
    mode, setMode, phase, stack, fresh, looking, message, online, shared, overrides, failed, run, result,
    /** Meldungen, nach denen die Kamera wartet, bis die Person weitermacht */
    blocked: message !== null && message.kind !== "added" && message.kind !== "duplicate",
    lookup, remove, submit,
    dismiss: () => setMessage(null),
    review: () => { setMessage(null); setPhase("review"); },
    resume: () => { setResult(null); setPhase("scan"); },
    setShared: (p: Partial<Shared>) => setShared((s) => ({ ...s, ...p })),
    setOverride: (id: string, p: Partial<Shared>) => setOverrides((o) => {
      const next = { ...o[id], ...p };
      for (const k of Object.keys(next) as (keyof Shared)[]) if (next[k] === undefined) delete next[k];
      return { ...o, [id]: next };
    }),
  };
}
export type Stack = ReturnType<typeof useStack>;

/** Was mit dem letzten Scan passiert ist – als Text, nicht nur als Farbe. */
export function StackNote({ s, onManual }: { s: Stack; onManual: (isbn: string) => void }) {
  const c = CAPTURE[useLocale()];
  const t = c.batch;
  const m = s.message;
  const bad = m && m.kind !== "added" && m.kind !== "duplicate";
  return (
    <div aria-live="polite">
      {s.looking && <p className="text-body-sm text-muted tnum px-1">{c.lookingUp(s.looking)}</p>}
      {m && !s.looking && (
        <div className={cx("rounded-md border px-4 py-3.5", bad ? "border-late/50" : "border-line")}>
          <p className="text-body leading-snug">
            <span className={cx("font-semibold inline-flex items-center gap-1.5 mr-2", m.kind === "added" ? "text-ok" : bad ? "text-late" : "text-ink")}>
              {m.kind === "added" ? <IconCheck width={16} height={16} strokeWidth={2} /> : bad ? <IconClose width={16} height={16} strokeWidth={2} /> : null}
              {m.kind === "added" ? t.statusOk : m.kind === "duplicate" ? t.statusDuplicate : m.kind === "unknown" ? t.statusUnknown : m.kind === "offline" ? t.statusOffline : t.statusError}
            </span>
            {m.kind === "added" ? t.added(m.title)
              : m.kind === "duplicate" ? t.duplicate(m.title)
              : m.kind === "unknown" ? t.notFound(m.isbn)
              : m.kind === "offline" ? t.offlineLookup(m.isbn)
              : `${t.lookupFailed(m.isbn)} ${m.text}`}
          </p>
          {m.kind !== "added" && m.kind !== "duplicate" && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="ghost" onClick={s.dismiss}>{t.resume}</Button>
              {m.kind === "unknown"
                ? <Button variant="ghost" onClick={() => onManual(m.isbn)}>{t.byHand}</Button>
                : <Button variant="ghost" onClick={() => { void s.lookup(m.isbn, "manual"); }}>{t.retry}</Button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Der Stapel am unteren Rand. Ein neues Buch fliegt vom Kamerabild an seinen Platz:
 * eine Kopie des Covers liegt fest über der Seite und bewegt sich nur per transform und opacity.
 */
export function StackBar({ s, origin }: { s: Stack; origin: RefObject<HTMLElement | null> }) {
  const l = useLocale();
  const t = CAPTURE[l].batch;
  const row = useRef<HTMLUListElement>(null);
  const n = s.stack.length;

  // Hinweise (Rückgängig) über die Leiste setzen, wie bei der Mehrfachauswahl im Regal
  useEffect(() => {
    document.body.dataset.sheet = "1";
    return () => { delete document.body.dataset.sheet; };
  }, []);

  useLayoutEffect(() => {
    const ul = row.current;
    const slot = s.fresh ? ul?.querySelector<HTMLElement>(`[data-stack="${s.fresh}"]`) : null;
    if (!ul || !slot) return;
    ul.scrollLeft = ul.scrollWidth;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      slot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "linear" });
      return;
    }
    const from = origin.current?.getBoundingClientRect();
    if (!from) return;
    const to = slot.getBoundingClientRect();
    const css = getComputedStyle(document.documentElement);
    const duration = parseFloat(css.getPropertyValue("--dur-slow")) || 420;
    const ghost = slot.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-stack");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    Object.assign(ghost.style, { position: "fixed", left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, margin: "0", zIndex: "45", pointerEvents: "none", listStyle: "none" });
    document.body.append(ghost);
    slot.style.opacity = "0";
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const frames = [
      { transform: `translate(${dx}px, ${dy}px) scale(2.4)`, opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: "none", opacity: 1 },
    ];
    let anim: Animation;
    try {
      anim = ghost.animate(frames, { duration, easing: css.getPropertyValue("--ease-out-curve").trim() || "ease-out" });
    } catch {
      anim = ghost.animate(frames, { duration, easing: "ease-out" });
    }
    const end = () => {
      ghost.remove();
      slot.style.opacity = "";
    };
    anim.finished.then(end, end);
    return () => anim.cancel();
  }, [s.fresh, origin]);

  return (
    <section aria-label={t.listAria}
      className="sticky z-20 bottom-[calc(68px+env(safe-area-inset-bottom))] md:bottom-0 mt-10 -mx-4 px-4 md:mx-0 md:px-0 py-3 bg-paper border-t border-line-strong">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-body-sm font-medium tnum">{t.count(n)}</p>
        <Button variant="primary" size="lg" disabled={!n} onClick={s.review}>{t.done(n)}</Button>
      </div>
      {n === 0 ? (
        <div className="flex items-center gap-4 mt-2 min-h-14">
          <div aria-hidden className="flex items-end gap-1.5 flex-none">
            {[0, 1, 2].map((i) => <span key={i} className="block w-8 h-12 rounded-xs border border-dashed border-line-strong" />)}
          </div>
          <p className="text-ink-2 text-body-sm leading-snug">{t.empty}</p>
        </div>
      ) : (
        <ul ref={row} className="flex gap-1 mt-2 overflow-x-auto overscroll-x-contain">
          {s.stack.map((e) => (
            <li key={e.id} data-stack={e.id} className="flex-none">
              <button type="button" onClick={() => s.remove(e)} aria-label={t.remove(e.title)} title={t.remove(e.title)}
                className="group relative grid place-items-center h-14 w-11 rounded-xs -outline-offset-2">
                <Cover data={coverOf(e)} width={32} height={48} uniform priority l={l} />
                <span aria-hidden className="absolute top-0 right-0 h-4 w-4 grid place-items-center rounded-full bg-paper border border-line-strong text-ink-2 group-hover:border-ink group-hover:text-ink transition-colors">
                  <IconClose width={10} height={10} strokeWidth={2.2} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Der gemeinsame Schritt am Schluss: Zustand und Sichtbarkeit für alle, pro Buch abweichend. */
export function StackReview({ s }: { s: Stack }) {
  const l = useLocale();
  const t = CAPTURE[l].batch;
  const L = labels(l);
  const top = useRef<HTMLDivElement>(null);
  const busy = s.run !== null;
  const n = s.stack.length;
  const failures = Object.keys(s.failed).filter((id) => s.stack.some((e) => e.id === id)).length;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    top.current?.focus({ preventScroll: true });
    top.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  return (
    <div ref={top} tabIndex={-1} className="scroll-mt-28 outline-none">
      {s.result && failures > 0 && (
        <Notice tone="late" className="mb-6"><span role="alert">{t.partial(s.result.ok, s.result.total)}</span></Notice>
      )}
      {!s.online && <Notice className="mb-6">{t.offline}</Notice>}

      <fieldset disabled={busy} className="min-w-0">
        <legend className="font-medium text-body mb-3">{t.conditionAll}</legend>
        <ConditionGrid value={s.shared.condition} onPick={(c) => s.setShared({ condition: c })} />
      </fieldset>

      <fieldset disabled={busy} className="min-w-0 mt-8">
        <legend className="font-medium text-body mb-3">{t.visibilityAll}</legend>
        <div role="radiogroup" aria-label={t.visibilityAll} className="grid sm:grid-cols-3 gap-2">
          {VIS_OPTIONS.map((v) => (
            <OptionCard key={v} compact on={s.shared.visibility === v} onClick={() => s.setShared({ visibility: v })} title={L.visibilityLabel[v]} desc={t.visibilityHint[v]} />
          ))}
        </div>
      </fieldset>

      <div className="mt-10">
        <h3 className="text-title-sm font-title tracking-title">{t.books} <span className="text-muted tnum">· {n}</span></h3>
        <p className="text-body-sm text-muted mt-1">{t.booksHint}</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {s.stack.map((e) => {
            const o = s.overrides[e.id] ?? {};
            const error = s.failed[e.id];
            const current = s.run?.current === e.id;
            return (
              <li key={e.id} className="py-4">
                <div className="flex items-start gap-3.5">
                  <Cover data={coverOf(e)} width={36} height={54} uniform l={l} />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lead leading-tight">{e.title}</p>
                    {e.authors.length > 0 && <p className="text-meta text-muted mt-0.5">{e.authors.join(", ")}</p>}
                    {current && <p className="text-meta text-ink-2 mt-1.5">{t.savingOne}</p>}
                    {error && !current && (
                      <p className="text-body-sm text-late mt-1.5 flex items-start gap-1.5">
                        <IconClose width={16} height={16} strokeWidth={2} className="flex-none mt-0.5" />
                        <span><span className="font-semibold">{t.failedTag}.</span> {error}</span>
                      </p>
                    )}
                  </div>
                  <button type="button" disabled={busy} onClick={() => s.remove(e)} aria-label={t.remove(e.title)} title={t.removeShort}
                    className="press h-11 w-11 -mt-1.5 -mr-1.5 grid place-items-center rounded-sm text-muted hover:text-ink hover:bg-paper-2 flex-none disabled:opacity-40">
                    <IconClose />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2 mt-3 sm:pl-[50px]">
                  <label className="block min-w-0">
                    <span className="block text-meta text-muted mb-1">{CAPTURE[l].condition}</span>
                    <Select disabled={busy} aria-label={t.conditionOf(e.title)} value={o.condition != null ? String(o.condition) : ""}
                      onChange={(v) => s.setOverride(e.id, { condition: v ? Number(v) : undefined })}
                      options={[{ value: "", label: t.likeAll(L.conditionLabel[s.shared.condition]) }, ...CONDITIONS.map((c) => ({ value: String(c), label: L.conditionLabel[c], text: L.conditionLabel[c] }))]} />
                  </label>
                  <label className="block min-w-0">
                    <span className="block text-meta text-muted mb-1">{t.visibility}</span>
                    <Select disabled={busy} aria-label={t.visibilityOf(e.title)} value={o.visibility ?? ""}
                      onChange={(v) => s.setOverride(e.id, { visibility: (v || undefined) as Visibility | undefined })}
                      options={[{ value: "", label: t.likeAll(L.visibilityLabel[s.shared.visibility]) }, ...VIS_OPTIONS.map((v) => ({ value: v as string, label: L.visibilityLabel[v], text: L.visibilityLabel[v] }))]} />
                  </label>
                </div>
                {error && !busy && n > 1 && (
                  <div className="mt-3 sm:pl-[50px]">
                    <Button variant="ghost" onClick={() => s.submit(e.id)}>{t.retry}</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" disabled={busy || !n} onClick={() => s.submit()} className="w-full sm:w-auto !whitespace-normal min-h-12 h-auto py-2.5">
          {busy ? t.saving(s.run!.i, s.run!.total) : failures > 0 ? t.retryAll(n) : t.submit(n)}
        </Button>
        <Button variant="ghost" size="lg" disabled={busy} onClick={s.resume} className="w-full sm:w-auto">{t.resume}</Button>
        <p className="sr-only" role="status">{busy ? t.progress(s.run!.i, s.run!.total) : ""}</p>
      </div>
    </div>
  );
}
