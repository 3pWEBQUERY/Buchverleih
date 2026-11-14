"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Check, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { COMMUNITY } from "@/lib/i18n/messages/community";
import { IconFlag } from "@/components/icons";

const NOTE_MAX = 200;

/** Besitzerin blendet einzelne Zettel aus (umkehrbar, darum ohne Rückfrage); alle anderen können melden. */
export function NoteActions({ id, hidden, own, canReport }: { id: string; hidden: boolean; own: boolean; canReport: boolean }) {
  const t = COMMUNITY[useLocale()].notes;
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function setHidden(v: boolean, undoable = true) {
    setBusy(true);
    try {
      await api(`/notes/${id}`, { method: "PATCH", body: { hidden: v } });
      router.refresh();
      toast.show({ text: v ? t.hiddenDone : t.shownDone, undo: undoable ? () => setHidden(!v, false) : undefined });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function report() {
    try { await api("/reports", { body: { targetType: "book_note", targetId: id, reason: "harassment" } }); toast.show({ text: t.reported }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <span className="inline-flex items-center gap-4 text-meta">
      {own && <button type="button" disabled={busy} onClick={() => setHidden(!hidden)} className="min-h-11 md:min-h-8 font-medium underline underline-offset-4 hover:text-accent-hover disabled:opacity-50">{hidden ? t.show : t.hide}</button>}
      {canReport && <button type="button" onClick={report} className="min-h-11 md:min-h-8 inline-flex items-center gap-1 text-muted hover:text-ink"><IconFlag width={12} height={12} aria-hidden /> {t.report}</button>}
    </span>
  );
}

/**
 * Zettel im Buch: nach Abschluss der Leihe kann die leihende Person einen Satz für die nächsten
 * Leser hinterlassen (≤ 200 Zeichen, mit Vorname oder anonym). Steht im selben Schritt wie die Bewertung.
 */
export function BookNoteForm({ loanId, existing }: { loanId: string; existing: { body: string; anonymous: boolean } | null }) {
  const t = COMMUNITY[useLocale()].notes;
  const toast = useToast();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(existing);

  if (saved) {
    return (
      <div className="pt-5 max-w-xl">
        <p className="eyebrow">{t.yours}</p>
        <blockquote lang="de" className="font-serif italic text-lead leading-snug mt-2 break-words">«{saved.body}»</blockquote>
      </div>
    );
  }
  const left = NOTE_MAX - body.length;
  return (
    <form className="pt-5 max-w-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim() || busy) return;
        setBusy(true);
        try {
          await api(`/loans/${loanId}/note`, { body: { body: body.trim(), anonymous } });
          setSaved({ body: body.trim(), anonymous });
          toast.show({ text: t.saved });
          router.refresh();
        } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
      }}>
      <label htmlFor="zettel" className="block text-title-sm font-title tracking-title">{t.formTitle}</label>
      <p id="zettel-hint" className="text-body-sm text-muted mt-1">{t.formHint}</p>
      <Textarea id="zettel" aria-describedby="zettel-hint zettel-left" value={body} onChange={(e) => setBody(e.target.value)} maxLength={NOTE_MAX}
        placeholder={t.placeholder} className="mt-3 min-h-20 font-serif italic" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Check checked={anonymous} onChange={setAnonymous} label={t.anonymous} className="min-h-11" />
        <span id="zettel-left" className="text-caption text-muted tnum" aria-live={left <= 20 ? "polite" : "off"}>{t.left(left)}</span>
      </div>
      <Button type="submit" variant="secondary" className="mt-3" disabled={busy || !body.trim()}>{t.save}</Button>
    </form>
  );
}

/** Auf dem eigenen Exemplar: wie viele in den eigenen Kreisen dieses Buch suchen. Namen erst nach Antippen. */
export function WishersHint({ copyId, count }: { copyId: string; count: number }) {
  const t = COMMUNITY[useLocale()].wishers;
  const [people, setPeople] = useState<{ id: string; first_name: string; circle_name: string }[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  if (count <= 0) return null;
  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (people) return;
    setError(false);
    try { setPeople((await api<{ people: { id: string; first_name: string; circle_name: string }[] }>(`/copies/${copyId}/wishers`)).people); }
    catch { setError(true); }
  }
  return (
    <div className="rounded-md bg-paper-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-body-sm font-medium flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait flex-none" />{t.count(count)}</p>
        <button type="button" aria-expanded={open} aria-controls="wer-sucht" onClick={toggle} className="min-h-11 md:min-h-8 text-body-sm font-medium text-accent-hover underline underline-offset-4">{open ? t.hide : t.show}</button>
      </div>
      <div id="wer-sucht" hidden={!open} aria-live="polite">
        {error ? <p className="text-body-sm text-late mt-2" role="alert">{t.error}</p>
          : !people ? <div className="mt-3 space-y-2"><div className="skeleton h-4 w-40" /><div className="skeleton h-4 w-32" /></div>
          : <ul className="mt-2 space-y-1 text-body-sm">{people.map((p) => <li key={p.id}><span className="font-medium">{p.first_name}</span> <span className="text-muted">{t.inCircle(p.circle_name)}</span></li>)}</ul>}
      </div>
    </div>
  );
}
