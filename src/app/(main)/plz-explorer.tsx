"use client";
import Link from "next/link";
import { useState } from "react";
import { Shelf, ShelfSkeleton } from "@/components/shelf";
import { Button, Input } from "@/components/ui";
import { fmtDistance } from "@/lib/geo";

type Copy = { id: string; title: string; authors: string[]; photo_key: string | null; photo_w: number | null; photo_h: number | null; cover_key: string | null; dist: number; owner_name: string; work_id: string };
type Res = { known: boolean; open: boolean; municipality?: string; region?: string; copies: Copy[] };

export function PlzExplorer() {
  const [plz, setPlz] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  async function look(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^\d{4}$/.test(plz)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/regions/plz/${plz}`);
      setRes(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function wait(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/v1/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, plz }) });
    if (r.ok) setJoined(true);
  }

  return (
    <section className="pt-10 md:pt-14">
      <form onSubmit={look} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="eyebrow block mb-2">Was steht in deiner Nähe?</span>
          <Input inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="Postleitzahl, z. B. 8180" value={plz}
            onChange={(e) => setPlz(e.target.value.replace(/\D/g, ""))} className="w-64 h-12 text-lg tnum" aria-label="Postleitzahl" />
        </label>
        <Button type="submit" variant="secondary" size="lg" disabled={plz.length !== 4}>Bestand ansehen</Button>
      </form>

      <div className="mt-8 min-h-[260px]" aria-live="polite">
        {loading && <ShelfSkeleton />}
        {!loading && res && !res.known && <p className="text-ink-2 py-6">Diese Postleitzahl kennen wir nicht. Prüfe die vier Ziffern.</p>}
        {!loading && res?.known && !res.open && (
          <div className="py-6 max-w-xl">
            <p className="font-serif text-2xl">{res.municipality} ist noch nicht offen.</p>
            <p className="text-ink-2 mt-2">Wir öffnen Region für Region, sobald genug Bücher zusammenkommen. Trag dich ein, dann melden wir uns einmal.</p>
            {joined ? (
              <p className="mt-4">Danke. Wir schreiben dir, wenn {res.municipality} startet.</p>
            ) : (
              <form onSubmit={wait} className="mt-4 flex flex-wrap gap-3">
                <Input type="email" required placeholder="E-Mail-Adresse" value={email} onChange={(e) => setEmail(e.target.value)} className="w-72" />
                <Button type="submit">Auf die Warteliste</Button>
              </form>
            )}
          </div>
        )}
        {!loading && res?.open && res.copies.length === 0 && (
          <div className="py-6 flex flex-wrap items-center gap-4 justify-between border-y border-line">
            <p>Rund um {res.municipality} steht noch nichts im Regal. Stell das erste Buch hinein.</p>
            <Link href="/anmelden?next=/regal/neu" className="font-medium underline underline-offset-4">Buch einstellen</Link>
          </div>
        )}
        {!loading && res?.open && res.copies.length > 0 && (
          <div className="anim-rise">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-ink-2">Neu im Umkreis von 5 km um {res.municipality}</p>
              <Link href={`/anmelden?next=/suche`} className="text-sm font-medium underline underline-offset-4">Anmelden und anfragen</Link>
            </div>
            <Shelf
              label={`Bücher bei ${res.municipality}`}
              items={res.copies.map((c) => ({
                id: c.id,
                href: `/titel/${c.work_id}`,
                cover: { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id },
                caption: c.title,
                meta: <span className="text-xs text-muted">{c.owner_name} · {fmtDistance(c.dist)}</span>,
              }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}
