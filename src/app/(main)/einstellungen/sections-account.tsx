"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { api, ApiError, uploadPhoto } from "@/lib/client";
import { Monogram } from "@/components/person/monogram";
import { useToast } from "@/components/toast";
import { Button, Field, Input, Notice, cx } from "@/components/ui";
import { useLater } from "@/components/use-later";
import { itemCls, listCls, msg, useT } from "./sections-shared";

/** Einstellungen, Bereich Konto: Profilbild, Profil, Mobilnummer, Passkeys */
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
  const T = useT();
  const t = T.avatar;
  const router = useRouter();
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(t.notImage);
    if (file.size > 12 * 1024 * 1024) return setError(t.tooBig);
    setError(null);
    setBusy("upload");
    const square = await squareJpeg(file);
    setPreview(URL.createObjectURL(square));
    try {
      const up = await uploadPhoto(square, "avatar");
      await api("/me", { method: "PATCH", body: { avatarUploadId: up.id } });
      toast.show({ text: t.saved });
      router.refresh();
    } catch (e) {
      setPreview(null);
      setError(msg(e, T));
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
      toast.show({ text: t.removed });
      router.refresh();
    } catch (e) {
      setError(msg(e, T));
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
            {busy === "upload" ? t.uploading : has ? t.other : t.upload}
            <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={Boolean(busy)} />
          </label>
          {has && <Button variant="quiet" className="h-10 text-[14px]" onClick={remove} disabled={Boolean(busy)}>{busy === "remove" ? t.removing : T.remove}</Button>}
        </div>
        <p className="text-[12.5px] text-muted mt-2 max-w-sm leading-snug">{t.hint}</p>
        {error && <p className="text-[13px] text-late mt-2" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Profil */
export function ProfileForm({ firstName, plz, municipality }: { firstName: string; plz: string; municipality: string | null }) {
  const T = useT();
  const t = T.profile;
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(firstName);
  const [code, setCode] = useState(plz);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "name" | "plz"; text: string } | null>(null);
  const dirty = name.trim() !== firstName || code !== plz;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError({ field: "name", text: t.nameMissing });
    if (!/^\d{4}$/.test(code)) return setError({ field: "plz", text: t.plzInvalid });
    setBusy(true);
    setError(null);
    try {
      await api("/me", { method: "PATCH", body: { firstName: name.trim(), ...(code !== plz ? { plz: code } : {}) } });
      toast.show({ text: t.saved });
      router.refresh();
    } catch (e) {
      setError({ field: e instanceof ApiError && e.code === "invalid" && /Vorname|prénom|nome/i.test(e.message) ? "name" : "plz", text: msg(e, T) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]" noValidate>
      <Field label={t.firstName} error={error?.field === "name" ? error.text : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
      </Field>
      <Field label={t.plz} hint={municipality && code === plz ? municipality : t.plzHint}
        error={error?.field === "plz" ? error.text : null}>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="postal-code" required className="tnum" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || busy}>{busy ? T.saving : dirty ? t.save : t.savedBtn}</Button>
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
  const T = useT();
  const t = T.phone;
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
      setError(msg(e, T));
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
      toast.show({ text: t.confirmed });
      setEditing(false);
      setStep("number");
      setDevCode(null);
      router.refresh();
    } catch (e) {
      setError(msg(e, T));
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
            <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> {t.confirmedOn(verifiedAt)}</span>
          </span>
        </div>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(true)}>{t.other}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {!verifiedAt && <p className="inline-flex items-center gap-2 rounded-[6px] bg-late/[0.08] text-late text-[13.5px] font-medium px-3 py-2 mb-5"><span className="h-1.5 w-1.5 rounded-full bg-late" /> {t.notYet}</p>}
      {step === "number" ? (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <Field label={t.label} hint={t.hint} error={error}>
            <Input type="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="079 123 45 67" autoComplete="tel" inputMode="tel" />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="primary" disabled={busy || number.replace(/\D/g, "").length < 9}>{busy ? t.sending : t.send}</Button>
            {verifiedAt && <Button type="button" variant="quiet" onClick={() => { setEditing(false); setError(null); }}>{T.cancel}</Button>}
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <Field label={t.codeLabel} hint={t.codeHint(number)} error={error}>
            <Input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="tnum tracking-[0.3em] max-w-48" />
          </Field>
          {devCode && <Notice>{t.dev[0]}<span className="tnum font-medium">{devCode}</span>{t.dev[1]}</Notice>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>{busy ? t.checking : t.confirm}</Button>
            <Button type="button" variant="quiet" onClick={() => send()} disabled={busy}>{t.resend}</Button>
            <Button type="button" variant="quiet" onClick={() => { setStep("number"); setError(null); }}>{t.change}</Button>
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
  const T = useT();
  const t = T.passkeys;
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
      toast.show({ text: t.added });
      router.refresh();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") setError(t.aborted);
      else if (name === "InvalidStateError") setError(t.exists);
      else setError(msg(e, T));
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string, label: string) {
    setHidden((s) => new Set(s).add(id));
    later(t.removing(label), () => api(`/me/passkeys?id=${encodeURIComponent(id)}`, { method: "DELETE" }), () =>
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
                <span className="block text-sm text-muted">{t.meta(p.created, p.lastUsed)}</span>
              </span>
              <Button variant="quiet" className="text-sm shrink-0 h-10 px-3" onClick={() => remove(p.id, p.name)}>{T.remove}</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2 mb-5 text-[15px]">{t.none}</p>
      )}
      {supported ? (
        <Button variant="secondary" size="sm" onClick={add} disabled={busy}>{busy ? t.waiting : t.add}</Button>
      ) : (
        <p className="text-sm text-muted">{t.unsupported}</p>
      )}
      {error && <p className="text-sm text-late mt-3" role="alert">{error}</p>}
    </div>
  );
}

