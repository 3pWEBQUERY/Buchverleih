"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { api, ApiError } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button, Check, Field, Input, Notice, Segmented, Switch, cx } from "@/components/ui";
import { readTheme, saveTheme, type Theme } from "@/components/theme-sync";
import { useLater } from "@/components/use-later";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Etwas ist schiefgelaufen. Versuche es erneut.");

const rowCls = "flex items-center justify-between gap-6 py-3";

/* ------------------------------------------------------------------ Profil */
export function ProfileForm({ firstName, plz, municipality }: { firstName: string; plz: string; municipality: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(firstName);
  const [code, setCode] = useState(plz);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "name" | "plz"; text: string } | null>(null);
  const dirty = name.trim() !== firstName || code !== plz;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError({ field: "name", text: "Gib deinen Vornamen ein." });
    if (!/^\d{4}$/.test(code)) return setError({ field: "plz", text: "Gib eine vierstellige Postleitzahl ein." });
    setBusy(true);
    setError(null);
    try {
      await api("/me", { method: "PATCH", body: { firstName: name.trim(), ...(code !== plz ? { plz: code } : {}) } });
      toast.show({ text: "Profil gespeichert." });
      router.refresh();
    } catch (e) {
      setError({ field: e instanceof ApiError && e.code === "invalid" && /Vorname/.test(e.message) ? "name" : "plz", text: msg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-2" noValidate>
      <Field label="Vorname" error={error?.field === "name" ? error.text : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
      </Field>
      <Field label="Postleitzahl" hint={municipality && code === plz ? municipality : "Bestimmt, welche Regale du in der Nähe siehst."}
        error={error?.field === "plz" ? error.text : null}>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="postal-code" required />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || busy}>{busy ? "Speichert …" : "Speichern"}</Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ Mobilnummer */
function fmtPhone(p: string) {
  const m = /^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

export function PhoneSection({ phone, verifiedAt }: { phone: string | null; verifiedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(!verifiedAt);
  const [step, setStep] = useState<"number" | "code">("number");
  const [number, setNumber] = useState(verifiedAt ? "" : phone ?? "");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ devCode?: string }>("/me/phone", { body: { phone: number } });
      setDevCode(r.devCode ?? null);
      setStep("code");
      setCode("");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/me/phone/verify", { body: { code } });
      toast.show({ text: "Mobilnummer bestätigt." });
      setEditing(false);
      setStep("number");
      setDevCode(null);
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing && verifiedAt && phone) {
    return (
      <div className="border-y border-line">
        <div className={rowCls}>
          <span className="tnum text-[15px]">{fmtPhone(phone)}</span>
          <span className="text-sm text-ok">Bestätigt am {verifiedAt}</span>
        </div>
        <div className="border-t border-line py-3">
          <Button variant="quiet" onClick={() => setEditing(true)}>Andere Nummer bestätigen</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {!verifiedAt && <p className="text-sm text-late mb-4">Noch nicht bestätigt. Ohne bestätigte Nummer kannst du keine Bücher anfragen.</p>}
      {step === "number" ? (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <Field label="Mobilnummer" hint="Wir schicken dir einen sechsstelligen Code per SMS." error={error}>
            <Input type="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="079 123 45 67" autoComplete="tel" inputMode="tel" />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="primary" disabled={busy || number.replace(/\D/g, "").length < 9}>{busy ? "Sendet …" : "Code senden"}</Button>
            {verifiedAt && <Button type="button" variant="quiet" onClick={() => { setEditing(false); setError(null); }}>Abbrechen</Button>}
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <Field label="Code aus der SMS" hint={`Gesendet an ${number}. Der Code gilt 10 Minuten.`} error={error}>
            <Input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="tnum tracking-[0.3em] max-w-48" />
          </Field>
          {devCode && <Notice>Testbetrieb, keine SMS verschickt. Dein Code lautet <span className="tnum font-medium">{devCode}</span>.</Notice>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>{busy ? "Prüft …" : "Bestätigen"}</Button>
            <Button type="button" variant="quiet" onClick={() => send()} disabled={busy}>Neuen Code senden</Button>
            <Button type="button" variant="quiet" onClick={() => { setStep("number"); setError(null); }}>Nummer ändern</Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Passkeys */
function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Passkey";
}

export function PasskeyList({ passkeys }: { passkeys: { id: string; name: string; created: string; lastUsed: string | null }[] }) {
  const router = useRouter();
  const toast = useToast();
  const later = useLater();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSupported(browserSupportsWebAuthn()), []);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const optionsJSON = await api<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/me/passkeys", { body: { step: "options" } });
      const response = await startRegistration({ optionsJSON });
      await api("/me/passkeys", { body: { step: "verify", response, name: deviceName() } });
      toast.show({ text: "Passkey hinzugefügt." });
      router.refresh();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") setError("Abgebrochen. Versuche es erneut, wenn du so weit bist.");
      else if (name === "InvalidStateError") setError("Dieses Gerät hat bereits einen Passkey für dein Konto.");
      else setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string, label: string) {
    setHidden((s) => new Set(s).add(id));
    later(`Passkey «${label}» wird entfernt.`, () => api(`/me/passkeys?id=${encodeURIComponent(id)}`, { method: "DELETE" }), () =>
      setHidden((s) => { const n = new Set(s); n.delete(id); return n; }));
  }

  const visible = passkeys.filter((p) => !hidden.has(p.id));
  return (
    <div>
      {visible.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line mb-5">
          {visible.map((p) => (
            <li key={p.id} className={rowCls}>
              <span className="min-w-0">
                <span className="block text-[15px]">{p.name}</span>
                <span className="block text-sm text-muted">Hinzugefügt am {p.created}{p.lastUsed ? ` · zuletzt verwendet am ${p.lastUsed}` : " · noch nie verwendet"}</span>
              </span>
              <Button variant="quiet" className="text-sm shrink-0" onClick={() => remove(p.id, p.name)}>Entfernen</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2 mb-5">Du meldest dich bisher per E-Mail-Link an.</p>
      )}
      {supported ? (
        <Button onClick={add} disabled={busy}>{busy ? "Wartet auf dein Gerät …" : "Passkey hinzufügen"}</Button>
      ) : (
        <p className="text-sm text-muted">Dieser Browser unterstützt keine Passkeys. Die Anmeldung per E-Mail-Link funktioniert weiterhin.</p>
      )}
      {error && <p className="text-sm text-late mt-3" role="alert">{error}</p>}
    </div>
  );
}

/* ----------------------------------------------------------- Übergabeorte */
type Spot = { id: string; label: string; detail: string | null; dropoff: boolean };

export function SpotList({ spots }: { spots: Spot[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [dropoff, setDropoff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = spots.length >= 3;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (label.trim().length < 2) return setError("Gib dem Ort eine kurze Bezeichnung, zum Beispiel «Bahnhof Bülach, Kiosk».");
    setBusy(true);
    setError(null);
    try {
      await api("/me/spots", { body: { label: label.trim(), detail: detail.trim() || null, dropoff } });
      setLabel(""); setDetail(""); setDropoff(false); setOpen(false);
      toast.show({ text: "Übergabeort gespeichert." });
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Spot) {
    try {
      await api(`/me/spots?id=${s.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: `«${s.label}» entfernt.`,
        undo: async () => {
          await api("/me/spots", { body: { label: s.label, detail: s.detail, dropoff: s.dropoff } });
          router.refresh();
        },
      });
    } catch (e) {
      toast.error(msg(e));
    }
  }

  return (
    <div>
      {spots.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line mb-5">
          {spots.map((s) => (
            <li key={s.id} className={rowCls}>
              <span className="min-w-0">
                <span className="block text-[15px]">{s.label}</span>
                <span className="block text-sm text-muted">
                  {s.detail ? <>Nach Annahme sichtbar: {s.detail}</> : "Ohne genaue Angabe"}
                  {s.dropoff && " · Ablage erlaubt"}
                </span>
              </span>
              <Button variant="quiet" className="text-sm shrink-0" onClick={() => remove(s)}>Entfernen</Button>
            </li>
          ))}
        </ul>
      ) : !open && (
        <p className="text-ink-2 mb-5">Noch kein Übergabeort festgelegt. Ohne Ort schlägst du bei jeder Annahme einen vor.</p>
      )}

      {full ? (
        <p className="text-sm text-muted">Du hast drei Orte festgelegt. Entferne einen, um einen neuen hinzuzufügen.</p>
      ) : open ? (
        <form onSubmit={add} className="flex flex-col gap-5 anim-rise" noValidate>
          <Field label="Bezeichnung" hint="Sehen alle, die anfragen." error={error}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Bahnhof Bülach, Kiosk" autoFocus />
          </Field>
          <Field label="Genauer Ort" hint="Erst nach deiner Annahme im Vorgang sichtbar. Keine Hausnummer nötig.">
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} placeholder="Beim Ausgang Süd, Bank neben dem Kiosk" />
          </Field>
          <Check checked={dropoff} onChange={setDropoff} label="Ablage erlaubt (Milchkasten, Briefkasten, Hausflur)" />
          <div className="flex items-center gap-5">
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Speichert …" : "Ort speichern"}</Button>
            <Button type="button" variant="quiet" onClick={() => { setOpen(false); setError(null); }}>Abbrechen</Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setOpen(true)}>Übergabeort hinzufügen</Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Ferienmodus */
export function ShelfPause({ paused }: { paused: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(paused);
  useEffect(() => setOn(paused), [paused]);

  async function set(v: boolean, undoable = true) {
    setOn(v);
    try {
      await api("/me", { method: "PATCH", body: { shelfPaused: v } });
      router.refresh();
      if (undoable) toast.show({ text: v ? "Regal pausiert. Niemand kann anfragen." : "Regal wieder offen für Anfragen.", undo: () => set(!v, false) });
    } catch (e) {
      setOn(!v);
      toast.error(msg(e));
    }
  }

  return (
    <div className="border-y border-line">
      <Switch checked={on} onChange={(v) => set(v)} label="Regal pausieren" hint={on ? "Dein Regal ist pausiert." : "Anfragen sind möglich."} />
    </div>
  );
}

/* ------------------------------------------------- E-Mail-Benachrichtigungen */
export function EmailPrefs({ categories, prefs }: { categories: { key: string; label: string; locked: boolean }[]; prefs: Record<string, boolean> }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.key, c.locked || prefs[c.key] !== false])));

  async function set(key: string, label: string, v: boolean, undoable = true) {
    setState((s) => ({ ...s, [key]: v }));
    try {
      await api("/me", { method: "PATCH", body: { emailPrefs: { [key]: v } } });
      router.refresh();
      if (undoable) toast.show({ text: `${label}: E-Mail ${v ? "an" : "aus"}.`, undo: () => set(key, label, !v, false) });
    } catch (e) {
      setState((s) => ({ ...s, [key]: !v }));
      toast.error(msg(e));
    }
  }

  return (
    <div className="divide-y divide-line border-y border-line">
      {categories.map((c) => (
        <Switch key={c.key} checked={state[c.key]} disabled={c.locked} label={c.label}
          hint={c.locked ? "Immer aktiv, damit dir bei einem offenen Fall keine Frist entgeht." : undefined}
          onChange={(v) => set(c.key, c.label, v)} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------- Blockierte Personen */
export function BlockList({ blocks }: { blocks: { id: string; name: string; since: string }[] }) {
  const router = useRouter();
  const toast = useToast();

  async function unblock(b: { id: string; name: string }) {
    try {
      await api(`/blocks?user=${b.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: `Blockierung von ${b.name} aufgehoben.`,
        undo: async () => { await api("/blocks", { body: { userId: b.id } }); router.refresh(); },
      });
    } catch (e) {
      toast.error(msg(e));
    }
  }

  if (!blocks.length) return <p className="text-ink-2">Du hast niemanden blockiert.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {blocks.map((b) => (
        <li key={b.id} className={rowCls}>
          <span className="min-w-0">
            <span className="block text-[15px]">{b.name}</span>
            <span className="block text-sm text-muted">Blockiert seit {b.since}</span>
          </span>
          <Button variant="quiet" className="text-sm shrink-0" onClick={() => unblock(b)}>Aufheben</Button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- Darstellung */
export function ThemeChoice() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);
  return (
    <Segmented<Theme> name="Darstellung" value={theme} className="max-w-sm"
      onChange={(t) => { setTheme(t); saveTheme(t); }}
      options={[{ value: "light", label: "Hell" }, { value: "dark", label: "Dunkel" }, { value: "system", label: "System" }]} />
  );
}

/* --------------------------------------------------------- Daten und Konto */
export function AccountActions() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);
  const [error, setError] = useState<{ text: string; openLoans: boolean } | null>(null);

  async function logout() {
    setBusy("logout");
    try {
      await api("/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setBusy(null);
    }
  }

  async function destroy() {
    setBusy("delete");
    setError(null);
    try {
      await api("/me/delete", { method: "POST" });
      window.location.assign("/");
    } catch (e) {
      setError({ text: msg(e), openLoans: e instanceof ApiError && e.code === "open_loans" });
      setConfirm(false);
      setBusy(null);
    }
  }

  return (
    <div className="divide-y divide-line border-y border-line">
      <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <span className="min-w-0 max-w-sm">
          <span className="block text-[15px]">Datenexport</span>
          <span className="block text-sm text-muted">Alles, was wir zu dir gespeichert haben, als JSON-Datei.</span>
        </span>
        <a href="/api/v1/me/export" download
          className="shrink-0 inline-flex items-center h-10 px-4 text-[15px] font-medium border border-ink rounded-sm hover:bg-ink hover:text-paper transition-colors duration-150">
          Daten herunterladen
        </a>
      </div>
      <div className={cx(rowCls, "py-4 items-center")}>
        <span className="block text-[15px]">Auf diesem Gerät abmelden</span>
        <Button onClick={logout} disabled={busy !== null} className="shrink-0">{busy === "logout" ? "Meldet ab …" : "Abmelden"}</Button>
      </div>
      <div className="py-4">
        <div className={cx(rowCls, "py-0 items-center")}>
          <span className="min-w-0 max-w-sm">
            <span className="block text-[15px]">Konto löschen</span>
            <span className="block text-sm text-muted">Möglich, sobald kein Vorgang mehr offen ist.</span>
          </span>
          {!confirm && <Button variant="danger" className="shrink-0" onClick={() => { setConfirm(true); setError(null); }}>Konto löschen</Button>}
        </div>
        {confirm && (
          <div className="mt-4 border-l-2 border-late pl-4 anim-rise">
            <p className="text-[15px] max-w-prose">
              Das lässt sich nicht rückgängig machen. Deine Bücher verschwinden aus allen Regalen, Wunschliste, Kreise und Übergabeorte werden gelöscht.
              Abgeschlossene Vorgänge bleiben ohne deinen Namen erhalten.
            </p>
            <div className="flex flex-wrap items-center gap-5 mt-4">
              <button type="button" onClick={destroy} disabled={busy !== null}
                className="inline-flex items-center h-10 px-4 text-[15px] font-medium rounded-sm border border-late text-late hover:bg-late hover:text-paper transition-colors duration-150 disabled:opacity-45">
                {busy === "delete" ? "Löscht …" : "Endgültig löschen"}
              </button>
              <Button variant="quiet" onClick={() => setConfirm(false)} disabled={busy !== null}>Abbrechen</Button>
            </div>
          </div>
        )}
        {error && (
          <Notice tone="late" className="mt-4">
            <p role="alert">{error.text}</p>
            {error.openLoans && <Link href="/vorgaenge" className="underline text-sm mt-1 inline-block">Zu deinen Vorgängen</Link>}
          </Notice>
        )}
      </div>
    </div>
  );
}
