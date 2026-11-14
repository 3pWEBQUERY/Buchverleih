"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { PinComment, PinPost, ReactionKind } from "@/lib/pinboard";
import { api, ApiError } from "@/lib/client";
import { ago, dayToDate, fmtDay, fmtDayTime } from "@/lib/dates";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { Cover } from "@/components/cover";
import { IconCalendar, IconCheck, IconFlag } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { Presence, RollingNumber } from "@/components/motion";
import { Monogram } from "@/components/person/monogram";
import { StatusText, shelfStatusText, type Tone } from "@/components/status";
import { useToast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { useLater } from "@/components/use-later";

/** Zettel, wie ihn die API liefert. Über JSON kommen Zeitpunkte als ISO-Text – die Helfer in lib/dates nehmen beides. */
export type Post = PinPost;
type Msg = (typeof CIRCLES)["de"]["pin"];

/** Auf Touch mindestens 44 px hoch, mit Maus und Tastatur kompakter */
export const TAP = "min-h-11 [@media(pointer:fine)]:min-h-9";
/** Leise Textaktion (Kommentieren, Melden, Entfernen) */
const QUIET = cx(TAP, "inline-flex items-center gap-1.5 text-body-sm font-medium text-muted hover:text-ink underline-offset-4 hover:underline transition-colors disabled:opacity-40 disabled:pointer-events-none");

/** Die API übersetzt ihre Meldungen selbst; ohne Verbindung gibt es keine Antwort, die man zeigen könnte */
export function errText(e: unknown, t: Msg) {
  return e instanceof ApiError ? e.message : t.offlineError;
}

/** Zeichenzähler: als Zahl immer da, kurz vor der Grenze als Satz (nicht nur über Farbe) */
export function Counter({ id, len, max, t, always = true }: { id?: string; len: number; max: number; t: Msg; always?: boolean }) {
  const left = max - len;
  const near = left <= 20;
  if (!always && left > 100) return <span id={id} className="sr-only">{len}/{max}</span>;
  return (
    <span id={id} className={cx("text-caption tnum", near ? "text-ink font-semibold" : "text-muted")}>
      {near ? t.charsLeft(Math.max(0, left)) : `${len}/${max}`}
    </span>
  );
}

function ReactionChip({ on, count, label, onToggle }: { on: boolean; count: number; label: string; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle}
      className={cx("press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-body-sm font-medium text-left", TAP,
        on ? "border-ink bg-paper-2 text-ink" : "border-field text-ink-2 hover:border-ink hover:text-ink")}>
      {on && <IconCheck width={14} height={14} aria-hidden className="flex-none" />}
      <span>{label}</span>
      <RollingNumber value={count} className={on ? "text-ink-2" : "text-muted"} />
    </button>
  );
}

/**
 * Ein Zettel: flache Papierkarte mit Haarlinie. Typ als Eyebrow, Cover links im echten Format.
 * Die Akzentfarbe trägt allein «Ich hab's» auf einem Suchzettel.
 */
