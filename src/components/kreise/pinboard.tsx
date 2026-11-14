"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PinboardPage } from "@/lib/pinboard";
import { api, ApiError } from "@/lib/client";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { IconPlus } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { Presence } from "@/components/motion";
import { useToast } from "@/components/toast";
import { Button, Empty, Notice, cx } from "@/components/ui";
import { PinComposer, type OwnCopy, type PinLimits } from "./pin-composer";
import { PinPostCard, type Post } from "./pin-post";

const time = (p: Post) => new Date(p.created_at).getTime();
const sorted = (list: Post[]) => [...list].sort((a, b) => time(b) - time(a) || (a.id < b.id ? 1 : -1));

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

/** Platzhalter in der Gestalt eines Zettels */
export function PinPostSkeleton() {
  return (
    <div aria-hidden className="rounded-md border border-line p-4 md:p-5">
      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-4">
        <span className="skeleton block h-24 w-16" />
        <div className="space-y-2.5 pt-1">
          <span className="skeleton block h-3 w-20" />
          <span className="skeleton block h-5 w-2/3" />
          <span className="skeleton block h-3 w-1/3" />
          <span className="skeleton block h-3 w-full mt-4" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-line flex gap-2">
        <span className="skeleton block h-8 w-24 rounded-full" />
        <span className="skeleton block h-8 w-40 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Pinnwand eines Kreises (5.1). Die erste Seite kommt vom Server; danach hält der SSE-Kanal des
 * Kreises die Liste aktuell: nach jedem Ereignis wird der betroffene Zettel einzeln nachgeladen
 * (404 = nicht mehr sichtbar). Nur was nach dem Laden eintrifft, steigt auf; Entferntes sinkt weg.
 */
export function Pinboard({ circleId, me, initial, ownCopies, limits }: {
  circleId: string; me: string; initial: PinboardPage; ownCopies: OwnCopy[]; limits: PinLimits;
}) {
  const l = useLocale();
  const t = CIRCLES[l].pin;
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>(initial.posts);
  const [nextBefore, setNextBefore] = useState(initial.nextBefore);
  /** Zettel auf dem Weg hinaus: «leaving» spielt noch den Austritt, «hidden» wartet auf Rückgängig oder das Löschen */
  const [away, setAway] = useState<Record<string, "leaving" | "hidden">>({});
  /** Was nach dem Laden von anderen eintraf (steigt auf) */
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [arrived, setArrived] = useState(0);
  const [composing, setComposing] = useState(false);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const trigger = useRef<HTMLButtonElement>(null);
  const state = useRef({ posts, nextBefore });
  useEffect(() => { state.current = { posts, nextBefore }; }, [posts, nextBefore]);

  const patch = useCallback((id: string, p: Partial<Post>) => setPosts((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x))), []);
  const replace = useCallback((post: Post) => setPosts((cur) => (cur.some((x) => x.id === post.id) ? cur.map((x) => (x.id === post.id ? post : x)) : sorted([...cur, post]))), []);
  const drop = useCallback((id: string) => {
    setPosts((cur) => cur.filter((x) => x.id !== id));
    setAway((a) => { const n = { ...a }; delete n[id]; return n; });
  }, []);
  const hide = useCallback((id: string) => setAway((a) => ({ ...a, [id]: "hidden" })), []);
  const leave = useCallback((id: string) => setAway((a) => (a[id] ? a : { ...a, [id]: "leaving" })), []);

  /** Einen Zettel nach einem Live-Ereignis nachladen */
  const refetch = useCallback(async (id: string, op?: string) => {
    try {
      const { post } = await api<{ post: Post }>(`/circles/${circleId}/posts/${id}`);
      const { posts: known, nextBefore: cursor } = state.current;
      if (known.some((x) => x.id === id)) return replace(post);
      // Unbekannt: nur zeigen, wenn er in den geladenen Ausschnitt gehört (sonst kommt er mit «Mehr laden»)
      const oldest = known.length ? time(known[known.length - 1]) : 0;
      if (cursor && time(post) < oldest) return;
      replace(post);
      if (op === "insert" && !post.mine) {
        setFresh((s) => new Set(s).add(id));
        setArrived((n) => n + 1);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && state.current.posts.some((x) => x.id === id)) leave(id);
    }
  }, [circleId, replace, leave]);

  /** Nach einer Lücke (Verbindung weg, wieder online) die erste Seite abgleichen */
  const resync = useCallback(async () => {
    try {
      const page = await api<PinboardPage>(`/circles/${circleId}/posts`);
      const ids = new Set(page.posts.map((p) => p.id));
      const floor = page.nextBefore && page.posts.length ? time(page.posts[page.posts.length - 1]) : 0;
      setPosts((cur) => {
        const kept = cur.filter((x) => ids.has(x.id) || time(x) < floor).map((x) => page.posts.find((p) => p.id === x.id) ?? x);
        const have = new Set(kept.map((x) => x.id));
        return sorted([...kept, ...page.posts.filter((p) => !have.has(p.id))]);
      });
      if (!state.current.nextBefore && page.nextBefore && !state.current.posts.length) setNextBefore(page.nextBefore);
    } catch {}
  }, [circleId]);

  useEffect(() => {
    const es = new EventSource(`/api/v1/circles/${circleId}/stream`);
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const inserts = new Set<string>();
    let opened = false;
    es.addEventListener("post", (e) => {
      let msg: { post_id?: string; op?: string } = {};
      try { msg = JSON.parse((e as MessageEvent).data); } catch {}
      const id = msg.post_id;
      if (!id) return;
      if (msg.op === "insert") inserts.add(id);
      // Mehrere Ereignisse zum selben Zettel (Reaktionen in Folge) lösen nur einen Abruf aus
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        const op = inserts.delete(id) ? "insert" : msg.op;
        refetch(id, op);
      }, 120));
    });
    es.addEventListener("ready", () => { if (opened) resync(); opened = true; });
    return () => { es.close(); timers.forEach((tm) => clearTimeout(tm)); };
  }, [circleId, refetch, resync]);

  // Wieder online: nachholen, was in der Lücke kam
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) resync();
    wasOnline.current = online;
  }, [online, resync]);

  // Die Ansage «1 neuer Zettel» verstummt wieder, damit die nächste neu gezählt wird
  useEffect(() => {
    if (!arrived) return;
    const tm = setTimeout(() => setArrived(0), 8000);
    return () => clearTimeout(tm);
  }, [arrived]);

  // Ohne Animation (Tab im Hintergrund) trotzdem aufräumen
  useEffect(() => {
    const ids = Object.keys(away).filter((id) => away[id] === "leaving");
    if (!ids.length) return;
    const tm = setTimeout(() => ids.forEach(drop), 400);
    return () => clearTimeout(tm);
  }, [away, drop]);

  async function loadMore() {
    if (!nextBefore) return;
    setMore("loading");
    try {
      const page = await api<PinboardPage>(`/circles/${circleId}/posts?before=${encodeURIComponent(nextBefore)}`);
      setPosts((cur) => {
        const have = new Set(cur.map((x) => x.id));
        return sorted([...cur, ...page.posts.filter((p) => !have.has(p.id))]);
      });
      setNextBefore(page.nextBefore);
      setMore("idle");
    } catch {
      setMore("error");
    }
  }

  function close() {
    setComposing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  const visible = posts.filter((p) => away[p.id] !== "hidden");
  const empty = visible.length === 0;
  const composeButton = (
    <Button ref={trigger} variant="secondary" onClick={() => setComposing(true)}>
      <IconPlus width={17} height={17} aria-hidden />{t.compose}
    </Button>
  );

  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">{arrived > 0 ? t.newPosts(arrived) : ""}</p>

      {!online && <Notice className="mb-4">{t.offline}</Notice>}

      {!composing && !empty && <div className="mb-4">{composeButton}</div>}
      <Presence show={composing} className="mb-4">
        <PinComposer circleId={circleId} admin={initial.role === "admin"} ownCopies={ownCopies} limits={limits} onClose={close}
          onPosted={(post) => { replace(post); close(); toast.show({ text: t.posted }, 3000); }} />
      </Presence>

      {empty && !composing && <Empty text={t.empty} action={composeButton} />}

      {!empty && (
        <ul className="space-y-3">
          {visible.map((p) => (
            <li key={p.id} className={cx(away[p.id] === "leaving" ? "anim-out" : fresh.has(p.id) && "anim-rise")}
              onAnimationEnd={(e) => { if (away[p.id] === "leaving" && e.target === e.currentTarget) drop(p.id); }}>
              <PinPostCard circleId={circleId} me={me} post={p} commentMax={limits.comment}
                onPatch={patch} onReplace={replace} onHide={hide} onGone={drop}
                onRestore={(id) => { setAway((a) => { const n = { ...a }; delete n[id]; return n; }); refetch(id); }} />
            </li>
          ))}
        </ul>
      )}

      {more === "loading" && (
        <div role="status" aria-label={t.loading} className="mt-3 space-y-3"><PinPostSkeleton /><PinPostSkeleton /></div>
      )}
      {more === "error" && (
        <Notice tone="late" className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span role="alert">{online ? t.loadError : t.offlineError}</span>
          <Button variant="ghost" size="sm" className="min-h-11 [@media(pointer:fine)]:min-h-9" onClick={loadMore}>{t.retry}</Button>
        </Notice>
      )}
      {nextBefore && more === "idle" && (
        <div className="mt-4"><Button variant="ghost" onClick={loadMore}>{t.more}</Button></div>
      )}
    </div>
  );
}
