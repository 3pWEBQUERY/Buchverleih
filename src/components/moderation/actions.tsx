"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { useLater } from "@/components/use-later";
import { Button, Field, Input, Switch, Textarea, cx } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { MOD } from "@/lib/i18n/messages/moderation";

/** Texte der Aktionen in der Sprache der Person */
const useT = () => MOD[useLocale()].actions;
const msg = (e: unknown, t: { error: string }) => (e instanceof Error ? e.message : t.error);
const dangerCls = "inline-flex items-center justify-center font-medium rounded-sm border border-late/50 text-late hover:bg-late hover:text-paper hover:border-late transition-colors duration-fast disabled:opacity-45 whitespace-nowrap active:scale-[0.97]";
const mod = (body: Record<string, unknown>) => api("/mod", { body });

/** Zeile der Warteschlange: wird beim Erledigen ausgegraut, bis der Aufschub abläuft. */
function Pending({ pending, children, className }: { pending: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cx("transition-opacity duration-fast", pending && "opacity-40 pointer-events-none", className)} aria-busy={pending ? true : undefined}>
      {pending ? <p className="text-body-sm text-muted h-9 flex items-center">{pending}</p> : children}
    </div>
  );
}

export function ReportActions({ id }: { id: string }) {
  const t = useT();
  const later = useLater();
  const [pending, setPending] = useState<string | null>(null);
  const act = (status: "actioned" | "dismissed") => {
    const text = status === "actioned" ? t.reportDone : t.reportDismissed;
    setPending(text);
    later(text, () => mod({ action: "report", reportId: id, status }), () => setPending(null));
  };
  return (
    <Pending pending={pending} className="flex items-center gap-2">
      <Button size="sm" onClick={() => act("actioned")}>{t.done}</Button>
      <Button variant="quiet" className="text-body-sm h-9 px-3" onClick={() => act("dismissed")}>{t.dismiss}</Button>
    </Pending>
  );
}

/** Gemeldeten Zettel, Kommentar oder Zettel im Buch ausblenden bzw. wieder zeigen (umkehrbar, darum ohne Rückfrage) */
export function HideContent({ targetType, targetId, hidden }: { targetType: string; targetId: string; hidden: boolean }) {
  const l = useLocale();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = { de: ["Inhalt ausblenden", "Wieder zeigen"], fr: ["Masquer le contenu", "Afficher à nouveau"], it: ["Nascondi il contenuto", "Mostra di nuovo"], en: ["Hide content", "Show again"] }[l];
  return (
    <button type="button" disabled={busy} className="min-h-9 text-body-sm font-medium underline underline-offset-4 hover:text-accent-hover disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        try { await mod({ action: "hide_content", targetType, targetId, hidden: !hidden }); router.refresh(); }
        catch (e) { toast.error(msg(e, t)); } finally { setBusy(false); }
      }}>
      {hidden ? label[1] : label[0]}
    </button>
  );
}

export function CorrectionActions({ id }: { id: string }) {
  const t = useT();
  const later = useLater();
  const [pending, setPending] = useState<string | null>(null);
  const act = (apply: boolean) => {
    const text = apply ? t.correctionApply : t.correctionReject;
    setPending(text);
    later(text, () => mod({ action: "correction", id, apply }), () => setPending(null));
  };
  return (
    <Pending pending={pending} className="flex items-center gap-2">
      <Button size="sm" onClick={() => act(true)}>{t.apply}</Button>
      <Button variant="quiet" className="text-body-sm h-9 px-3" onClick={() => act(false)}>{t.reject}</Button>
    </Pending>
  );
}

/** Feature-Schalter oder Region (key "__region"). Umkehrbar: sofort, mit «Rückgängig». */
export function FlagSwitch({ flagKey, label, hint, checked }: { flagKey: string; label: ReactNode; hint?: ReactNode; checked: boolean }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(checked);
  useEffect(() => setOn(checked), [checked]);
  async function set(v: boolean, undoable = true) {
    setOn(v);
    try {
      await mod({ action: "flag", key: flagKey, enabled: v });
      router.refresh();
      if (undoable) toast.show({ text: `${typeof label === "string" ? label : t.flag}: ${v ? t.on : t.off}.`, undo: () => set(!v, false) });
    } catch (e) {
      setOn(!v);
      toast.error(msg(e, t));
    }
  }
  return <Switch checked={on} onChange={(v) => set(v)} label={label} hint={hint} />;
}

type Decision = "returned" | "replaced" | "rejected" | "lost";

