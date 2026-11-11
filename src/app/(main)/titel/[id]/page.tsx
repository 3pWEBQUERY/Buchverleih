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
import { shelfStatusText } from "@/components/status";
import { Monogram } from "@/components/person/monogram";
import { LinkButton, cx } from "@/components/ui";
import { StatTile, StepSection } from "@/components/step-section";
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
  const facts: [string, string][] = [
    ...(work.genre ? [["Genre", work.genre] as [string, string]] : []),
    ["Ausgaben", String(work.editions)],
    ...(work.original_language ? [["Originalsprache", languageLabel[work.original_language] ?? work.original_language] as [string, string]] : []),
    ["In der Nähe", others.length === 1 ? "1 Exemplar" : `${others.length} Exemplare`],
  ];

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
      {/* ------------------------------------------------ Produktblatt */}
      <aside className="lg:sticky lg:top-8 space-y-5 min-w-0">
        <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
          <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
            <span className="block lg:hidden"><Cover priority data={cover} width={104} height={156} uniform /></span>
            <span className="hidden lg:block"><Cover priority large data={cover} width={220} height={330} uniform /></span>
          </div>
          <div className="anim-rise min-w-0">
            <h1 lang="de" className="font-serif text-[24px] md:text-[32px] leading-[1.1] hyphens-auto break-words">{work.title}</h1>
            {work.subtitle && <p className="font-serif text-[16px] md:text-[18px] text-muted mt-1.5 leading-snug">{work.subtitle}</p>}
            {work.authors.length > 0 && <p className="text-[14.5px] md:text-[15px] text-ink-2 mt-1.5">{work.authors.join(", ")}</p>}
          </div>
        </div>

        <div className="rounded-[10px] border border-line divide-y divide-line">
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[14px] font-medium">
              <span aria-hidden className={cx("h-2 w-2 rounded-full", freeCount ? "bg-ok" : others.length ? "bg-lent" : "bg-done")} />
              {freeCount ? (freeCount === 1 ? "1 Exemplar jetzt frei" : `${freeCount} Exemplare jetzt frei`) : others.length ? "Alle gerade vergeben" : "Noch kein Exemplar in der Nähe"}
            </span>
            {nearest != null && <span className="text-[13px] text-muted tnum">{fmtDistance(nearest)}</span>}
          </div>
          <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {facts.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
            ))}
          </dl>
        </div>

        <div className="rounded-[10px] border border-line p-4">
          <p className="font-medium text-[15px]">Titelalarm</p>
          <p className="text-[13px] text-muted mt-0.5 mb-3 leading-snug">
            {wish
              ? wish.alarm
                ? `Wir melden uns, sobald ein Exemplar im Umkreis von ${wish.radius_km} km frei wird.`
                : "Titelalarm aus. Du findest den Titel auf deiner Wunschliste."
              : "Setz den Titel auf die Wunschliste. Wir melden uns, sobald ein Exemplar in deiner Nähe frei wird."}
          </p>
          <WishButton workId={work.id} loggedIn={!!viewer} onList={!!wish} alarm={wish?.alarm ?? false} next={nextPath} primary={!nextId} className="w-full" />
        </div>
      </aside>

      {/* ------------------------------------------------ Exemplare */}
      <div className="min-w-0">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 anim-rise">
          <div className="min-w-0">
            <p className="eyebrow">{place ? `Rund um ${place}` : "In der Nähe"}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">
              {freeCount ? <>Leih dir <em>dieses Buch.</em></> : others.length ? <>Gerade vergeben. <em>Vormerken geht.</em></> : <>Noch nicht <em>in der Nähe.</em></>}
            </h2>
          </div>
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <StatTile n={others.length} label={others.length === 1 ? "Exemplar" : "Exemplare"} />
            <StatTile n={freeCount} label="jetzt frei" live={freeCount > 0} />
            <StatTile n={nearest != null ? (fmtDistance(nearest) ?? "–").replace(/^ca\. /, "") : "–"} label="am nächsten" />
          </dl>
        </header>

        <StepSection id="exemplare" n={1} title={others.length === 1 ? "1 Exemplar" : `${others.length} Exemplare`} className="mt-10 md:mt-12"
          desc="Sortiert nach Entfernung. Zustand, Ausgabe und wer verleiht – ein Tippen öffnet Kalender und Anfrage."
          aside={others.length > 0 ? (freeCount === 1 ? "1 jetzt frei" : `${freeCount} jetzt frei`) : undefined}>
          {!viewer && !o && (
            <form method="get" className="rounded-[10px] border border-line p-5 mb-4 flex flex-wrap items-center justify-between gap-4">
              <label htmlFor="titel-plz" className="text-[14.5px] text-ink-2">Deine Postleitzahl, um Entfernungen zu sehen.</label>
              <div className="flex items-center gap-2">
                <input id="titel-plz" name="plz" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="8180"
                  className="w-28 h-11 bg-paper border border-line-strong rounded-[6px] px-5 text-[16px] tnum tracking-[0.08em] placeholder:text-muted/70 focus:outline-none focus:border-accent" />
                <button type="submit" className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium hover:bg-accent-hover transition-colors">Zeigen</button>
              </div>
            </form>
          )}

          {others.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-line-strong p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[15px] text-ink-2 max-w-lg">Im Moment steht kein Exemplar in deiner Nähe im Regal. Mit dem Titelalarm melden wir uns.</p>
              <LinkButton href="/suche" variant="secondary">Weiter suchen</LinkButton>
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
                      "rounded-[10px] border p-4 md:p-5 grid grid-cols-[minmax(0,1fr)_auto] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] gap-x-5 gap-y-4 items-center transition-colors duration-150",
                      next ? "border-accent bg-accent-soft/20" : "border-line hover:border-ink-2",
                    )}>
                      <div className="min-w-0 col-span-2 2xl:col-span-1">
                        {next && <p className="text-[12.5px] font-medium text-accent-hover mb-1.5">Nächstes freies Exemplar</p>}
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <Link href={`/exemplar/${c.id}`} className="text-[20px] md:text-[22px] font-[560] tracking-[-0.025em] leading-tight hover:underline underline-offset-4 decoration-1">{conditionLabel[c.condition]}</Link>
                          {dist && <span className="text-[14px] font-medium tnum text-ink-2">{dist}</span>}
                        </div>
                        {edition && <p className="text-[13.5px] text-muted mt-1">{edition}</p>}
                        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                          <span className={cx("inline-flex items-center gap-1.5 font-medium", st.tone === "ok" ? "text-ok" : "text-ink-2")}>
                            <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", toneDot[st.tone])} />{st.text}
                          </span>
                          <span className="text-muted">{c.offers.map((x) => offerLabel[x]).join(" · ")}</span>
                        </p>
                      </div>

                      <div className="min-w-0 flex items-center gap-3">
                        <Monogram name={c.owner_name} seed={c.owner_id} size={38} />
                        <div className="min-w-0 leading-tight">
                          <Link href={`/profil/${c.owner_id}`} className="font-medium hover:underline underline-offset-4">{c.owner_name}</Link>
                          <span className="text-[13px] text-muted"> · {trustLabel[c.owner_trust] ?? "Neu"}</span>
                          {resp && <p className="text-[12.5px] text-muted mt-0.5 truncate">{resp}</p>}
                        </div>
                      </div>

                      <LinkButton href={`/exemplar/${c.id}`} variant={next ? "primary" : "secondary"} className="justify-self-end">
                        Anfragen
                      </LinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            {own.length > 0 ? (
              <p className="text-sm text-muted">
                Du hast {own.length === 1 ? "selbst ein Exemplar" : `selbst ${own.length} Exemplare`} im Regal.{" "}
                <Link href={`/exemplar/${own[0].id}`} className="font-medium text-accent-hover hover:underline underline-offset-4">Ansehen</Link>
              </p>
            ) : <span />}
            <ShippingSignal />
          </div>
        </StepSection>
      </div>
    </div>
  );
}
