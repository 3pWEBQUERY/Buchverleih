"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import { htmlLang } from "@/lib/i18n/locale";
import { useLocale } from "@/components/locale-provider";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { useToast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/kreise/faces";
import { CircleFields, type CircleValues } from "../circle-form";

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

export function InviteBox({ circleId, name, url, admin, appUrl }: { circleId: string; name: string; url: string | null; admin: boolean; appUrl: string }) {
  const toast = useToast();
  const all = CIRCLES[useLocale()];
  const t = all.client;
  const poster = all.poster;
  const [link, setLink] = useState(url);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ text: t.copied }, 3000);
    } catch {
      input.current?.select();
      toast.error(t.copyFailed);
    }
  }

  async function renew() {
    setBusy(true);
    try {
      const r = await api<{ inviteCode: string }>(`/circles/${circleId}`, { method: "PATCH", body: { renewInvite: true } });
      setLink(`${appUrl}/k/${r.inviteCode}`);
      toast.show({ text: t.renewed }, 4000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="einladen" className="rounded-md border border-line p-5">
      <h2 id="einladen" className="text-title-sm font-title tracking-title">{t.invite}</h2>
      {link ? (
        <>
          <p className="text-body-sm text-muted mt-1 mb-4">{t.inviteText}</p>
          <input ref={input} readOnly value={link} aria-label={t.inviteLink} onFocus={(e) => e.target.select()}
            className="w-full h-11 px-3.5 rounded-sm bg-paper-2 border border-line text-body-sm text-ink-2 tnum truncate focus:outline-none focus:border-accent transition-colors" />
          <Button type="button" variant="primary" onClick={copy} className="w-full mt-2">{t.copy}</Button>
          <Button type="button" variant="secondary" onClick={() => setShowQr((v) => !v)} className="w-full mt-2" aria-expanded={showQr}>
            {showQr ? t.qrHide : t.qrShow}
          </Button>
          {showQr && <InviteQr link={link} name={name} />}
          <Link href={`/kreise/${circleId}/plakat`} className="mt-2 w-full min-h-11 inline-flex items-center justify-center text-body-sm font-medium text-ink-2 hover:text-ink underline-offset-4 hover:underline">
            {poster.link}
          </Link>
          {admin && (
            <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-meta text-muted">{t.wrongHands}</p>
              <Button variant="quiet" className="text-body-sm min-h-9" disabled={busy} onClick={renew}>{t.renew}</Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-body-sm text-ink-2 mt-2">{t.askAdmin}</p>
      )}
    </section>
  );
}

/**
 * QR-Einladung: Karte zum Vorzeigen, Ausdrucken oder als Bild (PNG). Der Code enthält den
 * Einladungslink; auf iPhones mit der Leihregal-App öffnet er dank Universal Link direkt die App.
 */
function InviteQr({ link, name }: { link: string; name: string }) {
  const t = CIRCLES[useLocale()].client;
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#141413", light: "#ffffff" } })
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, [link]);

  async function download() {
    // Druckfertige Karte: Titel, QR-Code, Link – weisser Grund, ohne Schatten
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 900, errorCorrectionLevel: "M", color: { dark: "#141413", light: "#ffffff" } });
    const img = new Image();
    img.src = qr;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1350;
    const g = c.getContext("2d");
    if (!g) return;
    g.fillStyle = "#faf8f4"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#e51e09"; g.fillRect(90, 96, 12, 12);
    g.fillStyle = "#6c665c"; g.font = "500 34px system-ui, sans-serif"; g.fillText("Leihregal", 120, 112);
    g.fillStyle = "#141413"; g.font = "600 56px system-ui, sans-serif";
    wrap(g, t.qrTitle(name), 90, 200, 900, 66);
    g.fillStyle = "#ffffff"; g.fillRect(90, 330, 900, 900);
    g.drawImage(img, 90, 330, 900, 900);
    g.fillStyle = "#3b3934"; g.font = "500 30px system-ui, sans-serif"; g.fillText(t.qrScan, 90, 1290);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `einladung-${name.toLowerCase().replace(/[^a-z0-9äöü]+/gi, "-").replace(/^-|-$/g, "") || "kreis"}.png`;
    a.click();
  }

  return (
    <div className="mt-4 rounded-md bg-paper-2 p-5 invite-qr">
      <p className="text-meta text-muted">Leihregal</p>
      <p className="text-lead font-title tracking-ui leading-snug mt-1">{t.qrTitle(name)}</p>
      <div className="mt-4 mx-auto max-w-[260px] rounded-md bg-white p-3" aria-label={t.qrShow} role="img"
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
      <p className="text-meta text-muted mt-4 leading-relaxed">{t.qrHint}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
        <Button type="button" variant="ghost" size="sm" onClick={download}>{t.qrDownload}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>{t.qrPrint}</Button>
      </div>
    </div>
  );
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "";
  for (const w of text.split(" ")) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > max && line) { g.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, y);
}

