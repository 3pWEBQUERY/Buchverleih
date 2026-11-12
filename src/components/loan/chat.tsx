"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { ago, fmtDayTime } from "@/lib/dates";
import { Button, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { systemChatText } from "@/lib/i18n/messages/chat-system";
import { IconCalendar, IconCheck, IconFlag } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { htmlLang } from "@/lib/i18n/locale";
import { CHAT } from "@/lib/i18n/messages/loans-chat";

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

export function Chat({
  thread, me, initial, readOnly, memberCount = 2, defaultPlace, onEvent,
}: { thread: { loan?: string; chat?: string }; me: string; initial: Msg[]; readOnly?: boolean; memberCount?: number; defaultPlace?: string | null; onEvent?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [proposing, setProposing] = useState(false);
  const [place, setPlace] = useState(defaultPlace ?? "");
  const [when, setWhen] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const toast = useToast();
  const l = useLocale();
  const t = CHAT[l].chat;
  const qs = thread.loan ? `loan=${thread.loan}` : `chat=${thread.chat}`;

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ messages: Msg[] }>(`/messages?${qs}`);
      setMsgs(r.messages);
    } catch {}
  }, [qs]);

  useEffect(() => {
    const es = new EventSource(`/api/v1/stream?${qs}`);
    es.addEventListener("message", () => refresh());
    es.addEventListener("loan", () => onEvent?.());
    return () => es.close();
  }, [qs, refresh, onEvent]);

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (proposing && !when) return;
    if (!proposing && !text.trim()) return;
    const body = proposing
      ? { ...thread, body: text.trim() || null, proposalPlace: place || null, proposalAt: new Date(when).toISOString() }
      : { ...thread, body: text.trim() };
    const temp: Msg = {
      id: `tmp-${Date.now()}`, sender_id: me, sender_name: null, body: body.body ?? null, proposal_place: proposing ? place : null,
      proposal_at: proposing ? new Date(when).toISOString() : null, proposal_status: proposing ? "open" : null, proposal_accepted_by: [me],
      created_at: new Date().toISOString(), pending: true,
    };
    const before = { text, proposing, when, place };
    setMsgs((m) => [...m, temp]);
    setText("");
    setProposing(false);
    setWhen("");
    try {
      await api("/messages", { body });
      refresh();
    } catch (err) {
      // Nicht gesendet: Nachricht entfernen und das Getippte zurückgeben
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      setText((cur) => cur || before.text);
      setProposing(before.proposing);
      setWhen(before.when);
      setPlace(before.place);
      toast.error((err as Error).message);
    }
  }

  async function accept(id: string) {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, proposal_accepted_by: [...x.proposal_accepted_by, me], proposal_status: x.proposal_accepted_by.length + 1 >= memberCount ? "accepted" : x.proposal_status } : x)));
    try {
      await api(`/messages/${id}`, { method: "POST" });
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
      refresh();
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
          <p className="text-ink-2 text-[15px] mt-3 max-w-xs mx-auto">{t.empty}</p>
        </div>
      ) : (
        <ol ref={list} className="px-4 md:px-6 py-5 space-y-1 max-h-[62vh] overflow-y-auto overscroll-contain" role="log" aria-live="polite" aria-label={t.messages}>
          {msgs.map((m, i) => {
            const mine = m.sender_id === me;
            const prev = msgs[i - 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const firstOfGroup = newDay || !prev || prev.sender_id !== m.sender_id || !prev.sender_id;
            const sep = newDay ? (
              <li key={`d-${m.id}`} aria-hidden className="flex items-center gap-3 py-3 first:pt-0">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{dayLabel(m.created_at)}</span>
                <span className="h-px flex-1 bg-line" />
              </li>
            ) : null;
            if (!m.sender_id) {
              return [sep, <li key={m.id} className="flex justify-center py-2"><span className="chip !h-auto py-1 text-center !whitespace-normal">{systemChatText(m.body, l)}</span></li>];
            }
            return [sep, (
              <li key={m.id} className={cx("group flex flex-col max-w-[85%] md:max-w-[75%] anim-rise", mine ? "ml-auto items-end" : "items-start", firstOfGroup && !newDay && "pt-3", m.pending && "opacity-60")}>
                {firstOfGroup && <span className="text-[12px] text-muted mb-1 px-1">{mine ? t.you : m.sender_name}</span>}
                {m.proposal_at && (
                  <div className={cx(
                    "rounded-[12px] w-72 max-w-full overflow-hidden border transition-colors",
                    m.proposal_status === "accepted" ? "border-ok bg-paper" : m.proposal_status === "countered" ? "border-line bg-paper opacity-60" : "border-accent/50 bg-paper",
                  )}>
                    <div className="px-4 pt-3.5 pb-3">
                      <p className="eyebrow flex items-center gap-1.5"><IconCalendar width={14} height={14} /> {t.proposal}</p>
                      <p className={cx("font-[520] tracking-[-0.035em] text-[24px] leading-tight mt-2 tnum", m.proposal_status === "countered" && "line-through decoration-1")}>{fmtDayTime(m.proposal_at, l)}</p>
                      {m.proposal_place && <p className="text-[14.5px] text-ink-2 mt-0.5">{m.proposal_place}</p>}
                    </div>
                    <div className={cx("px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13.5px] border-t", m.proposal_status === "accepted" ? "border-ok/40 bg-ok/[0.07]" : "border-line bg-paper-2")}>
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
                    "px-4 py-2.5 rounded-[12px] text-[15px] leading-snug whitespace-pre-wrap break-words",
                    m.proposal_at && "mt-1",
                    mine ? "bg-accent-soft text-ink rounded-br-[4px]" : "bg-paper-2 text-ink rounded-bl-[4px]",
                  )}>{m.body}</p>
                )}
                <span className="flex items-center gap-2 mt-1 px-1 text-[11.5px] text-muted">
                  <time dateTime={m.created_at}>{m.pending ? t.sending : ago(m.created_at, l)}</time>
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
      )}

      {readOnly ? (
        <p className="text-sm text-muted border-t border-line px-5 md:px-6 py-4">{t.closed}</p>
      ) : (
        <form onSubmit={send} className="border-t border-line px-3 md:px-4 pt-3 pb-3">
          {proposing && (
            <div className="grid sm:grid-cols-2 gap-3 mb-3 p-3 rounded-[8px] bg-paper-2 anim-rise">
              <label className="block">
                <span className="block text-[13px] font-semibold mb-1.5">{t.dateTime}</span>
                <Input type="datetime-local" required min={minLocal} value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-[13px] font-semibold mb-1.5">{t.place}</span>
                <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t.placePlaceholder} maxLength={120} />
              </label>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-[8px] border border-line-strong bg-paper p-1 focus-within:border-accent transition-[border-color]">
            <button type="button" onClick={() => setProposing((p) => !p)} aria-pressed={proposing}
              className={cx("h-10 w-10 flex-none grid place-items-center rounded-[6px] transition-colors", proposing ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-paper-2")}
              aria-label={t.propose} title={t.propose}>
              <IconCalendar />
            </button>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={proposing ? t.note : t.message} maxLength={2000} aria-label={t.message}
              className="flex-1 min-w-0 h-10 bg-transparent px-1.5 text-[16px] placeholder:text-muted/70 focus:outline-none focus-visible:outline-none" />
            <Button type="submit" variant="secondary" className="h-10 px-4 flex-none">{proposing ? t.submitPropose : t.send}</Button>
          </div>
          <p className="text-[12px] text-muted mt-2 px-2">{t.safety}</p>
        </form>
      )}
    </div>
  );
}
