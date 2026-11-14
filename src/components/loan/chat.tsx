"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { ago, fmtDayTime } from "@/lib/dates";
import { Button, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Presence } from "@/components/motion";
import { systemChatText } from "@/lib/i18n/messages/chat-system";
import { IconCalendar, IconCheck, IconFlag } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { htmlLang } from "@/lib/i18n/locale";
import { CHAT } from "@/lib/i18n/messages/loans-chat";
import type { QuickSet } from "@/lib/loans/next";

/**
 * Chat im Vorgang bzw. Übergabe-Chat (PRD 4.10, 7.4). Terminvorschläge sind antippbare Karten
 * mit Annehmen und Gegenvorschlag. Echtzeit über Server-Sent Events, Nachrichten optimistisch.
 */
type Msg = {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  body: string | null;
  proposal_place: string | null;
  proposal_at: string | null;
  proposal_status: "open" | "accepted" | "countered" | "withdrawn" | null;
  proposal_accepted_by: string[];
  created_at: string;
  pending?: boolean;
};

type Read = { user_id: string; last_read_at: string | null };

/** Liste nach ID zusammenführen: Bekanntes ersetzen, Neues anhängen, zeitlich sortiert */
function merge(list: Msg[], incoming: Msg[]) {
  if (!incoming.length) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id));
}

const MAX_ROWS = 6;

