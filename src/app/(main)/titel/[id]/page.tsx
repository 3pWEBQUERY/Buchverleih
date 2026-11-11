import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { origin as originOf } from "@/lib/page";
import { plzInfo } from "@/lib/account";
import { copiesOfWork } from "@/lib/copies";
import { workById, wishFor } from "@/lib/title-queries";
import { fmtDistance } from "@/lib/geo";
import { conditionLabel, languageLabel, offerLabel, trustLabel } from "@/lib/i18n/de-CH";
import { Cover } from "@/components/cover";
import { StatusText, shelfStatusText } from "@/components/status";
import { LinkButton, SectionTitle } from "@/components/ui";
import { ShippingSignal, WishButton } from "./title-actions";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const w = await workById((await params).id);
  return { title: w ? w.title : "Titel" };
}

/** Titelseite (PRD 8.4): Welche Exemplare gibt es in der Nähe? Zustand, Entfernung, Verleiher, «Anfragen». */
export default async function TitelPage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;
  const work = await workById(id);
  if (!work) notFound();

  const user = await getUser();
  const viewer = user?.onboarded_at ? user : null;
  let o = originOf(viewer);
  let place: string | null = viewer?.municipality ?? null;
  const plz = typeof sp.plz === "string" && /^\d{4}$/.test(sp.plz) ? sp.plz : "";
  if (!o && plz) {
    const p = await plzInfo(plz);
    if (p) {
      o = { lat: p.lat, lng: p.lng };
      place = p.municipality;
    }
  }

  const [copies, wish] = await Promise.all([
    copiesOfWork(work.id, viewer?.id ?? null, o),
    viewer ? wishFor(viewer.id, work.id) : Promise.resolve(null),
  ]);
  const others = copies.filter((c) => c.owner_id !== viewer?.id);
  const own = copies.filter((c) => c.owner_id === viewer?.id);
  const freeCount = others.filter((c) => c.free_now).length;
  // Ein nächster Schritt: nur das nächste freie Exemplar bekommt die Akzentfarbe
  const nextId = others.find((c) => c.free_now)?.id;
  const nextPath = `/titel/${work.id}`;

  const cover = {
    title: work.title,
    authors: work.authors,
    coverKey: work.cover_key ?? copies.find((c) => c.cover_key)?.cover_key ?? null,
    photoKey: work.cover_key ? null : copies.find((c) => c.photo_key)?.photo_key ?? null,
    photoW: work.cover_key ? null : copies.find((c) => c.photo_key)?.photo_w ?? null,
    photoH: work.cover_key ? null : copies.find((c) => c.photo_key)?.photo_h ?? null,
    seed: work.id,
  };

  return (
    <article className="md:grid md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] md:gap-12 lg:gap-16">
      <div className="mb-8 md:mb-0">
        <div className="md:sticky md:top-12 flex md:block items-end gap-5">
          <div className="hidden lg:block"><Cover data={cover} width={300} large priority className="anim-cover" /></div>
          <div className="hidden md:block lg:hidden"><Cover data={cover} width={240} large priority className="anim-cover" /></div>
          <div className="md:hidden"><Cover data={cover} width={150} large priority className="anim-cover" /></div>
        </div>
      </div>

      <div className="min-w-0">
        <header>
          {work.genre && <p className="eyebrow">{work.genre}</p>}
          <h1 className="display text-4xl md:text-6xl mt-2 break-words hyphens-auto" lang="de">{work.title}</h1>
          {work.subtitle && <p className="font-serif text-xl md:text-2xl text-ink-2 mt-3 leading-snug">{work.subtitle}</p>}
          {work.authors.length > 0 && <p className="text-lg mt-4">{work.authors.join(", ")}</p>}
        </header>

        <div className="mt-6 pt-5 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-3">
          <WishButton workId={work.id} loggedIn={!!viewer} onList={!!wish} alarm={wish?.alarm ?? false} next={nextPath} primary={!nextId} />
          <p className="text-sm text-muted max-w-sm">
            {wish
              ? wish.alarm
                ? `Titelalarm an: Wir melden uns, sobald ein Exemplar im Umkreis von ${wish.radius_km} km frei wird.`
                : "Auf deiner Wunschliste, Titelalarm aus."
              : "Mit dem Titelalarm melden wir uns, sobald ein Exemplar in deiner Nähe frei wird."}
          </p>
        </div>

        <section className="mt-12" aria-labelledby="exemplare">
          <SectionTitle aside={others.length > 0 && <span className="tnum">{freeCount === 1 ? "1 jetzt frei" : `${freeCount} jetzt frei`}</span>}>
            <span id="exemplare">{others.length === 1 ? "1 Exemplar" : `${others.length} Exemplare`}{place ? ` rund um ${place}` : " in der Nähe"}</span>
          </SectionTitle>

          {!viewer && !o && (
            <form method="get" className="flex flex-wrap items-center gap-3 mb-5 text-sm">
              <label htmlFor="titel-plz" className="text-ink-2">Postleitzahl, um Entfernungen zu sehen</label>
              <input id="titel-plz" name="plz" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="8180"
                className="w-24 h-9 bg-transparent border border-line-strong rounded-sm px-3 tnum focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink" />
              <button type="submit" className="h-9 px-3 border border-ink rounded-sm hover:bg-ink hover:text-paper transition-colors">Zeigen</button>
            </form>
          )}

          {others.length === 0 ? (
            <div className="py-8 border-b border-line">
              <p className="text-ink-2">Im Moment steht kein Exemplar in deiner Nähe im Regal. Setz den Titel auf die Wunschliste, dann melden wir uns.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line border-b border-line">
              {others.map((c) => {
                const st = c.free_now ? { tone: "ok" as const, text: "Verfügbar jetzt" } : shelfStatusText(c);
                const binding = c.binding === "hardcover" ? "Gebunden" : c.binding === "paperback" ? "Taschenbuch" : null;
                const edition = [c.year, c.publisher, binding, c.language ? languageLabel[c.language] ?? c.language : null].filter(Boolean).join(" · ");
                const dist = fmtDistance(c.dist);
                return (
                  <li key={c.id} className="py-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,190px)_auto] items-center">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-x-3 flex-wrap">
                        <span className="font-serif text-xl leading-tight">{conditionLabel[c.condition]}</span>
                        {dist && <span className="text-[15px] text-ink-2">{dist}</span>}
                      </div>
                      {edition && <div className="text-sm text-muted mt-0.5">{edition}</div>}
                    </div>
                    <div className="text-sm min-w-0 col-start-1 sm:col-start-auto row-start-2 sm:row-start-auto">
                      <Link href={`/profil/${c.owner_id}`} className="hover:underline">{c.owner_name}</Link>
                      <span className="text-muted"> · {trustLabel[c.owner_trust] ?? "Neu"}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StatusText tone={st.tone}>{st.text}</StatusText>
                        <span className="text-[13px] text-muted">{c.offers.map((x) => offerLabel[x]).join(" · ")}</span>
                      </div>
                    </div>
                    <div className="row-span-2 sm:row-span-1 self-center">
                      <LinkButton href={`/exemplar/${c.id}`} variant={c.id === nextId ? "primary" : "secondary"} size="md">
                        Anfragen
                      </LinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {own.length > 0 && (
            <p className="text-sm text-muted mt-4">
              Du hast {own.length === 1 ? "selbst ein Exemplar" : `selbst ${own.length} Exemplare`} im Regal.{" "}
              <Link href={`/exemplar/${own[0].id}`} className="underline underline-offset-4 hover:text-ink">Ansehen</Link>
            </p>
          )}

          <div className="mt-8">
            <ShippingSignal />
          </div>
        </section>
      </div>
    </article>
  );
}
