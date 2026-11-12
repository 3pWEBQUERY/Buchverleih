"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { trustLabel } from "@/lib/i18n/de-CH";
import { useToast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/kreise/faces";
import { CircleFields, type CircleValues } from "../circle-form";
const monthShort = new Intl.DateTimeFormat("de-CH", { month: "short", year: "numeric", timeZone: "Europe/Zurich" });

type Member = { user_id: string; first_name: string; avatar_key: string | null; role: string; status: string; trust_level: number; municipality: string | null; joined_at: string; books: number };

/** Sofort ausführen, aber erst nach der Rückgängig-Frist an die API senden (PRD 8.2). */
function useLater() {
  const toast = useToast();
  return (text: string, commit: () => Promise<void>, onUndo: () => void) => {
    const t = setTimeout(async () => {
      try {
        await commit();
      } catch (e) {
        onUndo();
        toast.error((e as Error).message);
      }
    }, 5000);
    toast.show({ text, undo: () => { clearTimeout(t); onUndo(); } }, 5000);
  };
}

export function InviteBox({ circleId, url, admin, appUrl }: { circleId: string; url: string | null; admin: boolean; appUrl: string }) {
  const toast = useToast();
  const [link, setLink] = useState(url);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ text: "Link kopiert. Schick ihn an die Leute, die dazugehören." }, 3000);
    } catch {
      input.current?.select();
      toast.error("Kopieren ging nicht. Der Link ist markiert, kopiere ihn von Hand.");
    }
  }

  async function renew() {
    setBusy(true);
    try {
      const r = await api<{ inviteCode: string }>(`/circles/${circleId}`, { method: "PATCH", body: { renewInvite: true } });
      setLink(`${appUrl}/k/${r.inviteCode}`);
      toast.show({ text: "Neuer Link erstellt. Der alte gilt nicht mehr." }, 4000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="einladen" className="rounded-[10px] border border-line p-5">
      <h2 id="einladen" className="text-[19px] font-[560] tracking-[-0.025em]">Einladen</h2>
      {link ? (
        <>
          <p className="text-[13.5px] text-muted mt-1 mb-4">Wer diesen Link öffnet, kann dem Kreis beitreten. Schick ihn nur an Leute, die dazugehören.</p>
          <input ref={input} readOnly value={link} aria-label="Einladungslink" onFocus={(e) => e.target.select()}
            className="w-full h-11 px-3.5 rounded-[6px] bg-paper-2 border border-line text-[13.5px] text-ink-2 tnum truncate focus:outline-none focus:border-accent transition-colors" />
          <Button type="button" variant="primary" onClick={copy} className="w-full mt-2">Link kopieren</Button>
          {admin && (
            <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-[13px] text-muted">Link in falschen Händen?</p>
              <Button variant="quiet" className="text-[13.5px] min-h-9" disabled={busy} onClick={renew}>Link erneuern</Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[14.5px] text-ink-2 mt-2">Neue Mitglieder lädt ein Admin ein. Frag im Kreis nach dem Link.</p>
      )}
    </section>
  );
}

export function MemberList({ circleId, me, admin, members }: { circleId: string; me: string; admin: boolean; members: Member[] }) {
  const router = useRouter();
  const toast = useToast();
  const later = useLater();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const visible = members.filter((m) => !gone.has(m.user_id));
  const pending = visible.filter((m) => m.status === "pending");
  const active = visible.filter((m) => m.status === "active");

  async function act(m: Member, action: "approve" | "make_admin") {
    setBusy(m.user_id);
    try {
      await api(`/circles/${circleId}`, { body: { memberId: m.user_id, action } });
      toast.show({ text: action === "approve" ? `${m.first_name} ist jetzt Mitglied.` : `${m.first_name} ist jetzt Admin.` }, 3000);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function remove(m: Member, decline = false) {
    setGone((g) => new Set(g).add(m.user_id));
    later(
      decline ? `Anfrage von ${m.first_name} abgelehnt.` : `${m.first_name} ist nicht mehr im Kreis.`,
      async () => {
        await api(`/circles/${circleId}`, { body: { memberId: m.user_id, action: "remove" } });
        router.refresh();
      },
      () => setGone((g) => { const n = new Set(g); n.delete(m.user_id); return n; }),
    );
  }

  return (
    <div className="space-y-4">
      {admin && pending.length > 0 && (
        <section aria-labelledby="anfragen" className="rounded-[10px] border border-accent/40 bg-accent-soft/20 overflow-hidden">
          <h3 id="anfragen" className="px-4 md:px-5 pt-4 pb-2 text-[13.5px] font-medium text-accent-hover flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />
            {pending.length === 1 ? "1 Beitrittsanfrage" : `${pending.length} Beitrittsanfragen`}
          </h3>
          <ul className="divide-y divide-accent/20">
            {pending.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 md:px-5 py-3.5 anim-rise">
                <Person m={m} />
                <div className="flex items-center gap-2">
                  <Button variant="quiet" className="text-sm" onClick={() => remove(m, true)}>Ablehnen</Button>
                  <Button variant="primary" size="sm" disabled={busy === m.user_id} onClick={() => act(m, "approve")}>Freigeben</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid sm:grid-cols-2 gap-2" aria-label="Mitglieder">
        {active.map((m, i) => {
          const self = m.user_id === me;
          return (
            <li key={m.user_id} className={cx("rounded-[10px] border p-4 flex flex-col gap-3 anim-rise", self ? "border-line-strong" : "border-line")} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <Person m={m} me={self} />
              <dl className="grid grid-cols-2 gap-1.5 text-[12.5px]">
                <div className="rounded-[6px] bg-paper-2 px-2.5 py-2">
                  <dt className="text-muted">Im Kreis-Regal</dt>
                  <dd className="font-[560] text-[15px] tnum mt-0.5">{m.books === 1 ? "1 Buch" : `${m.books} Bücher`}</dd>
                </div>
                <div className="rounded-[6px] bg-paper-2 px-2.5 py-2">
                  <dt className="text-muted">Dabei seit</dt>
                  <dd className="font-[560] text-[15px] mt-0.5">{monthShort.format(new Date(m.joined_at))}</dd>
                </div>
              </dl>
              {admin && !self && (
                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-line">
                  {m.role !== "admin" ? (
                    <Button variant="quiet" className="text-[13px] min-h-8 -ml-1" disabled={busy === m.user_id} onClick={() => act(m, "make_admin")}>Zum Admin machen</Button>
                  ) : <span className="text-[12.5px] text-muted">Verwaltet den Kreis mit</span>}
                  <Button variant="danger" className="text-[13px] min-h-8" onClick={() => remove(m)}>Entfernen</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Person({ m, me }: { m: Member; me?: boolean }) {
  return (
    <div className="min-w-0 flex items-center gap-3.5">
      <Avatar name={m.first_name} seed={m.user_id} size={44} photo={m.avatar_key} />
      <div className="min-w-0">
        <p className="text-[15px] flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/profil/${m.user_id}`} className="font-medium hover:underline underline-offset-4">{m.first_name}</Link>
          {me && <span className="text-muted">(du)</span>}
          {m.role === "admin" && <span className="inline-flex items-center h-[22px] px-2 rounded-[4px] bg-accent-soft text-accent-hover text-[12px] font-medium">Admin</span>}
        </p>
        <p className="text-[13px] text-muted">{[trustLabel[m.trust_level] ?? "Neu", m.municipality].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

export function CircleSettings({ circleId, initial }: { circleId: string; initial: CircleValues }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function save() {
    if (v.name.trim().length < 2) {
      setNameError("Gib dem Kreis einen Namen mit mindestens zwei Zeichen.");
      return;
    }
    setBusy(true);
    try {
      await api(`/circles/${circleId}`, {
        method: "PATCH",
        body: { name: v.name.trim(), description: v.description.trim() || null, loanDays: v.loanDays, autoAccept: v.autoAccept, fixedSpot: v.fixedSpot.trim() || null, joinMode: v.joinMode },
      });
      toast.show({ text: "Gespeichert" }, 2000);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <Button variant="secondary" onClick={() => { setV(initial); setOpen(true); }}>Regeln und Namen ändern</Button>
      </div>
    );
  }
  return (
    <section aria-label="Einstellungen" className="mt-4 rounded-[10px] border border-line p-5 md:p-6 anim-rise">
      <CircleFields v={v} set={(p) => { setV((c) => ({ ...c, ...p })); if (p.name !== undefined) setNameError(null); }} nameError={nameError} />
      <div className="flex items-center gap-3 mt-7 pt-5 border-t border-line">
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Wird gespeichert …" : "Speichern"}</Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>Abbrechen</Button>
      </div>
    </section>
  );
}

export function LeaveCircle({ circleId, me, name, lastAdmin }: { circleId: string; me: string; name: string; lastAdmin: boolean }) {
  const router = useRouter();
  const later = useLater();
  const [leaving, setLeaving] = useState(false);

  function leave() {
    setLeaving(true);
    later(
      `Du verlässt «${name}».`,
      async () => {
        await api(`/circles/${circleId}`, { body: { memberId: me, action: "remove" } });
        router.push("/kreise");
        router.refresh();
      },
      () => setLeaving(false),
    );
  }

  return (
    <section aria-label="Kreis verlassen" className="rounded-[10px] bg-paper-2 p-5">
      <p className="text-[13.5px] text-muted">
        {lastAdmin
          ? "Du bist der einzige Admin. Mach zuerst jemanden zum Admin, bevor du gehst."
          : "Deine Bücher verschwinden aus dem gemeinsamen Regal. Laufende Leihen gehen weiter."}
      </p>
      <Button variant="danger" className={cx("text-sm mt-2 -ml-1", leaving && "opacity-45")} disabled={lastAdmin || leaving} onClick={leave}>
        Kreis verlassen
      </Button>
    </section>
  );
}