export function Chat({
  thread, me, initial, initialReads = [], quick, readOnly, memberCount = 2, defaultPlace, onEvent,
}: {
  thread: { loan?: string; chat?: string }; me: string; initial: Msg[]; readOnly?: boolean; memberCount?: number; defaultPlace?: string | null; onEvent?: () => void;
  /** Lesestand der anderen Beteiligten (für «Gelesen» unter der letzten eigenen Nachricht) */
  initialReads?: Read[];
  /** Schnellantworten passend zum Zustand des Vorgangs (lib/loans/next.ts: quickReplySet) */
  quick?: QuickSet | null;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [proposing, setProposing] = useState(false);
  const [place, setPlace] = useState(defaultPlace ?? "");
  const [when, setWhen] = useState("");
  const [unseen, setUnseen] = useState(0);
  const [reads, setReads] = useState<Read[]>(initialReads);
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const atEnd = useRef(true);
  const known = useRef(msgs);
  /** Was beim Laden schon da war, steht still; nur neu Eintreffendes steigt auf */
  const [seen] = useState(() => new Set(initial.map((m) => m.id)));
  const toast = useToast();
  const l = useLocale();
  const t = CHAT[l].chat;
  const qs = thread.loan ? `loan=${thread.loan}` : `chat=${thread.chat}`;

  useEffect(() => { known.current = msgs; }, [msgs]);

  const toEnd = useCallback(() => {
    const el = list.current;
    // Nur die Nachrichtenliste bewegen – scrollIntoView würde auch die Seite verschieben
    if (el) el.scrollTop = el.scrollHeight;
    atEnd.current = true;
    setUnseen(0);
  }, []);

  /** Lesestand melden: nur, wenn die Seite sichtbar ist und die Person das Ende der Liste sieht */
  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible" || !atEnd.current) return;
    const last = [...known.current].reverse().find((m) => !m.pending);
    if (!last || last.sender_id === me) return;
    api("/messages/read", { body: { ...thread, upTo: last.id } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, thread.loan, thread.chat]);

  /** Neues von anderen: am Ende mitlaufen, sonst nur zählen (Pille «Neue Nachrichten») */
  const arrived = useCallback((incoming: Msg[]) => {
    const fresh = incoming.filter((m) => !known.current.some((k) => k.id === m.id));
    setMsgs((cur) => merge(cur, incoming));
    if (!fresh.length) return;
    if (atEnd.current) requestAnimationFrame(() => { toEnd(); markRead(); });
    else setUnseen((n) => n + fresh.filter((m) => m.sender_id !== me).length);
  }, [me, toEnd, markRead]);

  /** Inkrementell: nur Nachrichten nach der letzten bestätigten; eine bekannte ID wird einzeln nachgeladen */
  const load = useCallback(async (changedId?: string) => {
    try {
      const confirmed = known.current.filter((m) => !m.pending);
      if (changedId && confirmed.some((m) => m.id === changedId)) {
        const r = await api<{ messages: Msg[] }>(`/messages?${qs}&id=${changedId}`);
        setMsgs((cur) => merge(cur, r.messages));
        return;
      }
      const last = confirmed[confirmed.length - 1];
      const r = await api<{ messages: Msg[] }>(`/messages?${qs}${last ? `&after=${last.id}` : ""}`);
      arrived(r.messages);
    } catch {}
  }, [qs, arrived]);

  useEffect(() => {
    const es = new EventSource(`/api/v1/stream?${qs}`);
    let opened = false;
    es.addEventListener("message", (e) => {
      let id: string | undefined;
      try { id = JSON.parse((e as MessageEvent).data).id; } catch {}
      load(id);
    });
    es.addEventListener("loan", () => onEvent?.());
    es.addEventListener("read", (e) => {
      try {
        const r = JSON.parse((e as MessageEvent).data) as Read;
        if (r.user_id !== me) setReads((cur) => [...cur.filter((x) => x.user_id !== r.user_id), { user_id: r.user_id, last_read_at: r.last_read_at }]);
      } catch {}
    });
    // Nach einem Verbindungsabbruch nachholen, was in der Lücke kam
    es.addEventListener("ready", () => { if (opened) load(); opened = true; });
    return () => es.close();
  }, [qs, load, onEvent, me]);

  // Beim ersten Zeichnen ans Ende der Liste; gelesen ist, was sichtbar war
  useEffect(() => {
    toEnd();
    markRead();
    const onVisible = () => markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [toEnd, markRead]);

  // Eingabefeld wächst mit dem Text, höchstens sechs Zeilen
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const pad = el.offsetHeight - el.clientHeight + parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_ROWS + pad)}px`;
  }, [text, proposing]);

  async function send(e?: React.FormEvent, quickText?: string) {
    e?.preventDefault();
    if (!quickText && proposing && !when) return;
    if (!quickText && !proposing && !text.trim()) return;
    const body = quickText ? { ...thread, body: quickText }
      : proposing
      ? { ...thread, body: text.trim() || null, proposalPlace: place || null, proposalAt: new Date(when).toISOString() }
      : { ...thread, body: text.trim() };
    const temp: Msg = {
      id: `tmp-${Date.now()}`, sender_id: me, sender_name: null, body: body.body ?? null, proposal_place: proposing && !quickText ? place : null,
      proposal_at: proposing && !quickText ? new Date(when).toISOString() : null, proposal_status: proposing && !quickText ? "open" : null, proposal_accepted_by: [me],
      created_at: new Date().toISOString(), pending: true,
    };
    const before = { text, proposing, when, place };
    setMsgs((m) => [...m, temp]);
    if (!quickText) {
      setText("");
      setProposing(false);
      setWhen("");
    }
    requestAnimationFrame(toEnd);
    try {
      const r = await api<{ id: string }>("/messages", { body });
      // Optimistische Nachricht per ID abgleichen: kam die echte schon über den Stream, fällt die vorläufige weg
      setMsgs((m) => (m.some((x) => x.id === r.id)
        ? m.filter((x) => x.id !== temp.id)
        : m.map((x) => (x.id === temp.id ? { ...x, id: r.id, pending: false } : x))));
      // Ein neuer Vorschlag ersetzt offene ältere: deren Zustand kommt über den Stream nach
    } catch (err) {
      // Nicht gesendet: Nachricht entfernen und das Getippte zurückgeben
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      if (!quickText) {
        setText((cur) => cur || before.text);
        setProposing(before.proposing);
        setWhen(before.when);
        setPlace(before.place);
      }
      toast.error((err as Error).message);
    }
  }

  /** Enter sendet, Umschalt+Enter bricht um. Auf Touch-Geräten sendet nur der Knopf. */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    send();
  }

  async function accept(id: string) {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, proposal_accepted_by: [...x.proposal_accepted_by, me], proposal_status: x.proposal_accepted_by.length + 1 >= memberCount ? "accepted" : x.proposal_status } : x)));
    try {
      await api(`/messages/${id}`, { method: "POST" });
      load(id);
    } catch (err) {
      toast.error((err as Error).message);
      load(id);
    }
  }

  async function report(id: string) {
    try {
      await api("/reports", { body: { targetType: "message", targetId: id, reason: "harassment" } });
      toast.show({ text: t.reported });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const minDate = new Date(Date.now() + 15 * 60_000);
  const minLocal = new Date(minDate.getTime() - minDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  // «Gelesen»: alle anderen Beteiligten haben bis zu meiner letzten Nachricht gelesen
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === me && !m.pending);
  const lastMineRead = lastMine && reads.length > 0 && reads.every((r) => r.last_read_at && r.last_read_at >= lastMine.created_at) ? lastMine.id : null;

  // Aufeinanderfolgende Nachrichten derselben Person werden gruppiert; Tageswechsel als Trenner
  const dayKey = (d: string) => new Date(d).toDateString();
  const dayLabel = (d: string) => {
    const k = dayKey(d);
    if (k === new Date().toDateString()) return t.today;
    if (k === new Date(Date.now() - 86400_000).toDateString()) return t.yesterday;
    return new Intl.DateTimeFormat(htmlLang[l], { weekday: "long", day: "numeric", month: "long" }).format(new Date(d));
  };

  return (
    <div className="flex flex-col">
      {msgs.length === 0 ? (
        <div className="px-5 md:px-6 py-10 text-center">
          <span aria-hidden className="mx-auto h-11 w-11 rounded-full bg-paper-2 grid place-items-center text-ink-2"><IconCalendar /></span>
          <p className="text-ink-2 text-body mt-3 max-w-xs mx-auto">{t.empty}</p>
        </div>
      ) : (
        <div className="relative">
        <div role="log" aria-live="polite" aria-label={t.messages}>
        <ol ref={list} tabIndex={0} aria-label={t.messages} className="px-4 md:px-6 py-5 space-y-1 max-h-[62vh] overflow-y-auto overscroll-contain"
          onScroll={(e) => {
            const el = e.currentTarget;
            atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            if (atEnd.current && unseen) { setUnseen(0); markRead(); }
          }}>
          {msgs.map((m, i) => {
            const mine = m.sender_id === me;
            const prev = msgs[i - 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const firstOfGroup = newDay || !prev || prev.sender_id !== m.sender_id || !prev.sender_id;
            const sep = newDay ? (
              <li key={`d-${m.id}`} aria-hidden className="flex items-center gap-3 py-3 first:pt-0">
                <span className="h-px flex-1 bg-line" />
                <span className="text-caption font-semibold uppercase tracking-caps text-muted">{dayLabel(m.created_at)}</span>
                <span className="h-px flex-1 bg-line" />
              </li>
            ) : null;
            if (!m.sender_id) {
              return [sep, <li key={m.id} className="flex justify-center py-2"><span className="chip !h-auto py-1 text-center !whitespace-normal">{systemChatText(m.body, l)}</span></li>];
            }
            return [sep, (
              <li key={m.id} className={cx("group flex flex-col max-w-[85%] md:max-w-[75%]", !seen.has(m.id) && "anim-rise", mine ? "ml-auto items-end" : "items-start", firstOfGroup && !newDay && "pt-3", m.pending && "opacity-60")}>
                {firstOfGroup && <span className="text-caption text-muted mb-1 px-1">{mine ? t.you : m.sender_name}</span>}
                {m.proposal_at && (
                  <div className={cx(
                    "rounded-lg w-72 max-w-full overflow-hidden border transition-colors",
                    m.proposal_status === "accepted" ? "border-ok bg-paper" : m.proposal_status === "countered" ? "border-line bg-paper opacity-60" : "border-accent/50 bg-paper",
                  )}>
                    <div className="px-4 pt-3.5 pb-3">
                      <p className="eyebrow flex items-center gap-1.5"><IconCalendar width={14} height={14} /> {t.proposal}</p>
                      <p className={cx("font-title tracking-title text-title leading-tight mt-2 tnum", m.proposal_status === "countered" && "line-through decoration-1")}>{fmtDayTime(m.proposal_at, l)}</p>
                      {m.proposal_place && <p className="text-body-sm text-ink-2 mt-0.5">{m.proposal_place}</p>}
                    </div>
                    <div className={cx("px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm border-t", m.proposal_status === "accepted" ? "border-ok/40 bg-ok/[0.07]" : "border-line bg-paper-2")}>
                      {m.proposal_status === "accepted" && (
                        <>
                          <span className="text-ok font-semibold inline-flex items-center gap-1"><IconCheck width={15} height={15} /> {t.agreed}</span>
                          <a href={`/api/v1/messages/${m.id}/ics`} className="ml-auto font-medium underline underline-offset-4">{t.toCalendar}</a>
                        </>
                      )}
                      {m.proposal_status === "countered" && <span className="text-muted">{t.replaced}</span>}
                      {m.proposal_status === "open" && !m.proposal_accepted_by.includes(me) && !readOnly && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => accept(m.id)}>{t.accept}</Button>
                          <button className="font-medium underline underline-offset-4 min-h-9" onClick={() => { setProposing(true); setPlace(m.proposal_place ?? ""); }}>{t.counter}</button>
                        </>
                      )}
                      {m.proposal_status === "open" && m.proposal_accepted_by.includes(me) && (
                        <span className="text-muted inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait live-dot" />{memberCount > 2 ? t.acceptedOf(m.proposal_accepted_by.length, memberCount) : t.waiting}</span>
                      )}
                    </div>
                  </div>
                )}
                {m.body && (
                  <p className={cx(
                    "px-4 py-2.5 rounded-lg text-body leading-snug whitespace-pre-wrap break-words",
                    m.proposal_at && "mt-1",
                    mine ? "bg-accent-soft text-ink rounded-br-xs" : "bg-paper-2 text-ink rounded-bl-xs",
                  )}>{m.body}</p>
                )}
                <span className="flex items-center gap-2 mt-1 px-1 text-caption text-muted">
                  <time dateTime={m.created_at}>{m.pending ? t.sending : ago(m.created_at, l)}</time>
                  {m.id === lastMineRead && <span className="inline-flex items-center gap-1 text-ink-2"><IconCheck width={12} height={12} aria-hidden />{t.read}</span>}
                  {!mine && !m.pending && (
                    <button onClick={() => report(m.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 inline-flex items-center gap-1 min-h-8 hover:text-ink transition-opacity">
                      <IconFlag width={12} height={12} /> {t.report}
                    </button>
                  )}
                </span>
              </li>
            )];
          })}
        </ol>
        </div>
        {unseen > 0 && (
          <button type="button" onClick={toEnd}
            className="press anim-sheet absolute left-1/2 -translate-x-1/2 bottom-3 h-9 px-4 rounded-full bg-ink text-paper text-meta font-medium inline-flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />{t.newMessages(unseen)}
          </button>
        )}
        </div>
      )}

      {readOnly ? (
        <p className="text-body-sm text-muted border-t border-line px-5 md:px-6 py-4">{t.closed}</p>
      ) : (
        <form onSubmit={send} className="border-t border-line px-3 md:px-4 pt-3 pb-3">
          <Presence show={proposing}>
            <div className="grid sm:grid-cols-2 gap-3 mb-3 p-3 rounded-md bg-paper-2">
              <label className="block">
                <span className="block text-meta font-semibold mb-1.5">{t.dateTime}</span>
                <Input type="datetime-local" required={proposing} min={minLocal} value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-meta font-semibold mb-1.5">{t.place}</span>
                <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t.placePlaceholder} maxLength={120} />
              </label>
            </div>
          </Presence>
          {quick && !proposing && !text && (
            <ul aria-label={t.quickLabel} className="flex gap-2 mb-2.5 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap [scrollbar-width:none]">
              {t.quick[quick].map((q) => (
                <li key={q} className="flex-none">
                  <button type="button" onClick={() => send(undefined, q)}
                    className="press h-11 md:h-9 px-3.5 rounded-full border border-field text-body-sm font-medium text-ink-2 hover:border-ink hover:text-ink whitespace-nowrap">{q}</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-1.5 rounded-md border border-field bg-paper p-1 focus-within:border-accent transition-[border-color]">
            <button type="button" onClick={() => setProposing((p) => !p)} aria-pressed={proposing}
              className={cx("press h-10 w-10 flex-none grid place-items-center rounded-sm", proposing ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-paper-2")}
              aria-label={t.propose} title={t.propose}>
              <IconCalendar />
            </button>
            <textarea ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
              placeholder={proposing ? t.note : t.message} maxLength={2000} aria-label={t.message} aria-describedby="chat-hint" enterKeyHint="enter"
              className="flex-1 min-w-0 min-h-10 resize-none bg-transparent px-1.5 py-2 text-body-lg leading-normal placeholder:text-muted focus:outline-none focus-visible:outline-none" />
            <Button type="submit" variant="secondary" className="h-10 px-4 flex-none">{proposing ? t.submitPropose : t.send}</Button>
          </div>
          <p id="chat-hint" className="hidden [@media(pointer:fine)]:block text-caption text-muted mt-2 px-2">{t.enterHint}</p>
          <p className="text-caption text-muted mt-2 px-2">{t.safety}</p>
        </form>
      )}
    </div>
  );
}
