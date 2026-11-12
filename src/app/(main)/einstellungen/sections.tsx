"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { api, ApiError, uploadPhoto } from "@/lib/client";
import { Monogram } from "@/components/person/monogram";
import { useToast } from "@/components/toast";
import { Button, Check, Field, Input, Notice, Switch, cx } from "@/components/ui";
import { readTheme, saveTheme, type Theme } from "@/components/theme-sync";
import { useLater } from "@/components/use-later";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Etwas ist schiefgelaufen. Versuche es erneut.");

/** Eintrag einer Liste innerhalb einer Einstellungszeile */
const itemCls = "rounded-[8px] bg-paper-2 flex items-center justify-between gap-4 pl-4 pr-2 py-2.5 min-h-[60px]";
const listCls = "space-y-2 mb-5";

/* ------------------------------------------------------------- Profilbild */
/** Im Browser quadratisch zuschneiden und verkleinern (entfernt auch die Metadaten). Geht das nicht, wird das Original hochgeladen. */
async function squareJpeg(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const side = Math.min(bmp.width, bmp.height);
    const out = Math.min(800, side);
    const c = document.createElement("canvas");
    c.width = out;
    c.height = out;
    c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.88));
    return blob && blob.size > 1000 ? new File([blob], "profilbild.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function AvatarEditor({ userId, name, avatarKey }: { userId: string; name: string; avatarKey: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Das ist kein Bild. Wähle ein Foto (JPEG, PNG, WebP oder HEIC).");
    if (file.size > 12 * 1024 * 1024) return setError("Das Bild ist grösser als 12 MB. Wähle ein kleineres.");
    setError(null);
    setBusy("upload");
    const square = await squareJpeg(file);
    setPreview(URL.createObjectURL(square));
    try {
      const up = await uploadPhoto(square, "avatar");
      await api("/me", { method: "PATCH", body: { avatarUploadId: up.id } });
      toast.show({ text: "Profilbild gespeichert." });
      router.refresh();
    } catch (e) {
      setPreview(null);
      setError(msg(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      await api("/me", { method: "PATCH", body: { avatarUploadId: null } });
      setPreview(null);
      toast.show({ text: "Profilbild entfernt. Andere sehen wieder deine Initiale." });
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(null);
    }
  }

  const has = Boolean(preview || avatarKey);
  return (
    <div className="flex flex-wrap items-center gap-5">
      <span className={cx("relative flex-none", busy === "upload" && "opacity-60")}>
        {preview
           
          ? <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" />
          : <Monogram name={name || "?"} seed={userId} size={80} photo={avatarKey} />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className={cx("inline-flex items-center justify-center h-10 px-4 rounded-[6px] bg-accent-soft text-accent-hover text-[14px] font-medium cursor-pointer hover:bg-accent hover:text-accent-ink transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]", busy && "pointer-events-none opacity-60")}>
            {busy === "upload" ? "Wird hochgeladen …" : has ? "Anderes Bild" : "Bild hochladen"}
            <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={Boolean(busy)} />
          </label>
          {has && <Button variant="quiet" className="h-10 text-[14px]" onClick={remove} disabled={Boolean(busy)}>{busy === "remove" ? "Entfernt …" : "Entfernen"}</Button>}
        </div>
        <p className="text-[12.5px] text-muted mt-2 max-w-sm leading-snug">Wird quadratisch zugeschnitten. Andere Mitglieder sehen es neben deinem Vornamen. Ohne Bild zeigen wir deine Initiale.</p>
        {error && <p className="text-[13px] text-late mt-2" role="alert">{error}</p>}
      </div>
    </div>
  );
}

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
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]" noValidate>
      <Field label="Vorname" error={error?.field === "name" ? error.text : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
      </Field>
      <Field label="Postleitzahl" hint={municipality && code === plz ? municipality : "Bestimmt, welche Regale du in der Nähe siehst."}
        error={error?.field === "plz" ? error.text : null}>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="postal-code" required className="tnum" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || busy}>{busy ? "Speichert …" : dirty ? "Änderungen speichern" : "Gespeichert"}</Button>
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
      <div>
        <div className={itemCls}>
          <span className="min-w-0">
            <span className="block font-[560] tracking-[-0.03em] text-[20px] leading-tight tnum">{fmtPhone(phone)}</span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> Bestätigt am {verifiedAt}</span>
          </span>
        </div>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(true)}>Andere Nummer bestätigen</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {!verifiedAt && <p className="inline-flex items-center gap-2 rounded-[6px] bg-late/[0.08] text-late text-[13.5px] font-medium px-3 py-2 mb-5"><span className="h-1.5 w-1.5 rounded-full bg-late" /> Noch nicht bestätigt – ohne Nummer keine Anfragen</p>}
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
        <ul className={listCls}>
          {visible.map((p) => (
            <li key={p.id} className={itemCls}>
              <span className="min-w-0">
                <span className="block text-[15px]">{p.name}</span>
                <span className="block text-sm text-muted">Hinzugefügt am {p.created}{p.lastUsed ? ` · zuletzt verwendet am ${p.lastUsed}` : " · noch nie verwendet"}</span>
              </span>
              <Button variant="quiet" className="text-sm shrink-0 h-10 px-3" onClick={() => remove(p.id, p.name)}>Entfernen</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2 mb-5 text-[15px]">Du meldest dich bisher per E-Mail-Link an.</p>
      )}
      {supported ? (
        <Button variant="secondary" size="sm" onClick={add} disabled={busy}>{busy ? "Wartet auf dein Gerät …" : "Passkey hinzufügen"}</Button>
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
        <ul className={listCls}>
          {spots.map((s) => (
            <li key={s.id} className={itemCls}>
              <span className="min-w-0">
                <span className="block text-[15px]">{s.label}</span>
                <span className="block text-sm text-muted">
                  {s.detail ? <>Nach Annahme sichtbar: {s.detail}</> : "Ohne genaue Angabe"}
                  {s.dropoff && " · Ablage erlaubt"}
                </span>
              </span>
              <Button variant="quiet" className="text-sm shrink-0 h-10 px-3" onClick={() => remove(s)}>Entfernen</Button>
            </li>
          ))}
        </ul>
      ) : !open && (
        <p className="text-ink-2 mb-5 text-[15px]">Noch kein Übergabeort festgelegt. Ohne Ort schlägst du bei jeder Annahme einen vor.</p>
      )}

      {full ? (
        <p className="text-sm text-muted">Du hast drei Orte festgelegt. Entferne einen, um einen neuen hinzuzufügen.</p>
      ) : open ? (
        <form onSubmit={add} className="flex flex-col gap-5 anim-rise border-t border-line pt-5" noValidate>
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
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Übergabeort hinzufügen</Button>
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
    <div className={cx("rounded-[10px] border px-4 transition-colors duration-300", on ? "bg-lent/10 border-lent/30" : "bg-paper border-line")}>
      <Switch checked={on} onChange={(v) => set(v)} label={<span className="font-medium">Regal pausieren</span>} hint={on ? "Pausiert. Niemand kann anfragen." : "Offen. Anfragen sind möglich."} />
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
    <div className="divide-y divide-line -my-3">
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

  if (!blocks.length) return <p className="text-ink-2 text-[15px]">Du hast niemanden blockiert.</p>;
  return (
    <ul className="space-y-2">
      {blocks.map((b) => (
        <li key={b.id} className={itemCls}>
          <span className="min-w-0">
            <span className="block text-[15px]">{b.name}</span>
            <span className="block text-sm text-muted">Blockiert seit {b.since}</span>
          </span>
          <Button variant="quiet" className="text-sm shrink-0 h-10 px-3" onClick={() => unblock(b)}>Aufheben</Button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- Darstellung */
export function ThemeChoice() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);
  const opts: { value: Theme; label: string; desc: string; swatch: string }[] = [
    { value: "light", label: "Hell", desc: "Papier und Tinte", swatch: "bg-[#faf8f4]" },
    { value: "dark", label: "Dunkel", desc: "Für den Abend", swatch: "bg-[#0f0f0e]" },
    { value: "system", label: "System", desc: "Wie dein Gerät", swatch: "bg-[linear-gradient(90deg,#faf8f4_50%,#0f0f0e_50%)]" },
  ];
  return (
    <div role="radiogroup" aria-label="Darstellung" className="grid grid-cols-3 gap-2 max-w-[460px]">
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
      if (!reg) throw new Error("Die App ist auf diesem Gerät noch nicht bereit. Lade die Seite neu und versuche es erneut.");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const r = await api<{ devices: number }>("/push", { body: sub.toJSON() });
      setDevices(r.devices);
      setState("on");
      toast.show({ text: "Push ist auf diesem Gerät an." });
    } catch (e) {
      toast.error(msg(e));
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
      toast.show({ text: "Push ist auf diesem Gerät aus." });
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await api("/push", { body: { test: true } });
      toast.show({ text: "Testmitteilung unterwegs. Sie kommt in wenigen Sekunden." });
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <div className="skeleton h-[60px] rounded-[10px] max-w-[460px]" />;
  if (state === "ios-install") {
    return (
      <Notice>
        Auf iPhone und iPad gibt es Push nur in der installierten App: Tippe in Safari auf <strong>Teilen</strong>, dann auf
        <strong> Zum Home-Bildschirm</strong>. Öffne Leihregal danach vom Home-Bildschirm und schalte Push hier ein.
      </Notice>
    );
  }
  if (state === "unsupported") return <Notice>Dieser Browser unterstützt keine Push-Mitteilungen. In Chrome, Edge, Firefox und Safari klappt es.</Notice>;
  if (state === "denied") {
    return <Notice>Mitteilungen sind für Leihregal im Browser blockiert. Erlaube sie in den Website-Einstellungen (Schloss-Symbol neben der Adresse) und lade die Seite neu.</Notice>;
  }
  const on = state === "on";
  return (
    <div className="max-w-[560px]">
      <div className={cx("rounded-[10px] border px-4 transition-colors duration-300", on ? "bg-accent-soft/35 border-accent/30" : "bg-paper border-line")}>
        <Switch checked={on} disabled={busy} onChange={(v) => (v ? enable() : disable())}
          label={<span className="font-medium">Auf diesem Gerät</span>}
          hint={on ? "An. Anfragen, Zusagen, Fristen und Nachrichten kommen als Mitteilung." : "Aus. Neues siehst du in der App und per E-Mail."} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <span>{devices === 0 ? "Noch auf keinem Gerät aktiv." : devices === 1 ? "Auf 1 Gerät aktiv." : `Auf ${devices} Geräten aktiv.`}</span>
        {on && <button type="button" onClick={test} disabled={busy} className="font-medium text-accent-hover hover:underline underline-offset-4 disabled:opacity-50">Testmitteilung senden</button>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Daten und Konto */
export function ExportData() {
  return (
    <a href="/api/v1/me/export" download
      className="inline-flex items-center gap-2 h-11 px-5 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[15px] hover:bg-accent hover:text-accent-ink transition-colors duration-200">
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
      Daten herunterladen
    </a>
  );
}

export function Logout() {
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
  return <Button variant="secondary" onClick={logout} disabled={busy}>{busy ? "Meldet ab …" : "Abmelden"}</Button>;
}

export function DeleteAccount() {
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
      setError({ text: msg(e), openLoans: e instanceof ApiError && e.code === "open_loans" });
      setConfirm(false);
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0">
      {!confirm ? (
        <div>
          <p className="text-[15px] text-ink-2 max-w-prose">Deine Bücher verschwinden aus allen Regalen. Wunschliste, Kreise und Übergabeorte werden gelöscht.</p>
          <button type="button" onClick={() => { setConfirm(true); setError(null); }}
            className="mt-5 inline-flex items-center h-11 px-5 rounded-[6px] border border-late/50 text-late font-medium text-[15px] hover:bg-late hover:text-paper hover:border-late transition-colors duration-200">
            Konto löschen …
          </button>
        </div>
      ) : (
        <div className="rounded-[10px] bg-paper border border-late/40 p-5 anim-rise" role="group" aria-label="Löschen bestätigen">
          <p className="ui-title text-[16px]">Wirklich löschen?</p>
          <p className="text-[15px] text-ink-2 mt-1.5 max-w-prose">
            Das lässt sich nicht rückgängig machen. Deine Bücher verschwinden aus allen Regalen, Wunschliste, Kreise und Übergabeorte werden gelöscht.
            Abgeschlossene Vorgänge bleiben ohne deinen Namen erhalten.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5">
            <button type="button" onClick={destroy} disabled={busy} autoFocus
              className="inline-flex items-center h-11 px-5 rounded-[6px] bg-late text-paper font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-45">
              {busy ? "Löscht …" : "Endgültig löschen"}
            </button>
            <Button variant="quiet" className="h-11" onClick={() => setConfirm(false)} disabled={busy}>Abbrechen</Button>
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
  );
}
