"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { ago, fmtDayTime } from "@/lib/dates";
import { Button, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { IconCalendar, IconFlag } from "@/components/icons";

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
    setMsgs((m) => [...m, temp]);
    setText("");
    setProposing(false);
    setWhen("");
    try {
      await api("/messages", { body });
      refresh();
    } catch (err) {
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
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
      toast.show({ text: "Gemeldet. Die Moderation sieht es sich an." });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const minDate = new Date(Date.now() + 15 * 60_000);
  const minLocal = new Date(minDate.getTime() - minDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <div>
      {msgs.length === 0 ? (
        <p className="text-muted text-[15px] py-4">Noch keine Nachrichten. Schlag einen Termin vor, das geht am schnellsten.</p>
      ) : (
        <ol ref={list} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1" aria-live="polite">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            if (!m.sender_id) {
              return <li key={m.id} className="text-center text-sm text-muted py-1">{m.body}</li>;
            }
            return (
              <li key={m.id} className={cx("group flex flex-col max-w-[85%]", mine ? "ml-auto items-end" : "items-start", m.pending && "opacity-60")}>
                <span className="text-xs text-muted mb-1">{mine ? "Du" : m.sender_name} · {ago(m.created_at)}</span>
                {m.proposal_at && (
                  <div className={cx("border rounded-sm px-4 py-3 w-72 max-w-full", m.proposal_status === "accepted" ? "border-ok" : m.proposal_status === "countered" ? "border-line opacity-60" : "border-ink")}>
                    <p className="eyebrow flex items-center gap-1.5"><IconCalendar width={14} height={14} /> Terminvorschlag</p>
                    <p className="font-serif text-xl mt-1.5">{fmtDayTime(m.proposal_at)}</p>
                    {m.proposal_place && <p className="text-[15px] text-ink-2">{m.proposal_place}</p>}
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      {m.proposal_status === "accepted" && (
                        <>
                          <span className="text-ok font-medium">Vereinbart</span>
                          <a href={`/api/v1/messages/${m.id}/ics`} className="underline underline-offset-4">In den Kalender</a>
                        </>
                      )}
                      {m.proposal_status === "countered" && <span className="text-muted">Ersetzt durch einen neuen Vorschlag</span>}
                      {m.proposal_status === "open" && !m.proposal_accepted_by.includes(me) && !readOnly && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => accept(m.id)}>Annehmen</Button>
                          <button className="underline underline-offset-4" onClick={() => { setProposing(true); setPlace(m.proposal_place ?? ""); }}>Gegenvorschlag</button>
                        </>
                      )}
                      {m.proposal_status === "open" && m.proposal_accepted_by.includes(me) && (
                        <span className="text-muted">{memberCount > 2 ? `${m.proposal_accepted_by.length} von ${memberCount} haben angenommen` : "Wartet auf Antwort"}</span>
                      )}
                    </div>
                  </div>
                )}
                {m.body && (
                  <p className={cx("px-3.5 py-2 rounded-sm text-[15px] whitespace-pre-wrap break-words", m.proposal_at && "mt-1.5", mine ? "bg-ink text-paper" : "bg-paper-3")}>{m.body}</p>
                )}
                {!mine && !m.pending && (
                  <button onClick={() => report(m.id)} className="mt-1 text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1">
                    <IconFlag width={12} height={12} /> Melden
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {readOnly ? (
        <p className="text-sm text-muted mt-6 border-t border-line pt-4">Dieser Chat ist geschlossen.</p>
      ) : (
        <form onSubmit={send} className="mt-6 border-t border-line pt-4">
          {proposing && (
            <div className="grid sm:grid-cols-2 gap-3 mb-3 anim-rise">
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Datum und Zeit</span>
                <Input type="datetime-local" required min={minLocal} value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Ort</span>
                <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="z. B. Bahnhof, beim Kiosk" maxLength={120} />
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setProposing((p) => !p)} aria-pressed={proposing}
              className={cx("h-11 w-11 flex-none grid place-items-center rounded-sm border transition-colors", proposing ? "bg-ink text-paper border-ink" : "border-line-strong hover:border-ink")}
              aria-label="Termin vorschlagen" title="Termin vorschlagen">
              <IconCalendar />
            </button>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={proposing ? "Notiz zum Termin (freiwillig)" : "Nachricht"} maxLength={2000} aria-label="Nachricht" />
            <Button type="submit" variant="secondary" className="h-11 flex-none">{proposing ? "Vorschlagen" : "Senden"}</Button>
          </div>
          <p className="text-xs text-muted mt-2">Treffpunkte an öffentlichen Orten sind die sicherste Wahl. Telefonnummer und Adresse teilst du nur, wenn du willst.</p>
        </form>
      )}
    </div>
  );
}
