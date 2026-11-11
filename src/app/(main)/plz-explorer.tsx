"use client";
import Link from "next/link";
import { useState } from "react";
import { Cover } from "@/components/cover";
import { fmtDistance } from "@/lib/geo";
import { IconArrowRight, IconSearch } from "@/components/icons";

type Copy = { id: string; title: string; authors: string[]; photo_key: string | null; photo_w: number | null; photo_h: number | null; cover_key: string | null; dist: number; owner_name: string; work_id: string; status: string };
type Res = { known: boolean; open: boolean; municipality?: string; region?: string; copies: Copy[] };

/** Postleitzahl eingeben und echten Bestand sehen (PRD 8.4) – auf der dunklen Bühne. */
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
    <div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-night-muted">Was steht in deiner Nähe?</p>
          <p className="text-[30px] md:text-[40px] font-[560] tracking-[-0.035em] leading-tight mt-2">Postleitzahl eingeben, Bestand sehen.</p>
        </div>
        <form onSubmit={look} className="min-w-0 flex items-center gap-2 p-1.5 pl-5 rounded-[6px] bg-night-2 border border-night-line focus-within:border-night-ink transition-colors w-full md:w-[420px]">
          <IconSearch width={20} height={20} className="text-night-muted flex-none" />
          <input inputMode="numeric" autoComplete="postal-code" maxLength={4} size={6} placeholder="z. B. 8180" value={plz} aria-label="Postleitzahl"
            onChange={(e) => setPlz(e.target.value.replace(/\D/g, ""))}
            className="flex-1 min-w-0 bg-transparent h-12 text-[20px] tnum tracking-[0.06em] placeholder:text-night-muted/60 focus:outline-none" />
          <button type="submit" disabled={plz.length !== 4}
            className="h-12 px-6 flex-none rounded-[6px] bg-accent text-accent-ink font-semibold disabled:opacity-40 hover:bg-accent-hover transition-colors active:scale-[0.97]">
            Ansehen
          </button>
        </form>
      </div>

      <div className="mt-10 min-h-[40px]" aria-live="polite">
        {loading && (
          <div className="flex gap-5 items-end" aria-hidden>
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="w-[110px] rounded-[4px] bg-night-2 animate-pulse" style={{ height: 150 + (i % 3) * 14 }} />)}
          </div>
        )}
        {!loading && res && !res.known && <p className="text-night-muted">Diese Postleitzahl kennen wir nicht. Prüfe die vier Ziffern.</p>}
        {!loading && res?.known && !res.open && (
          <div className="max-w-xl anim-rise">
            <p className="text-[30px] font-[560] tracking-[-0.035em]">{res.municipality} ist noch nicht offen.</p>
            <p className="text-night-muted mt-2">Wir öffnen Region für Region, sobald genug Bücher zusammenkommen. Trag dich ein, dann melden wir uns einmal.</p>
            {joined ? (
              <p className="mt-5 font-medium">Danke. Wir schreiben dir, wenn {res.municipality} startet.</p>
            ) : (
              <form onSubmit={wait} className="mt-5 flex flex-wrap gap-2">
                <input type="email" required placeholder="E-Mail-Adresse" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="h-12 px-5 rounded-[6px] bg-night-2 border border-night-line focus:border-night-ink focus:outline-none w-72" />
                <button className="h-12 px-6 rounded-[6px] bg-accent text-accent-ink font-semibold">Auf die Warteliste</button>
              </form>
            )}
          </div>
        )}
        {!loading && res?.open && res.copies.length === 0 && (
          <div className="flex flex-wrap items-center gap-4 justify-between rounded-[8px] border border-night-line p-6 anim-rise">
            <p>Rund um {res.municipality} steht noch nichts im Regal. Stell das erste Buch hinein.</p>
            <Link href="/anmelden?next=/regal/neu" className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-semibold inline-flex items-center">Buch einstellen</Link>
          </div>
        )}
        {!loading && res?.open && res.copies.length > 0 && (
          <div className="anim-rise">
            <div className="flex items-baseline justify-between mb-5 gap-4">
              <p className="text-night-muted">{res.copies.length} neu im Umkreis von 5 km um {res.municipality}</p>
              <Link href="/anmelden?next=/suche" className="inline-flex items-center gap-1.5 font-semibold link-grow whitespace-nowrap">Anmelden und anfragen <IconArrowRight width={16} height={16} /></Link>
            </div>
            <ul className="shelf" aria-label={`Bücher bei ${res.municipality}`}>
              {res.copies.map((c, i) => {
                const cover = { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id };
                const w = 110;
                return (
                  <li key={c.id} style={{ width: w, animationDelay: `${i * 35}ms` }} className="anim-rise">
                    <Link href={`/titel/${c.work_id}`} className="book block group">
                      <div className="flex items-end" style={{ height: 176 }}><div className="book-face"><Cover data={cover} width={110} height={165} uniform /></div></div>
                      <div className="h-[3px] bg-night-ink/90 rounded-full" />
                      <p className="pt-2.5 text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline">{c.title}</p>
                      <p className="text-[12px] text-night-muted mt-0.5">{c.owner_name} · {fmtDistance(c.dist)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
