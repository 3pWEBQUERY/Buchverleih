"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button, Notice, Switch, cx } from "@/components/ui";
import { readTheme, saveTheme, type Theme } from "@/components/theme-sync";
import { msg, useT } from "./sections-shared";

/** Einstellungen, Bereich Allgemein: E-Mail, Darstellung, Push, Daten, Abmelden, Konto löschen */
/* ------------------------------------------------- E-Mail-Benachrichtigungen */
export function EmailPrefs({ categories, prefs }: { categories: { key: string; label: string; locked: boolean }[]; prefs: Record<string, boolean> }) {
  const T = useT();
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.key, c.locked || prefs[c.key] !== false])));

  async function set(key: string, label: string, v: boolean, undoable = true) {
    setState((s) => ({ ...s, [key]: v }));
    try {
      await api("/me", { method: "PATCH", body: { emailPrefs: { [key]: v } } });
      router.refresh();
      if (undoable) toast.show({ text: T.email.toggled(label, v), undo: () => set(key, label, !v, false) });
    } catch (e) {
      setState((s) => ({ ...s, [key]: !v }));
      toast.error(msg(e, T));
    }
  }

  return (
    <div className="divide-y divide-line -my-3">
      {categories.map((c) => (
        <Switch key={c.key} checked={state[c.key]} disabled={c.locked} label={c.label}
          hint={c.locked ? T.email.locked : undefined}
          onChange={(v) => set(c.key, c.label, v)} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Darstellung */
export function ThemeChoice() {
  const t = useT().theme;
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);
  const opts: { value: Theme; label: string; desc: string; swatch: string }[] = [
    { value: "light", label: t.light[0], desc: t.light[1], swatch: "bg-[#faf8f4]" },
    { value: "dark", label: t.dark[0], desc: t.dark[1], swatch: "bg-[#0f0f0e]" },
    { value: "system", label: t.system[0], desc: t.system[1], swatch: "bg-[linear-gradient(90deg,#faf8f4_50%,#0f0f0e_50%)]" },
  ];
  return (
    <div role="radiogroup" aria-label={t.aria} className="grid grid-cols-3 gap-2 max-w-[460px]">
      {opts.map((o) => {
        const on = theme === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => { setTheme(o.value); saveTheme(o.value); }}
            className={cx("text-left rounded-[10px] border p-2.5 transition-colors", on ? "border-accent bg-accent-soft/35" : "border-line hover:border-ink-2")}>
            <span aria-hidden className={cx("block h-12 rounded-[6px] border border-line", o.swatch)} />
            <span className="block text-[14px] font-medium mt-2.5 px-0.5">{o.label}</span>
            <span className="block text-[12px] text-muted px-0.5">{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- Push */
function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Service Worker abwarten; ohne (z. B. lokal in der Entwicklung) nach kurzer Zeit aufgeben */
const swReady = () => Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);

type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function PushSettings() {
  const T = useT();
  const t = T.push;
  const toast = useToast();
  const [state, setState] = useState<PushState>("loading");
  const [devices, setDevices] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await swReady();
        if (!reg) return setState("unsupported");
        const sub = await reg.pushManager.getSubscription();
        const d = await api<{ devices: number; thisDevice: boolean }>(`/push${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ""}`);
        setDevices(d.devices);
        if (sub && !d.thisDevice) {
          // Browser hat noch ein Abo, der Server nicht (z. B. nach Abmelden): neu melden
          await api("/push", { body: sub.toJSON() }).then((r) => setDevices((r as { devices: number }).devices)).catch(() => {});
        }
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const { publicKey } = await api<{ publicKey: string }>("/push");
      const reg = await swReady();
      if (!reg) throw new Error(t.notReady);
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const r = await api<{ devices: number }>("/push", { body: sub.toJSON() });
      setDevices(r.devices);
      setState("on");
      toast.show({ text: t.on });
    } catch (e) {
      toast.error(msg(e, T));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await swReady();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const r = await api<{ devices: number }>("/push", { method: "DELETE", body: { endpoint: sub.endpoint } });
        setDevices(r.devices);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
      toast.show({ text: t.off });
    } catch (e) {
      toast.error(msg(e, T));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await api("/push", { body: { test: true } });
      toast.show({ text: t.testSent });
    } catch (e) {
      toast.error(msg(e, T));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <div className="skeleton h-[60px] rounded-[10px] max-w-[460px]" />;
  if (state === "ios-install") {
    return (
      <Notice>
        {t.ios[0]}<strong>{t.ios[1]}</strong>{t.ios[2]}<strong>{t.ios[3]}</strong>{t.ios[4]}
      </Notice>
    );
  }
  if (state === "unsupported") return <Notice>{t.unsupported}</Notice>;
  if (state === "denied") {
    return <Notice>{t.denied}</Notice>;
  }
  const on = state === "on";
  return (
    <div className="max-w-[560px]">
      <div className={cx("rounded-[10px] border px-4 transition-colors duration-300", on ? "bg-accent-soft/35 border-accent/30" : "bg-paper border-line")}>
        <Switch checked={on} disabled={busy} onChange={(v) => (v ? enable() : disable())}
          label={<span className="font-medium">{t.device}</span>}
          hint={on ? t.hintOn : t.hintOff} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <span>{t.devices(devices)}</span>
        {on && <button type="button" onClick={test} disabled={busy} className="font-medium text-accent-hover hover:underline underline-offset-4 disabled:opacity-50">{t.test}</button>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Daten und Konto */
export function ExportData() {
  const t = useT().data;
  return (
    <a href="/api/v1/me/export" download
      className="inline-flex items-center gap-2 h-11 px-5 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[15px] hover:bg-accent hover:text-accent-ink transition-colors duration-200">
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
      {t.download}
    </a>
  );
}

export function Logout() {
  const t = useT().logout;
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      // Push auf diesem Gerät beenden (das Abo am Server endet mit der Sitzung)
      await Promise.race([
        navigator.serviceWorker?.getRegistration().then((r) => r?.pushManager?.getSubscription()).then((s) => s?.unsubscribe()).catch(() => {}),
        new Promise((r) => setTimeout(r, 800)),
      ]);
      await api("/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  }
  return <Button variant="secondary" onClick={logout} disabled={busy}>{busy ? t.busy : t.label}</Button>;
}

export function DeleteAccount() {
  const T = useT();
  const t = T.del;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; openLoans: boolean } | null>(null);

  async function destroy() {
    setBusy(true);
    setError(null);
    try {
      await api("/me/delete", { method: "POST" });
      window.location.assign("/");
    } catch (e) {
      setError({ text: msg(e, T), openLoans: e instanceof ApiError && e.code === "open_loans" });
      setConfirm(false);
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0">
      {!confirm ? (
        <div>
          <p className="text-[15px] text-ink-2 max-w-prose">{t.intro}</p>
          <button type="button" onClick={() => { setConfirm(true); setError(null); }}
            className="mt-5 inline-flex items-center h-11 px-5 rounded-[6px] border border-late/50 text-late font-medium text-[15px] hover:bg-late hover:text-paper hover:border-late transition-colors duration-200">
            {t.open}
          </button>
        </div>
      ) : (
        <div className="rounded-[10px] bg-paper border border-late/40 p-5 anim-rise" role="group" aria-label={t.aria}>
          <p className="ui-title text-[16px]">{t.really}</p>
          <p className="text-[15px] text-ink-2 mt-1.5 max-w-prose">{t.text}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5">
            <button type="button" onClick={destroy} disabled={busy} autoFocus
              className="inline-flex items-center h-11 px-5 rounded-[6px] bg-late text-paper font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-45">
              {busy ? t.busy : t.confirm}
            </button>
            <Button variant="quiet" className="h-11" onClick={() => setConfirm(false)} disabled={busy}>{T.cancel}</Button>
          </div>
        </div>
      )}
      {error && (
        <Notice tone="late" className="mt-4">
          <p role="alert">{error.text}</p>
          {error.openLoans && <Link href="/vorgaenge" className="underline text-sm mt-1 inline-block">{t.toLoans}</Link>}
        </Notice>
      )}
    </div>
  );
}

