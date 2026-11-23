"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { labels } from "@/lib/i18n/labels";
import type { Locale } from "@/lib/i18n/locale";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { Button, Notice, Segmented, cx } from "@/components/ui";
import { IconCamera, IconCheck } from "@/components/icons";
import type { SpineMatch } from "@/lib/shelf-photo";
import type { Added } from "./erfassen";

const TEXT: Record<Locale, { take: string; other: string; reading: string; found: (n: number) => string; none: string; notFound: string; manual: string; condition: string; add: (n: number) => string; adding: (d: number, n: number) => string; done: (n: number) => string; unsure: string; off: string }> = {
  de: { take: "Foto aufnehmen oder wählen", other: "Anderes Foto", reading: "Lese die Buchrücken …", found: (n) => `${n} ${n === 1 ? "Buch" : "Bücher"} erkannt. Wähle, was ins Regal kommt.`, none: "Auf dem Foto haben wir keine Buchrücken erkannt. Versuch es näher und mit mehr Licht.", notFound: "nicht im Katalog", manual: "Von Hand erfassen", condition: "Zustand für alle", add: (n) => `${n} ${n === 1 ? "Buch" : "Bücher"} ins Regal`, adding: (d, n) => `${d} von ${n} …`, done: (n) => `${n} ${n === 1 ? "Buch steht" : "Bücher stehen"} im Regal.`, unsure: "unsicher gelesen", off: "Die Regalfoto-Erkennung ist noch nicht eingerichtet." },
  fr: { take: "Prendre ou choisir une photo", other: "Autre photo", reading: "Lecture des dos de livres …", found: (n) => `${n} ${n === 1 ? "livre reconnu" : "livres reconnus"}. Choisis ce qui va sur ton étagère.`, none: "Nous n’avons reconnu aucun dos de livre. Essaie de plus près et avec plus de lumière.", notFound: "pas dans le catalogue", manual: "Saisir à la main", condition: "État pour tous", add: (n) => `${n} ${n === 1 ? "livre" : "livres"} sur l’étagère`, adding: (d, n) => `${d} sur ${n} …`, done: (n) => `${n} ${n === 1 ? "livre est" : "livres sont"} sur ton étagère.`, unsure: "lecture incertaine", off: "La reconnaissance de photos d’étagère n’est pas encore configurée." },
  it: { take: "Scatta o scegli una foto", other: "Altra foto", reading: "Lettura dei dorsi …", found: (n) => `${n} ${n === 1 ? "libro riconosciuto" : "libri riconosciuti"}. Scegli cosa va sullo scaffale.`, none: "Non abbiamo riconosciuto dorsi di libri. Prova più da vicino e con più luce.", notFound: "non nel catalogo", manual: "Inserisci a mano", condition: "Stato per tutti", add: (n) => `${n} ${n === 1 ? "libro" : "libri"} sullo scaffale`, adding: (d, n) => `${d} di ${n} …`, done: (n) => `${n} ${n === 1 ? "libro è" : "libri sono"} sullo scaffale.`, unsure: "lettura incerta", off: "Il riconoscimento delle foto dello scaffale non è ancora configurato." },
  en: { take: "Take or choose a photo", other: "Other photo", reading: "Reading the spines …", found: (n) => `${n} ${n === 1 ? "book" : "books"} recognised. Choose what goes on your shelf.`, none: "We didn’t recognise any spines. Try closer and with more light.", notFound: "not in the catalogue", manual: "Add by hand", condition: "Condition for all", add: (n) => `${n} ${n === 1 ? "book" : "books"} to your shelf`, adding: (d, n) => `${d} of ${n} …`, done: (n) => `${n} ${n === 1 ? "book is" : "books are"} on your shelf.`, unsure: "uncertain reading", off: "Shelf photo recognition isn’t set up yet." },
};

/** Foto im Browser verkleinern (lange Seite höchstens 1600 px): schneller und günstiger zu lesen */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
}