export function MemberList({ circleId, me, admin, members }: { circleId: string; me: string; admin: boolean; members: Member[] }) {
  const router = useRouter();
  const toast = useToast();
  const later = useLater();
  const l = useLocale();
  const t = CIRCLES[l].client;
  const monthShort = new Intl.DateTimeFormat(htmlLang[l], { month: "short", year: "numeric", timeZone: "Europe/Zurich" });
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const visible = members.filter((m) => !gone.has(m.user_id));
  const pending = visible.filter((m) => m.status === "pending");
  const active = visible.filter((m) => m.status === "active");

  async function act(m: Member, action: "approve" | "make_admin") {
    setBusy(m.user_id);
    try {
      await api(`/circles/${circleId}`, { body: { memberId: m.user_id, action } });
      toast.show({ text: action === "approve" ? t.approved(m.first_name) : t.madeAdmin(m.first_name) }, 3000);
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
      decline ? t.declined(m.first_name) : t.removed(m.first_name),
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
        <section aria-labelledby="anfragen" className="rounded-md border border-accent/40 bg-accent-soft/20 overflow-hidden">
          <h3 id="anfragen" className="px-4 md:px-5 pt-4 pb-2 text-body-sm font-medium text-accent-hover flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />
            {CIRCLES[l].joinRequests(pending.length)}
          </h3>
          <ul className="divide-y divide-accent/20">
            {pending.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 md:px-5 py-3.5">
                <Person m={m} />
                <div className="flex items-center gap-2">
                  <Button variant="quiet" className="text-body-sm" onClick={() => remove(m, true)}>{t.decline}</Button>
                  <Button variant="primary" size="sm" disabled={busy === m.user_id} onClick={() => act(m, "approve")}>{t.approve}</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid sm:grid-cols-2 gap-2" aria-label={t.members}>
        {active.map((m, i) => {
          const self = m.user_id === me;
          return (
            <li key={m.user_id} className={cx("rounded-md border p-4 flex flex-col gap-3", self ? "border-line-strong" : "border-line")}>
              <Person m={m} me={self} />
              <dl className="grid grid-cols-2 gap-1.5 text-meta">
                <div className="rounded-sm bg-paper-2 px-2.5 py-2">
                  <dt className="text-muted">{t.inShelf}</dt>
                  <dd className="font-title text-body tnum mt-0.5">{t.books(m.books)}</dd>
                </div>
                <div className="rounded-sm bg-paper-2 px-2.5 py-2">
                  <dt className="text-muted">{t.since}</dt>
                  <dd className="font-title text-body mt-0.5">{monthShort.format(new Date(m.joined_at))}</dd>
                </div>
              </dl>
              {admin && !self && (
                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-line">
                  {m.role !== "admin" ? (
                    <Button variant="quiet" className="text-meta min-h-8 -ml-1" disabled={busy === m.user_id} onClick={() => act(m, "make_admin")}>{t.makeAdmin}</Button>
                  ) : <span className="text-meta text-muted">{t.coAdmin}</span>}
                  <Button variant="danger" className="text-meta min-h-8" onClick={() => remove(m)}>{t.remove}</Button>
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
  const l = useLocale();
  const t = CIRCLES[l].client;
  return (
    <div className="min-w-0 flex items-center gap-3.5">
      <Avatar name={m.first_name} seed={m.user_id} size={44} photo={m.avatar_key} />
      <div className="min-w-0">
        <p className="text-body flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/profil/${m.user_id}`} className="font-medium hover:underline underline-offset-4">{m.first_name}</Link>
          {me && <span className="text-muted">{t.you}</span>}
          {m.role === "admin" && <span className="inline-flex items-center h-[22px] px-2 rounded-xs bg-accent-soft text-accent-hover text-caption font-medium">{t.admin}</span>}
        </p>
        <p className="text-meta text-muted">{[labels(l).trustLabel[m.trust_level] ?? t.newcomer, m.municipality].filter(Boolean).join(" · ")}</p>
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
  const c = CIRCLES[useLocale()];
  const t = c.client;

  async function save() {
    if (v.name.trim().length < 2) {
      setNameError(c.form.nameError);
      return;
    }
    setBusy(true);
    try {
      await api(`/circles/${circleId}`, {
        method: "PATCH",
        body: { name: v.name.trim(), description: v.description.trim() || null, loanDays: v.loanDays, autoAccept: v.autoAccept, fixedSpot: v.fixedSpot.trim() || null, joinMode: v.joinMode },
      });
      toast.show({ text: t.saved }, 2000);
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
        <Button variant="secondary" onClick={() => { setV(initial); setOpen(true); }}>{t.edit}</Button>
      </div>
    );
  }
  return (
    <section aria-label={t.settings} className="mt-4 rounded-md border border-line p-5 md:p-6 anim-rise">
      <CircleFields v={v} set={(p) => { setV((c) => ({ ...c, ...p })); if (p.name !== undefined) setNameError(null); }} nameError={nameError} />
      <div className="flex items-center gap-3 mt-7 pt-5 border-t border-line">
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? t.saving : t.save}</Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>{t.cancel}</Button>
      </div>
    </section>
  );
}

export function LeaveCircle({ circleId, me, name, lastAdmin }: { circleId: string; me: string; name: string; lastAdmin: boolean }) {
  const router = useRouter();
  const later = useLater();
  const t = CIRCLES[useLocale()].client;
  const [leaving, setLeaving] = useState(false);

  function leave() {
    setLeaving(true);
    later(
      t.leaving(name),
      async () => {
        await api(`/circles/${circleId}`, { body: { memberId: me, action: "remove" } });
        router.push("/kreise");
        router.refresh();
      },
      () => setLeaving(false),
    );
  }

  return (
    <section aria-label={t.leaveAria} className="rounded-md bg-paper-2 p-5">
      <p className="text-body-sm text-muted">
        {lastAdmin ? t.lastAdmin : t.leaveText}
      </p>
      <Button variant="danger" className={cx("text-body-sm mt-2 -ml-1", leaving && "opacity-45")} disabled={lastAdmin || leaving} onClick={leave}>
        {t.leave}
      </Button>
    </section>
  );
}