export function PinPostCard({ circleId, me, post, commentMax, onPatch, onReplace, onHide, onRestore, onGone }: {
  circleId: string; me: string; post: Post; commentMax: number;
  /** Teil eines Zettels ersetzen (optimistisch oder mit der Antwort der API) */
  onPatch: (id: string, patch: Partial<Post>) => void;
  onReplace: (post: Post) => void;
  /** Sofort aus der Ansicht nehmen (Löschen mit Rückgängig, «Gefunden») und wieder zeigen */
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
  /** Endgültig weg */
  onGone: (id: string) => void;
}) {
  const l = useLocale();
  const t = CIRCLES[l].pin;
  const toast = useToast();
  const later = useLater();
  const base = `/circles/${circleId}/posts/${post.id}`;
  const uid = useId();
  const [choosing, setChoosing] = useState(false);
  const [offering, setOffering] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const who = post.mine ? t.you : post.author.first_name;
  const title = post.copy?.title ?? post.work?.title ?? null;
  const authors = post.copy?.authors ?? post.work?.authors ?? [];
  const cover = post.copy
    ? { title: post.copy.title, authors: post.copy.authors, coverKey: post.copy.cover_key, photoKey: post.copy.photo_key, photoW: post.copy.photo_w, photoH: post.copy.photo_h, seed: post.copy.work_id }
    : post.work ? { title: post.work.title, authors: post.work.authors, coverKey: post.work.cover_key, seed: post.work.id } : null;
  const href = post.copy ? `/exemplar/${post.copy.id}` : post.work ? `/titel/${post.work.id}` : null;

  // Verfügbarkeit einer Empfehlung: immer Text mit Punkt, nie nur Farbe
  let status: { tone: Tone; text: string } | null = null;
  if (post.copy) {
    status = post.copy.status === "requested"
      ? { tone: "wait", text: t.requested }
      : shelfStatusText({ status: post.copy.status, lent_until: post.copy.lent_until, next_start: null, open_requests: 0 }, l);
  }

  async function toggle(kind: ReactionKind) {
    const before = post.reactions;
    const was = before.mine[kind];
    onPatch(post.id, { reactions: { ...before, [kind]: Math.max(0, before[kind] + (was ? -1 : 1)), mine: { ...before.mine, [kind]: !was } } });
    try {
      const r = was
        ? await api<{ reactions: Post["reactions"]; wishlisted?: boolean }>(`${base}/reactions?kind=${kind}`, { method: "DELETE" })
        : await api<{ reactions: Post["reactions"]; wishlisted?: boolean }>(`${base}/reactions`, { body: { kind, ...(kind === "want" && title ? { addToWishlist: true } : {}) } });
      onPatch(post.id, { reactions: r.reactions });
      if (r.wishlisted && title) toast.show({ text: t.wishlisted(title) }, 4000);
    } catch (e) {
      onPatch(post.id, { reactions: before });
      toast.error(errText(e, t));
    }
  }

  async function offer(copyId: string) {
    setOffering(true);
    try {
      await api(`${base}/offer`, { body: { copyId } });
      onPatch(post.id, { offeredByMe: true });
      setChoosing(false);
    } catch (e) {
      toast.error(errText(e, t));
    } finally {
      setOffering(false);
    }
  }

  /** «Gefunden»: der Zettel ist erledigt und verschwindet – umkehrbar, darum sofort und mit Rückgängig */
  async function found() {
    onHide(post.id);
    try {
      await api(base, { method: "PATCH", body: { fulfilled: true } });
      toast.show({
        text: t.foundToast,
        undo: async () => {
          try {
            await api(base, { method: "PATCH", body: { fulfilled: false } });
            onRestore(post.id);
          } catch (e) {
            toast.error(errText(e, t));
          }
        },
      });
    } catch (e) {
      onRestore(post.id);
      toast.error(errText(e, t));
    }
  }

  function remove() {
    onHide(post.id);
    later(t.postRemoved, async () => { await api(base, { method: "DELETE" }); onGone(post.id); }, () => onRestore(post.id));
  }

  async function report(targetType: "circle_post" | "circle_post_comment", targetId: string) {
    try {
      await api("/reports", { body: { targetType, targetId, reason: "inappropriate" } });
      setReported((s) => new Set(s).add(targetId));
      toast.show({ text: t.reportedToast });
    } catch (e) {
      toast.error(errText(e, t));
    }
  }

  const matching = post.myMatchingCopies;
  const direct = matching.length === 1 && matching[0].lendable;
  const canOffer = post.kind === "search" && !post.mine && matching.length > 0 && !post.offeredByMe;

  return (
    <article aria-label={t.postAria(t.kinds[post.kind], post.author.first_name)} className="rounded-md border border-line bg-paper p-4 md:p-5">
      <div className={cx("grid gap-x-4", cover && "grid-cols-[64px_minmax(0,1fr)]")}>
        {cover && (href
          ? <Link href={href} tabIndex={-1} aria-hidden className="self-start"><Cover l={l} data={cover} width={64} /></Link>
          : <Cover l={l} data={cover} width={64} className="self-start" />)}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
            <span className="eyebrow">{t.kinds[post.kind]}</span>
            <span className="inline-flex items-center gap-1.5 text-meta text-muted min-w-0">
              <Monogram name={post.author.first_name} seed={post.author.id} photo={post.author.avatar_key} size={18} />
              <span className="truncate">{who}</span>
              <span aria-hidden>·</span>
              <time dateTime={new Date(post.created_at).toISOString()} suppressHydrationWarning className="flex-none">{ago(post.created_at, l)}</time>
            </span>
          </p>

          {title && (
            <h3 className="font-serif text-title-sm leading-title mt-1.5 break-words">
              {href ? <Link href={href} className="hover:underline underline-offset-4 decoration-1">{title}</Link> : title}
            </h3>
          )}
          {authors.length > 0 && <p className="text-body-sm text-muted mt-0.5 truncate">{authors.join(", ")}</p>}
          {status && <p className="mt-2"><StatusText tone={status.tone} className="text-ink-2">{status.text}</StatusText></p>}
          {post.kind === "search" && post.needed_by && <p className="text-meta text-ink-2 mt-2">{t.until(fmtDay(dayToDate(post.needed_by), l))}</p>}

          {post.text && <p className={cx("text-body text-ink leading-relaxed whitespace-pre-wrap break-words", title ? "mt-2.5" : "mt-2")}>{post.text}</p>}

          {post.kind === "announce" && (post.event_at || post.event_place) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-2">
              <span className="inline-flex items-start gap-2 min-w-0">
                <IconCalendar width={16} height={16} aria-hidden className="flex-none mt-0.5 text-muted" />
                <span className="min-w-0 break-words">{[post.event_at ? fmtDayTime(post.event_at, l) : null, post.event_place].filter(Boolean).join(" · ")}</span>
              </span>
              {post.ics && <a href={`/api/v1${post.ics}`} className={cx(TAP, "inline-flex items-center font-medium text-ink underline underline-offset-4 decoration-1")}>{t.toCalendar}</a>}
            </p>
          )}

          {/* Suche: der einzige Akzent auf dem Zettel ist der Knopf «Ich hab's» */}
          {canOffer && (
            <div className="mt-3.5">
              <Button variant="primary" disabled={offering} aria-expanded={direct ? undefined : choosing} aria-controls={direct ? undefined : `${uid}-copies`}
                onClick={() => (direct ? offer(matching[0].id) : setChoosing((c) => !c))}>
                {t.iHaveIt}
              </Button>
              <Presence show={choosing && !direct}>
                <div id={`${uid}-copies`} className="mt-3">
                  <p id={`${uid}-copies-t`} className="text-meta font-semibold">{t.chooseCopy}</p>
                  <ul aria-labelledby={`${uid}-copies-t`} className="mt-1 divide-y divide-line border-y border-line">
                    {matching.map((c) => (
                      <li key={c.id} className="py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="min-w-0">
                          <span className="block text-body-sm break-words">{c.title}</span>
                          {!c.lendable && (
                            <span className="block text-meta text-muted">
                              {t.notLendable} <Link href={`/regal/${c.id}`} className="underline underline-offset-4 text-ink-2 hover:text-ink">{t.changeInShelf}</Link>
                            </span>
                          )}
                        </span>
                        <Button variant="ghost" size="sm" className={TAP} disabled={!c.lendable || offering} onClick={() => offer(c.id)}>{t.offerThis}</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </Presence>
            </div>
          )}
          {post.kind === "search" && post.offeredByMe && (
            <p className="mt-3 text-body-sm text-ink-2" role="status">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><IconCheck width={15} height={15} aria-hidden />{t.offered}</span>
              <span className="block text-meta text-muted mt-0.5">{t.offeredHint(post.author.first_name)}</span>
            </p>
          )}
          {post.kind === "search" && post.mine && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
              <p className="text-body-sm text-ink-2 min-w-0">
                <span className="font-medium text-ink tnum">{t.offers(post.offers)}</span>
                {post.offers > 0 && <span className="block text-meta text-muted">{t.offersHint}</span>}
              </p>
              <Button variant="ghost" size="sm" className={TAP} onClick={found}><IconCheck width={15} height={15} aria-hidden />{t.found}</Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {post.mine ? (
          <p className="text-meta text-muted tnum flex flex-wrap gap-x-3">
            {post.reactions.thanks > 0 && <span>{t.thanksCount(post.reactions.thanks)}</span>}
            {post.reactions.want > 0 && <span>{t.wantCount(post.reactions.want)}</span>}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ReactionChip on={post.reactions.mine.thanks} count={post.reactions.thanks} label={t.thanks} onToggle={() => toggle("thanks")} />
            {title && <ReactionChip on={post.reactions.mine.want} count={post.reactions.want} label={t.want} onToggle={() => toggle("want")} />}
          </div>
        )}
        <Comments post={post} me={me} base={base} max={commentMax} t={t} reported={reported} onReplace={onReplace} onReport={report}
          actions={(
            <>
              {!post.mine && (reported.has(post.id)
                ? <span className={cx(TAP, "inline-flex items-center text-body-sm text-muted")}>{t.reported}</span>
                : <button type="button" className={QUIET} onClick={() => report("circle_post", post.id)}><IconFlag width={13} height={13} aria-hidden />{t.report}</button>)}
              {post.canDelete && <button type="button" className={QUIET} aria-label={t.removePost} onClick={remove}>{t.remove}</button>}
            </>
          )} />
      </div>
    </article>
  );
}

/**
 * Kommentare auf einer Ebene. Die leisen Aktionen des Zettels (Kommentieren, Melden, Entfernen) stehen
 * in derselben Zeile wie die Reaktionen; Liste und Eingabe folgen darunter über die ganze Breite.
 */
function Comments({ post, me, base, max, t, reported, actions, onReplace, onReport }: {
  post: Post; me: string; base: string; max: number; t: Msg; reported: Set<string>; actions: React.ReactNode;
  onReplace: (post: Post) => void; onReport: (type: "circle_post_comment", id: string) => void;
}) {
  const l = useLocale();
  const toast = useToast();
  const later = useLater();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const input = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const list = post.comments.filter((c) => !hidden.has(c.id));
  const total = Math.max(list.length, post.comment_count - (post.comments.length - list.length));
  const folded = list.length > 2 && !all;
  const shown = folded ? list.slice(-2) : list;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await api<{ post: Post | null }>(`${base}/comments`, { body: { body } });
      if (r.post) onReplace(r.post);
      setDraft("");
      setOpen(false);
      opener.current?.focus();
    } catch (err) {
      toast.error(errText(err, t));
    } finally {
      setBusy(false);
    }
  }

  function remove(c: PinComment) {
    setHidden((s) => new Set(s).add(c.id));
    later(t.commentRemoved, () => api(`${base}/comments?comment=${c.id}`, { method: "DELETE" }),
      () => setHidden((s) => { const n = new Set(s); n.delete(c.id); return n; }));
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4">
        <button ref={opener} type="button" className={QUIET} aria-expanded={open} aria-controls={`${uid}-form`}
          onClick={() => { setOpen((o) => !o); if (!open) requestAnimationFrame(() => input.current?.focus()); }}>
          {t.comment}
        </button>
        {actions}
      </div>

      <div className="basis-full min-w-0 empty:hidden">
          {list.length > 2 && (
            <button type="button" className={cx(QUIET, "text-ink-2")} aria-expanded={all} aria-controls={`${uid}-list`} onClick={() => setAll((a) => !a)}>
              {all ? t.showLess : t.showAll(total)}
            </button>
          )}
          {list.length > 0 && (
            <ul id={`${uid}-list`} aria-label={t.comments(total)} className={cx("space-y-3", list.length > 2 ? "mt-1" : "mt-2", "mb-1")}>
              {shown.map((c) => (
                <li key={c.id} className="group grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5">
                  <Monogram name={c.author.first_name} seed={c.author.id} photo={c.author.avatar_key} size={24} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-body-sm leading-normal break-words whitespace-pre-wrap">
                      <span className="font-semibold">{c.author.first_name}</span>{" "}
                      <span className="text-ink-2">{c.body}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 text-caption text-muted">
                      <time dateTime={new Date(c.created_at).toISOString()} suppressHydrationWarning>{ago(c.created_at, l)}</time>
                      {c.canDelete && (
                        <button type="button" aria-label={t.removeComment(c.author.first_name)} onClick={() => remove(c)}
                          className="min-h-11 [@media(pointer:fine)]:min-h-7 inline-flex items-center hover:text-ink hover:underline underline-offset-4">{t.remove}</button>
                      )}
                      {/* Fremde Kommentare lassen sich melden – eigene kann man entfernen */}
                      {c.author.id !== me && (reported.has(c.id)
                        ? <span>{t.reported}</span>
                        : (
                          <button type="button" onClick={() => onReport("circle_post_comment", c.id)}
                            className="min-h-11 [@media(pointer:fine)]:min-h-7 inline-flex items-center gap-1 hover:text-ink opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                            <IconFlag width={12} height={12} aria-hidden />{t.report}
                          </button>
                        ))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Presence show={open}>
            <form id={`${uid}-form`} onSubmit={send} className="mt-2 pb-1">
              <label htmlFor={`${uid}-c`} className="sr-only">{t.commentLabel}</label>
              <textarea id={`${uid}-c`} ref={input} rows={2} value={draft} maxLength={max} placeholder={t.commentPlaceholder} aria-describedby={`${uid}-n`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape" && !draft) { setOpen(false); opener.current?.focus(); } }}
                className="w-full min-h-11 bg-paper border border-field rounded-sm px-3 py-2 text-body leading-normal placeholder:text-muted hover:border-ink-2 focus:outline-none focus:border-ink focus:ring-[3px] focus:ring-ink/10 transition-[border-color,box-shadow] duration-fast" />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <Counter id={`${uid}-n`} len={draft.length} max={max} t={t} always={false} />
                <Button type="submit" variant="ghost" size="sm" className={cx(TAP, "ml-auto")} disabled={busy || !draft.trim()}>{t.send}</Button>
              </div>
            </form>
          </Presence>
      </div>
    </>
  );
}
