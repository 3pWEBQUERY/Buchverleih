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
import { Spine } from "@/components/spine";
import { shelfStatusText } from "@/components/status";
import { Monogram } from "@/components/person/monogram";
import { LinkButton, SectionTitle, cx } from "@/components/ui";
import { ShippingSignal, WishButton } from "./title-actions";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const w = await workById((await params).id);
  return { title: w ? w.title : "Titel" };
}

const toneDot = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" } as const;

function responseHint(sec: number | null) {
  if (sec == null) return null;
  const h = sec / 3600;
  if (h < 1) return "antwortet meist innert einer Stunde";
  if (h < 36) return `antwortet meist innert ${Math.round(h)} Std.`;
  return `antwortet meist innert ${Math.round(h / 24)} Tagen`;
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
  const nearest = others.find((c) => c.dist != null)?.dist ?? null;

  const cover = {
    title: work.title,
    authors: work.authors,
    coverKey: work.cover_key ?? copies.find((c) => c.cover_key)?.cover_key ?? null,
    photoKey: work.cover_key ? null : copies.find((c) => c.photo_key)?.photo_key ?? null,
    photoW: work.cover_key ? null : copies.find((c) => c.photo_key)?.photo_w ?? null,
    photoH: work.cover_key ? null : copies.find((c) => c.photo_key)?.photo_h ?? null,
    seed: work.id,
  };
  const long = work.title.length > 22;

  return (
    <article className="space-y-14 md:space-y-16">
      {/* ------------------------------------------------------------ Kopf */}
      <header className="surface-night rounded-[12px] -mx-1 md:mx-0 p-6 md:p-10 lg:p-12 grid md:grid-cols-[auto_minmax(0,1fr)] gap-8 md:gap-12 items-end">
        <div className="flex-none">
          <div className="md:hidden"><Cover data={cover} width={150} large priority className="anim-cover" /></div>
          <div className="hidden md:block lg:hidden"><Cover data={cover} width={210} large priority className="anim-cover" /></div>
          <div className="hidden lg:block"><Cover data={cover} width={260} large priority className="anim-cover" /></div>
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-medium text-night-muted anim-rise">
            {[work.genre, work.editions > 1 ? `${work.editions} Ausgaben` : null].filter(Boolean).join(" · ") || "Titel"}
          </p>
          <h1 lang="de" className={cx("display mt-3 break-words hyphens-auto anim-rise", long ? "text-[30px] md:text-[38px]" : "text-[32px] md:text-[44px]")} style={{ animationDelay: "40ms" }}>
            {work.title}
          </h1>
          {work.subtitle && <p className="font-serif text-[21px] md:text-[26px] text-night-muted mt-3 leading-snug anim-rise" style={{ animationDelay: "60ms" }}>{work.subtitle}</p>}
          {work.authors.length > 0 && <p className="text-[17px] md:text-[19px] mt-4 font-medium anim-rise" style={{ animationDelay: "80ms" }}>{work.authors.join(", ")}</p>}

          <dl className="mt-8 grid grid-cols-3 max-w-md anim-rise" style={{ animationDelay: "120ms" }}>
            {[
              [String(others.length), others.length === 1 ? "Exemplar" : "Exemplare"],
              [String(freeCount), "jetzt frei"],
              [nearest != null ? fmtDistance(nearest) : "–", "am nächsten"],
            ].map(([n, l], i) => (
              <div key={l} className={cx("flex flex-col-reverse", i > 0 && "border-l border-night-line pl-4 md:pl-6")}>
                <dt className="text-[13px] text-night-muted mt-1.5">{l}</dt>
                <dd className="font-[520] tracking-[-0.035em] text-[26px] sm:text-[30px] md:text-[40px] leading-none tnum whitespace-nowrap">{n}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 pt-6 border-t border-night-line flex flex-wrap items-center gap-x-6 gap-y-3 anim-rise" style={{ animationDelay: "160ms" }}>
            <WishButton workId={work.id} loggedIn={!!viewer} onList={!!wish} alarm={wish?.alarm ?? false} next={nextPath} primary={!nextId} onNight />
            <p className="text-[14px] text-night-muted max-w-sm">
              {wish
                ? wish.alarm
                  ? `Wir melden uns, sobald ein Exemplar im Umkreis von ${wish.radius_km} km frei wird.`
                  : "Titelalarm aus. Du findest den Titel auf deiner Wunschliste."
                : "Mit dem Titelalarm melden wir uns, sobald ein Exemplar in deiner Nähe frei wird."}
            </p>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------- Exemplare */}
      <section aria-labelledby="exemplare">
        <SectionTitle aside={others.length > 0 && <span className="tnum hidden sm:inline">{freeCount === 1 ? "1 jetzt frei" : `${freeCount} jetzt frei`}</span>}>
          <span id="exemplare">{others.length === 1 ? "1 Exemplar" : `${others.length} Exemplare`}{place ? ` rund um ${place}` : " in der Nähe"}</span>
        </SectionTitle>

        {!viewer && !o && (
          <form method="get" className="panel-quiet rounded-[10px] p-5 md:p-6 mb-5 flex flex-wrap items-center justify-between gap-4">
            <label htmlFor="titel-plz" className="text-[15px] text-ink-2">Deine Postleitzahl, um Entfernungen zu sehen.</label>
            <div className="flex items-center gap-2">
              <input id="titel-plz" name="plz" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="8180"
                className="w-28 h-11 bg-paper border border-line-strong rounded-[6px] px-5 text-[16px] tnum tracking-[0.08em] placeholder:text-muted/70 focus:outline-none focus:border-ink focus:ring-[3px] focus:ring-ink/10" />
              <button type="submit" className="h-11 px-5 rounded-[6px] bg-accent-soft text-accent-hover font-semibold hover:bg-accent hover:text-accent-ink transition-colors">Zeigen</button>
            </div>
          </form>
        )}

        {others.length === 0 ? (
          <div className="panel-quiet rounded-[10px] p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6">
            <div aria-hidden className="flex items-end gap-[3px] flex-none">
              <Spine title={work.title} author={work.authors[0]} height={78} />
              <span className="h-[60px] w-[34px] rounded-[3px] border border-dashed border-line-strong" />
            </div>
            <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[16px] text-ink-2 max-w-lg">Im Moment steht kein Exemplar in deiner Nähe im Regal. Mit dem Titelalarm melden wir uns.</p>
              <LinkButton href="/suche" variant="ghost">Weiter suchen</LinkButton>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {others.map((c, i) => {
              const st = c.free_now ? { tone: "ok" as const, text: "Jetzt frei" } : shelfStatusText(c);
              const binding = c.binding === "hardcover" ? "Gebunden" : c.binding === "paperback" ? "Taschenbuch" : null;
              const edition = [c.year, c.publisher, binding, c.language ? languageLabel[c.language] ?? c.language : null].filter(Boolean).join(" · ");
              const dist = fmtDistance(c.dist);
              const next = c.id === nextId;
              const resp = responseHint(c.median_response_seconds);
              return (
                <li key={c.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <div className={cx(
                    "panel p-5 md:p-6 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto] gap-x-5 gap-y-5 items-center transition-colors duration-200 hover:border-ink",
                    next && "border-ink",
                  )}>
                    <div className="min-w-0 col-span-2 md:col-span-1">
                      {next && <p className="eyebrow !text-accent mb-2">Nächstes freies Exemplar</p>}
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <Link href={`/exemplar/${c.id}`} className="font-serif text-[28px] md:text-[32px] leading-none hover:underline underline-offset-4 decoration-1">{conditionLabel[c.condition]}</Link>
                        {dist && <span className="text-[15px] font-semibold tnum text-ink-2">{dist}</span>}
                      </div>
                      {edition && <p className="text-[14px] text-muted mt-1.5">{edition}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="chip"><span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", toneDot[st.tone])} />{st.text}</span>
                        <span className="text-[13px] text-muted">{c.offers.map((x) => offerLabel[x]).join(" · ")}</span>
                      </div>
                    </div>

                    <div className="min-w-0 flex items-center gap-3">
                      <Monogram name={c.owner_name} seed={c.owner_id} size={40} />
                      <div className="min-w-0 leading-tight">
                        <Link href={`/profil/${c.owner_id}`} className="font-semibold hover:underline underline-offset-4">{c.owner_name}</Link>
                        <span className="text-[13px] text-muted"> · {trustLabel[c.owner_trust] ?? "Neu"}</span>
                        {resp && <p className="text-[13px] text-muted mt-0.5 truncate">{resp}</p>}
                      </div>
                    </div>

                    <LinkButton href={`/exemplar/${c.id}`} variant={next ? "primary" : "ghost"} className="justify-self-end">
                      Anfragen
                    </LinkButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {own.length > 0 ? (
            <p className="text-sm text-muted">
              Du hast {own.length === 1 ? "selbst ein Exemplar" : `selbst ${own.length} Exemplare`} im Regal.{" "}
              <Link href={`/exemplar/${own[0].id}`} className="underline underline-offset-4 hover:text-ink">Ansehen</Link>
            </p>
          ) : <span />}
          <ShippingSignal />
        </div>
      </section>
    </article>
  );
}
