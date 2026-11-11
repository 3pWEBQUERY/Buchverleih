"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { trustLabel } from "@/lib/i18n/de-CH";
import { useToast } from "@/components/toast";
import { Button, SectionTitle, cx } from "@/components/ui";
import { Avatar } from "@/components/kreise/faces";
import { CircleFields, type CircleValues } from "../circle-form";

type Member = { user_id: string; first_name: string; role: string; status: string; trust_level: number; municipality: string | null };

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
    <section className="panel-quiet !rounded-[18px] p-5 md:p-6">
      <h2 className="ui-title text-[19px]">Einladen</h2>
      {link ? (
        <>
          <p className="text-[14px] text-muted mt-1 mb-4">Wer diesen Link öffnet, kann dem Kreis beitreten.</p>
          <div className="flex items-center gap-1.5 bg-paper border border-line-strong rounded-full p-1 pl-4 focus-within:border-ink transition-colors">
            <input ref={input} readOnly value={link} aria-label="Einladungslink" onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 bg-transparent h-10 text-[14px] text-ink-2 focus:outline-none focus-visible:outline-none" />
            <Button type="button" size="sm" onClick={copy} className="h-10 flex-none">Kopieren</Button>
          </div>
          {admin && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
              <p className="text-[13px] text-muted">Link in falschen Händen?</p>
              <Button variant="quiet" className="text-[13.5px] min-h-9" disabled={busy} onClick={renew}>Link erneuern</Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[15px] text-ink-2 mt-2">Neue Mitglieder lädt ein Admin ein. Frag im Kreis nach dem Link.</p>
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
    <div className="space-y-10">
      {admin && pending.length > 0 && (
        <section>
          <SectionTitle aside={<span className="tnum">{pending.length}</span>}>Beitrittsanfragen</SectionTitle>
          <ul className="panel !rounded-[18px] divide-y divide-line overflow-hidden">
            {pending.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 md:px-5 py-4 anim-rise">
                <Person m={m} />
                <div className="flex items-center gap-4">
                  <Button variant="quiet" className="text-sm" onClick={() => remove(m, true)}>Ablehnen</Button>
                  <Button variant="primary" size="sm" disabled={busy === m.user_id} onClick={() => act(m, "approve")}>Freigeben</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle aside={<span className="tnum">{active.length}</span>}>Mitglieder</SectionTitle>
        <ul className="panel !rounded-[18px] divide-y divide-line overflow-hidden">
          {active.map((m) => (
            <li key={m.user_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-6 gap-y-2 px-4 md:px-5 py-3.5">
              <Person m={m} me={m.user_id === me} />
              {admin && m.user_id !== me && (
                <div className="flex items-center gap-4 pl-[54px] sm:pl-0">
                  {m.role !== "admin" && (
                    <Button variant="quiet" className="text-sm" disabled={busy === m.user_id} onClick={() => act(m, "make_admin")}>Zum Admin machen</Button>
                  )}
                  <Button variant="danger" className="text-sm" onClick={() => remove(m)}>Entfernen</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Person({ m, me }: { m: Member; me?: boolean }) {
  return (
    <div className="min-w-0 flex items-center gap-3.5">
      <Avatar name={m.first_name} size={40} />
      <div className="min-w-0">
        <p className="text-[15px] flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/profil/${m.user_id}`} className="font-semibold hover:underline underline-offset-4">{m.first_name}</Link>
          {me && <span className="text-muted">(du)</span>}
          {m.role === "admin" && <span className="chip !h-[22px] !text-[12px]">Admin</span>}
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

  return (
    <section className="panel !rounded-[18px] p-5 md:p-6">
      <h2 className="ui-title text-[19px]">Einstellungen</h2>
      {!open ? (
        <>
          <p className="text-[14px] text-muted mt-1 mb-4">Name, Leihfrist, Übergabeort und Beitritt. Als Admin kannst du alles ändern.</p>
          <Button size="sm" variant="ghost" onClick={() => { setV(initial); setOpen(true); }}>Einstellungen ändern</Button>
        </>
      ) : (
        <div className="anim-rise mt-5">
          <CircleFields v={v} set={(p) => { setV((c) => ({ ...c, ...p })); if (p.name !== undefined) setNameError(null); }} nameError={nameError} />
          <div className="flex items-center gap-4 mt-6">
            <Button disabled={busy} onClick={save}>{busy ? "Wird gespeichert …" : "Speichern"}</Button>
            <Button variant="quiet" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
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
    <section className="px-5 md:px-6 pt-2">
      <p className="text-[13.5px] text-muted mb-1">
        {lastAdmin
          ? "Du bist der einzige Admin. Mach zuerst jemanden zum Admin, bevor du gehst."
          : "Deine Bücher verschwinden aus dem gemeinsamen Regal. Laufende Leihen gehen weiter."}
      </p>
      <Button variant="danger" className={cx("text-sm", leaving && "opacity-45")} disabled={lastAdmin || leaving} onClick={leave}>
        Kreis verlassen
      </Button>
    </section>
  );
}
