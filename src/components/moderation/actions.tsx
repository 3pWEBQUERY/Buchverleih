"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { useLater } from "@/components/use-later";
import { Button, Field, Input, Switch, Textarea, cx } from "@/components/ui";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Etwas ist schiefgelaufen. Versuche es erneut.");
const dangerCls = "inline-flex items-center justify-center font-medium rounded-[6px] border border-late/50 text-late hover:bg-late hover:text-paper hover:border-late transition-colors duration-200 disabled:opacity-45 whitespace-nowrap active:scale-[0.97]";
const mod = (body: Record<string, unknown>) => api("/mod", { body });

/** Zeile der Warteschlange: wird beim Erledigen ausgegraut, bis der Aufschub abläuft. */
function Pending({ pending, children, className }: { pending: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cx("transition-opacity duration-200", pending && "opacity-40 pointer-events-none", className)} aria-busy={pending ? true : undefined}>
      {pending ? <p className="text-sm text-muted h-9 flex items-center">{pending}</p> : children}
    </div>
  );
}

export function ReportActions({ id }: { id: string }) {
  const later = useLater();
  const [pending, setPending] = useState<string | null>(null);
  const act = (status: "actioned" | "dismissed") => {
    const text = status === "actioned" ? "Meldung als erledigt markiert." : "Meldung verworfen.";
    setPending(text);
    later(text, () => mod({ action: "report", reportId: id, status }), () => setPending(null));
  };
  return (
    <Pending pending={pending} className="flex items-center gap-2">
      <Button size="sm" onClick={() => act("actioned")}>Erledigt</Button>
      <Button variant="quiet" className="text-sm h-9 px-3" onClick={() => act("dismissed")}>Verwerfen</Button>
    </Pending>
  );
}

export function CorrectionActions({ id }: { id: string }) {
  const later = useLater();
  const [pending, setPending] = useState<string | null>(null);
  const act = (apply: boolean) => {
    const text = apply ? "Korrektur wird übernommen." : "Korrektur abgelehnt.";
    setPending(text);
    later(text, () => mod({ action: "correction", id, apply }), () => setPending(null));
  };
  return (
    <Pending pending={pending} className="flex items-center gap-2">
      <Button size="sm" onClick={() => act(true)}>Übernehmen</Button>
      <Button variant="quiet" className="text-sm h-9 px-3" onClick={() => act(false)}>Ablehnen</Button>
    </Pending>
  );
}

/** Feature-Schalter oder Region (key "__region"). Umkehrbar: sofort, mit «Rückgängig». */
export function FlagSwitch({ regionId, flagKey, label, hint, checked }: { regionId: string; flagKey: string; label: ReactNode; hint?: ReactNode; checked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(checked);
  useEffect(() => setOn(checked), [checked]);
  async function set(v: boolean, undoable = true) {
    setOn(v);
    try {
      await mod({ action: "flag", key: flagKey, regionId, enabled: v });
      router.refresh();
      if (undoable) toast.show({ text: `${typeof label === "string" ? label : "Schalter"}: ${v ? "an" : "aus"}.`, undo: () => set(!v, false) });
    } catch (e) {
      setOn(!v);
      toast.error(msg(e));
    }
  }
  return <Switch checked={on} onChange={(v) => set(v)} label={label} hint={hint} />;
}

const DECISIONS = {
  returned: { label: "Zurückgegeben", done: "Fall als zurückgegeben geschlossen." },
  replaced: { label: "Ersatz geleistet", done: "Fall mit Ersatz geschlossen." },
  rejected: { label: "Kein Schaden", done: "Fall ohne Schaden geschlossen." },
  lost: { label: "Verloren", done: "Fall als verloren geschlossen." },
} as const;
type Decision = keyof typeof DECISIONS;

export function CaseDecision({ caseId, kind }: { caseId: string; kind: "damage" | "nonreturn" }) {
  const later = useLater();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const options: Decision[] = kind === "damage" ? ["rejected", "replaced", "returned"] : ["returned", "replaced", "lost"];
  const decide = (d: Decision) => {
    setPending(DECISIONS[d].done);
    later(DECISIONS[d].done, () => mod({ action: "decide_case", caseId, decision: d, note: note.trim() || undefined }), () => setPending(null));
  };
  return (
    <Pending pending={pending} className="flex flex-col gap-4">
      <Field label="Notiz zum Entscheid" hint="Beide Seiten sehen den Entscheid. Die Notiz steht im Protokoll.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Grundlage: Fotos vom 3. Nov. zeigen …" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((d) => (
          d === "lost"
            ? <button key={d} type="button" onClick={() => decide(d)} className={cx(dangerCls, "h-9 px-4 text-[13.5px]")}>{DECISIONS[d].label}</button>
            : <Button key={d} size="sm" variant="ghost" onClick={() => decide(d)}>{DECISIONS[d].label}</Button>
        ))}
      </div>
    </Pending>
  );
}

export function BanControls({ userId, banned, reason }: { userId: string; banned: boolean; reason: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(v: boolean, why?: string, undoable = true) {
    setBusy(true);
    setError(null);
    try {
      await mod({ action: "ban", userId, banned: v, reason: why || undefined });
      router.refresh();
      setText("");
      if (undoable) toast.show({ text: v ? "Konto gesperrt." : "Konto entsperrt.", undo: () => set(!v, v ? undefined : reason ?? undefined, false) });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  if (banned) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px]"><span className="font-semibold text-late">Gesperrt</span>{reason ? <>: <span className="text-ink-2">{reason}</span></> : null}</p>
        <Button size="sm" variant="ghost" onClick={() => set(false)} disabled={busy}>Entsperren</Button>
        {error && <p className="text-sm text-late w-full" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) set(true, text.trim()); else setError("Gib einen Grund an. Die Person sieht ihn."); }}>
      <label htmlFor={`ban-${userId}`} className="block text-[13px] font-medium mb-2">Grund</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input id={`ban-${userId}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Wiederholte Preisangaben im Chat" />
        <button type="submit" disabled={busy} className={cx(dangerCls, "h-12 px-6 text-[15px] self-start sm:self-auto")}>Sperren</button>
      </div>
      {error ? <p className="text-sm text-late mt-1.5" role="alert">{error}</p>
        : <p className="text-sm text-muted mt-1.5">Die Person sieht den Grund. Die Mobilnummer wird mitgesperrt.</p>}
    </form>
  );
}

export function SuspendSwitch({ userId, suspended }: { userId: string; suspended: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(suspended);
  useEffect(() => setOn(suspended), [suspended]);
  async function set(v: boolean, undoable = true) {
    setOn(v);
    try {
      await mod({ action: "suspend", userId, suspended: v });
      router.refresh();
      if (undoable) toast.show({ text: v ? "Leihsperre gesetzt." : "Leihsperre aufgehoben.", undo: () => set(!v, false) });
    } catch (e) {
      setOn(!v);
      toast.error(msg(e));
    }
  }
  return <Switch checked={on} onChange={(v) => set(v)} label="Leihsperre" hint="Keine neuen Anfragen für Leihen und Tausch. Eigenes Regal bleibt offen." />;
}