export function CaseDecision({ caseId, kind }: { caseId: string; kind: "damage" | "nonreturn" }) {
  const t = useT();
  const later = useLater();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const options: Decision[] = kind === "damage" ? ["rejected", "replaced", "returned"] : ["returned", "replaced", "lost"];
  const decide = (d: Decision) => {
    setPending(t.decisions[d][1]);
    later(t.decisions[d][1], () => mod({ action: "decide_case", caseId, decision: d, note: note.trim() || undefined }), () => setPending(null));
  };
  return (
    <Pending pending={pending} className="flex flex-col gap-4">
      <Field label={t.noteLabel} hint={t.noteHint}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t.notePlaceholder} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((d) => (
          d === "lost"
            ? <button key={d} type="button" onClick={() => decide(d)} className={cx(dangerCls, "h-9 px-4 text-body-sm")}>{t.decisions[d][0]}</button>
            : <Button key={d} size="sm" variant="ghost" onClick={() => decide(d)}>{t.decisions[d][0]}</Button>
        ))}
      </div>
    </Pending>
  );
}

export function BanControls({ userId, banned, reason }: { userId: string; banned: boolean; reason: string | null }) {
  const t = useT();
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
      if (undoable) toast.show({ text: v ? t.banned : t.unbanned, undo: () => set(!v, v ? undefined : reason ?? undefined, false) });
    } catch (e) {
      setError(msg(e, t));
    } finally {
      setBusy(false);
    }
  }

  if (banned) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body"><span className="font-semibold text-late">{t.bannedLabel}</span>{reason ? <>: <span className="text-ink-2">{reason}</span></> : null}</p>
        <Button size="sm" variant="ghost" onClick={() => set(false)} disabled={busy}>{t.unban}</Button>
        {error && <p className="text-body-sm text-late w-full" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) set(true, text.trim()); else setError(t.needReason); }}>
      <label htmlFor={`ban-${userId}`} className="block text-meta font-medium mb-2">{t.reason}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input id={`ban-${userId}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={t.reasonPlaceholder} />
        <button type="submit" disabled={busy} className={cx(dangerCls, "h-12 px-6 text-body self-start sm:self-auto")}>{t.ban}</button>
      </div>
      {error ? <p className="text-body-sm text-late mt-1.5" role="alert">{error}</p>
        : <p className="text-body-sm text-muted mt-1.5">{t.banHint}</p>}
    </form>
  );
}

export function SuspendSwitch({ userId, suspended }: { userId: string; suspended: boolean }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(suspended);
  useEffect(() => setOn(suspended), [suspended]);
  async function set(v: boolean, undoable = true) {
    setOn(v);
    try {
      await mod({ action: "suspend", userId, suspended: v });
      router.refresh();
      if (undoable) toast.show({ text: v ? t.suspended : t.unsuspended, undo: () => set(!v, false) });
    } catch (e) {
      setOn(!v);
      toast.error(msg(e, t));
    }
  }
  return <Switch checked={on} onChange={(v) => set(v)} label={t.suspend} hint={t.suspendHint} />;
}

/** Unpassendes Profilbild entfernen (Regeln: Fotos). Wird protokolliert. */
export function RemoveAvatar({ userId }: { userId: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        await mod({ action: "remove_avatar", userId });
        toast.show({ text: t.avatarRemoved });
        router.refresh();
      } catch (e) {
        toast.error(msg(e, t));
      } finally {
        setBusy(false);
      }
    }}>{t.removeAvatar}</Button>
  );
}

/** Admins: Moderationsrechte vergeben oder entziehen. Wird protokolliert. */
export function RoleControl({ userId, role, name }: { userId: string; role: string; name: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isMod = role === "moderator";
  async function set(next: "member" | "moderator") {
    setBusy(true);
    try {
      await mod({ action: "role", userId, role: next });
      toast.show({ text: next === "moderator" ? t.nowMod(name) : t.nowMember(name) });
      router.refresh();
    } catch (e) {
      toast.error(msg(e, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-body">{t.roleTitle}</p>
        <p className="text-meta text-muted mt-0.5">
          {isMod ? t.roleIsMod : t.roleCan}
        </p>
      </div>
      {isMod ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => set("member")}>{t.revoke}</Button>
      ) : (
        <Button variant="primary" size="sm" disabled={busy} onClick={() => set("moderator")}>{t.appoint}</Button>
      )}
    </div>
  );
}

/** Admins: Einmal-Passwort für Konten ohne Passwort. Wird nur einmal angezeigt und protokolliert. */
export function TempPasswordControl({ userId }: { userId: string }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  async function create() {
    setBusy(true);
    try {
      const r = await mod({ action: "temp_password", userId }) as { password: string };
      setPassword(r.password);
    } catch (e) {
      toast.error(msg(e, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-md">
        <p className="font-medium text-body">{t.pwTitle}</p>
        <p className="text-meta text-muted mt-0.5">{password ? t.pwShown : t.pwHint}</p>
      </div>
      {password ? (
        <code className="font-mono text-lead tracking-wide rounded-sm bg-paper-2 px-3 py-2 select-all">{password}</code>
      ) : (
        <Button variant="secondary" size="sm" disabled={busy} onClick={create}>{t.pwCreate}</Button>
      )}
    </div>
  );
}
