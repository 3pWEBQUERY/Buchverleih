"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { CopyDetail } from "@/lib/copies";
import type { Calendar } from "@/lib/loans/calendar";
import { api, uploadPhoto } from "@/lib/client";
import { addDays, dayToDate, fmtDay, fmtRange, todayCH } from "@/lib/dates";
import { imageUrl } from "@/components/cover";
import { useToast } from "@/components/toast";
import { useLocale } from "@/components/locale-provider";
import { Button, Field, Input, cx } from "@/components/ui";
import { IconCamera, IconCheck, IconClose, IconPlus } from "@/components/icons";
import { COPY } from "@/lib/i18n/messages/copy";

/** Bausteine der Seite «Buch bearbeiten»: Speicherstand, Abschnitte, Fotos, Sperrzeiten */


export function SaveState({ state }: { state: "idle" | "saving" | "saved" }) {
  const t = COPY[useLocale()].save;
  return (
    <p className="h-8 px-3 rounded-[6px] border border-line text-[13px] text-muted inline-flex items-center gap-2" aria-live="polite">
      {state === "saving" ? (
        <><span className="h-1.5 w-1.5 rounded-full bg-accent live-dot" /> {t.saving}</>
      ) : state === "saved" ? (
        <><IconCheck width={14} height={14} className="text-ok" /> {t.saved}</>
      ) : (
        <><span className="h-1.5 w-1.5 rounded-full bg-ok" /> {t.idle}</>
      )}
    </p>
  );
}

export function Section({ id, n, title, desc, children, last }: { id: string; n: number; title: string; desc?: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <section id={id} className={cx("scroll-mt-28 pt-12 md:pt-14", !last && "pb-12 md:pb-14 border-b border-line")} aria-labelledby={`${id}-t`}>
      <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-7">
        <span className="text-[13px] tnum text-muted pt-1.5">0{n}</span>
        <div>
          <h2 id={`${id}-t`} className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em]">{title}</h2>
          {desc && <p className="text-[15px] text-muted mt-1.5 max-w-2xl">{desc}</p>}
        </div>
      </div>
      <div className="md:pl-[72px]">{children}</div>
    </section>
  );
}

export function Label({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cx("mb-3", className)}>
      <p className="text-[15px] font-medium">{title}</p>
      {hint && <p className="text-[13.5px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export function StatTile({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line p-4">
      <p className="font-medium text-[15px]">{label}</p>
      <p className="text-[13px] text-muted mt-0.5 mb-4">{hint}</p>
      {children}
    </div>
  );
}

export function Photos({ copy }: { copy: CopyDetail }) {
  const router = useRouter();
  const t = COPY[useLocale()].photo;
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const photos = copy.photos.filter((p) => !hidden.has(p.id));

  async function add(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadPhoto(file, "copy_photo", copy.id);
      await api(`/copies/${copy.id}/photos`, { body: { uploadId: up.id } });
      toast.show({ text: t.added }, 2000);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function remove(id: string) {
    setHidden((h) => new Set(h).add(id));
    // Erst nach Ablauf der Rückgängig-Frist wirklich löschen
    const timer = setTimeout(async () => {
      try {
        await api(`/copies/${copy.id}/photos?photo=${id}`, { method: "DELETE" });
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    }, 5000);
    toast.show({
      text: t.removed,
      undo: () => {
        clearTimeout(timer);
        setHidden((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        });
      },
    });
  }

  return (
    <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {photos.map((p) => (
        <li key={p.id} className="relative aspect-[3/4] group">
          { }
          <img src={imageUrl(p.key)} alt={t.alt(copy.title)} className="h-full w-full object-cover rounded-[8px] outline outline-1 -outline-offset-1 outline-black/10" />
          <button type="button" onClick={() => remove(p.id)} aria-label={t.remove}
            className="absolute top-1.5 right-1.5 h-9 w-9 grid place-items-center rounded-[6px] bg-paper/95 border border-line text-muted hover:text-late hover:border-late transition-colors">
            <IconClose width={14} height={14} />
          </button>
        </li>
      ))}
      <li className="aspect-[3/4]">
        <label className={cx("h-full w-full rounded-[8px] border border-dashed border-line-strong grid place-items-center text-center cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]", uploading && "opacity-45 pointer-events-none")}>
          <span className="flex flex-col items-center gap-2 text-[13px] font-medium text-ink-2 px-2">
            <IconCamera width={22} height={22} className="text-accent-hover" />
            {uploading ? t.loading : t.add}
          </span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading}
            onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </li>
    </ul>
  );
}

export function BlockForm({ copyId, calendar }: { copyId: string; calendar: Calendar }) {
  const router = useRouter();
  const l = useLocale();
  const t = COPY[l].block;
  const toast = useToast();
  const today = todayCH();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [last, setLast] = useState(addDays(today, 13));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const blocks = calendar.bars.filter((b) => b.kind === "block" && (!b.note || !b.note.startsWith("Tausch ")));
  useEffect(() => { if (last < start) setLast(start); }, [start, last]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/copies/${copyId}/blocks`, { body: { start, end: addDays(last, 1), note: note.trim() || undefined } });
      toast.show({ text: t.done(fmtRange({ start, end: addDays(last, 1) }, l)) }, 2500);
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Calendar["bars"][number]) {
    try {
      await api(`/copies/${copyId}/blocks?block=${b.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: t.removed,
        undo: async () => {
          try {
            await api(`/copies/${copyId}/blocks`, { body: { start: b.start, end: b.end, note: b.note ?? undefined } });
            router.refresh();
          } catch (err) {
            toast.error((err as Error).message);
          }
        },
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-line">
      {blocks.length > 0 && (
        <ul className="mb-4 space-y-2" aria-label={t.aria}>
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 rounded-[8px] bg-paper-2 px-4 py-2.5 text-[14.5px]">
              <span>{fmtRange({ start: b.start, end: b.end }, l)}<span className="text-muted">{b.note ? ` · ${b.note}` : t.blocked}</span></span>
              <button type="button" className="text-[13px] font-medium text-muted hover:text-late" onClick={() => remove(b)}>{t.remove}</button>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-[14px] font-medium text-accent-hover hover:underline underline-offset-4">
          <IconPlus width={16} height={16} /> {t.add}
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-[10px] bg-paper-2 p-4 md:p-5 anim-rise">
          <p className="text-[13.5px] text-muted mb-4">{t.intro}</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label={t.first}><Input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required /></Field>
            <Field label={t.last}><Input type="date" value={last} min={start} onChange={(e) => setLast(e.target.value)} required /></Field>
            <Field label={t.note}><Input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder={t.notePlaceholder} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Button type="submit" variant="primary" disabled={busy}>{t.add}</Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>{t.cancel}</Button>
            {start && last >= start && (
              <span className="text-[13px] text-muted ml-auto">{fmtDay(dayToDate(start), l)} {t.until} {fmtDay(dayToDate(last), l)} · {COPY[l].cal.dayN(Math.round((dayToDate(last).getTime() - dayToDate(start).getTime()) / 86_400_000) + 1)}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