export function ShelfPhotoTab({ enabled, libraryCircleId, onAdded, onManual }: {
  enabled: boolean;
  libraryCircleId?: string;
  onAdded: (a: Added) => void;
  onManual: (title: string) => void;
}) {
  const l = useLocale();
  const t = TEXT[l];
  const L = labels(l);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [matches, setMatches] = useState<SpineMatch[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [condition, setCondition] = useState(2);
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const [added, setAdded] = useState(0);

  async function read(file: File) {
    setReading(true);
    setMatches(null);
    setAdded(0);
    try {
      const blob = await shrink(file).catch(() => file);
      const res = await fetch("/api/v1/catalog/shelf-photo", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? t.none);
      const m = data.matches as SpineMatch[];
      setMatches(m);
      setPicked(new Set(m.map((x, i) => ((x.edition || x.external) && x.spine.confidence !== "low" ? i : -1)).filter((i) => i >= 0)));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function addPicked() {
    if (!matches) return;
    const list = [...picked].map((i) => matches[i]).filter((m) => m.edition || m.external);
    setRun({ done: 0, total: list.length });
    let ok = 0;
    for (const [i, m] of list.entries()) {
      try {
        let editionId = m.edition?.id;
        let cover = m.edition ? { coverKey: m.edition.cover_key, coverColor: m.edition.cover_color } : {};
        if (!editionId && m.external) {
          const r = await api<{ edition: { id: string; cover_key: string | null; cover_color: string | null } | null }>(`/catalog/isbn/${m.external.isbn13}`);
          editionId = r.edition?.id;
          cover = { coverKey: r.edition?.cover_key ?? null, coverColor: r.edition?.cover_color ?? null };
        }
        if (!editionId) continue;
        const c = await api<{ id: string }>("/copies", { body: { editionId, condition, ...(libraryCircleId ? { libraryCircleId } : {}) } });
        const title = m.edition?.title ?? m.external?.title ?? m.spine.title;
        const authors = m.edition?.authors ?? m.external?.authors ?? [];
        onAdded({ id: c.id, title, authors, condition, circlesOnly: Boolean(libraryCircleId), cover: { title, authors, seed: editionId, ...cover } });
        ok++;
      } catch (e) {
        toast.error((e as Error).message);
      }
      setRun({ done: i + 1, total: list.length });
    }
    setRun(null);
    setAdded(ok);
    setMatches(null);
    setPicked(new Set());
  }

  if (!enabled) return <Notice>{t.off}</Notice>;
  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={matches ? "secondary" : "primary"} size="lg" disabled={reading || Boolean(run)} onClick={() => input.current?.click()}>
          <IconCamera width={18} height={18} /> {matches ? t.other : t.take}
        </Button>
        <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) read(f); }} />
        {reading && <span className="text-body-sm text-muted" role="status">{t.reading}</span>}
      </div>
      {added > 0 && <p className="text-body-sm text-ok font-medium" role="status">{t.done(added)}</p>}

      {matches && (
        matches.length === 0 ? <Notice>{t.none}</Notice> : (
          <>
            <p className="text-body-sm text-ink-2">{t.found(matches.length)}</p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {matches.map((m, i) => {
                const found = m.edition ?? m.external;
                const on = picked.has(i);
                return (
                  <li key={i} className="px-4 py-3 flex items-center gap-3">
                    {found ? (
                      <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(i)} aria-label={found.title}
                        className={cx("h-6 w-6 rounded-xs border grid place-items-center flex-none transition-colors", on ? "bg-accent border-accent text-accent-ink" : "border-field")}>
                        {on && <IconCheck width={14} height={14} strokeWidth={2.4} />}
                      </button>
                    ) : <span className="h-6 w-6 flex-none" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lead leading-tight truncate">{found?.title ?? m.spine.title}</p>
                      <p className="text-meta text-muted truncate">
                        {[found?.authors?.join(", ") || m.spine.author, found?.year, !found ? t.notFound : null, m.spine.confidence === "low" ? t.unsure : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {!found && <Button size="sm" variant="quiet" onClick={() => onManual(m.spine.title)}>{t.manual}</Button>}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-meta font-semibold mb-2">{t.condition}</p>
                <Segmented name={t.condition} value={condition} onChange={setCondition} options={[1, 2, 3, 4].map((c) => ({ value: c, label: L.conditionLabel[c] }))} />
              </div>
              <Button variant="primary" size="lg" disabled={!picked.size || Boolean(run)} onClick={addPicked}>
                {run ? t.adding(run.done, run.total) : t.add(picked.size)}
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}
