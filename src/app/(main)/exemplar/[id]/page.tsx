import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { copyDetail, relatedForCopy, type RelatedCopy } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { origin } from "@/lib/page";
import { publicProfile } from "@/lib/profile";
import { requestBlocker } from "@/lib/trust";
import { Cover, imageUrl } from "@/components/cover";
import { cx } from "@/components/ui";
import { shelfStatusText } from "@/components/status";
import { Monogram } from "@/components/person/monogram";
import { conditionHint, conditionLabel, languageLabel, offerLabel, trustLabel } from "@/lib/i18n/de-CH";
import { fmtDistance } from "@/lib/geo";
import { fmtMonthYear } from "@/lib/dates";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { CalendarView } from "@/components/calendar";
import { BookRow } from "@/components/regal/book-row";
import { RequestPanel } from "./request-panel";
import { CorrectionForm } from "./correction";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Buch" };
  const [c] = await sql<{ title: string }[]>`select w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id where c.id = ${id}`;
  return { title: c?.title ?? "Buch" };
}

const toneDot = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" } as const;

/**
 * Exemplar (PRD 8.4): links das Produktblatt (Cover, Angaben, wer verleiht),
 * rechts die Anfrage in nummerierten Schritten mit Verleihkalender.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const copy = await copyDetail(id, user?.id ?? null, origin(user));
  if (!copy) notFound();
  const own = user?.id === copy.owner_id;
  const [cal, blocker, myOffers, circles, owner, related] = await Promise.all([
    getCalendar(sql, id, user?.id ?? null),
    user ? requestBlocker(sql, user) : Promise.resolve(null),
    user && copy.offers.includes("swap")
      ? sql<{ id: string; title: string }[]>`
          select c.id, w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
           where c.owner_id = ${user.id} and c.removed_at is null and 'swap' = any(c.offers)
             and (c.transfer_locked_until is null or c.transfer_locked_until < now()) order by w.title`
      : Promise.resolve([]),
    user ? sql<{ loan_days: number; name: string }[]>`
      select ci.loan_days, ci.name from circles ci where ci.id = shared_circle_for_copy(${user.id}, ${id})` : Promise.resolve([]),
    publicProfile(copy.owner_id, user?.id ?? null),
    relatedForCopy(id, user?.id ?? null, origin(user)).catch(() => null),
  ]);
  const st = shelfStatusText(copy);
  const photo = copy.photos[0];
  const cover = { title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id };
  const dist = own ? null : fmtDistance(copy.dist);
  const loanDays = circles[0]?.loan_days ?? copy.loan_days;
  const extraPhotos = copy.cover_key ? copy.photos : copy.photos.slice(1);

  const facts: [string, React.ReactNode][] = [
    ["Zustand", conditionLabel[copy.condition]],
    ["Ausgabe", [copy.publisher, copy.year, copy.binding === "hardcover" ? "gebunden" : copy.binding === "paperback" ? "Taschenbuch" : null].filter(Boolean).join(", ") || "–"],
    ["Sprache", copy.language ? languageLabel[copy.language] ?? copy.language : "–"],
    ["Leihfrist", `${loanDays} Tage`],
    ...(copy.isbn13 ? [["ISBN", copy.isbn13] as [string, string]] : []),
  ];

  return (
    <div>
      <Link href={own ? "/regal" : "/suche"} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {own ? "Mein Regal" : "Suche"}
      </Link>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
        {/* ------------------------------------------------ Produktblatt */}
        <aside className="lg:sticky lg:top-8 space-y-5">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
              <span className="block lg:hidden"><Cover priority data={cover} width={104} height={156} uniform /></span>
              <span className="hidden lg:block"><Cover priority large data={cover} width={220} height={330} uniform /></span>
            </div>
            <div className="anim-rise min-w-0">
              <h1 lang="de" className="font-serif text-[24px] md:text-[32px] leading-[1.1] hyphens-auto break-words">{copy.title}</h1>
              <p className="text-[14.5px] md:text-[15px] text-ink-2 mt-1.5">{copy.authors.join(", ")}</p>
            </div>
          </div>

          {extraPhotos.length > 0 && (
            <ul className="grid grid-cols-4 gap-2" aria-label="Fotos des Exemplars">
              {extraPhotos.slice(0, 4).map((p) => (
                <li key={p.id} className="aspect-[3/4]">
                  <a href={imageUrl(p.key, false)} target="_blank" className="block h-full rounded-[8px] overflow-hidden border border-line hover:border-ink-2 transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-full w-full object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-[10px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[14px] font-medium"><span aria-hidden className={cx("h-2 w-2 rounded-full", toneDot[st.tone])} />{st.text}</span>
              {dist && <span className="text-[13px] text-muted tnum">{dist}</span>}
            </div>
            <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {facts.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
              ))}
            </dl>
            {(copy.condition_note || copy.condition) && (
              <p className="px-4 py-3 text-[13.5px] text-muted leading-snug">
                {conditionHint[copy.condition]}.{copy.condition_note && <> Notiz: <span className="text-ink">«{copy.condition_note}»</span></>}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {own && (
              <Link href={`/regal/${copy.id}`} className="h-11 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
                Bearbeiten <IconArrowRight width={16} height={16} />
              </Link>
            )}
            <Link href={`/titel/${copy.work_id}`} className="h-11 rounded-[6px] border border-line-strong font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:border-ink-2 transition-colors">
              Weitere Exemplare dieses Titels
            </Link>
          </div>
          <CorrectionForm editionId={copy.edition_id} loggedIn={Boolean(user)} />
        </aside>

        {/* ------------------------------------------------ Anfrage */}
        <div className="min-w-0">
          <header className="anim-rise">
            <p className="eyebrow">{copy.offers.map((o) => offerLabel[o]).join(" · ") || "Nicht angeboten"}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">
              {own ? <>Dein Exemplar. <em>So sehen es andere.</em></>
                : copy.offers.includes("lend") ? <>Leih dir <em>dieses Buch.</em></>
                : copy.offers.includes("swap") ? <>Tausch <em>dieses Buch.</em></>
                : <>Ein Geschenk <em>für dich.</em></>}
            </h2>
          </header>

          {/* Wer verleiht – vor der Anfrage sichtbar (PRD 6.1) */}
          <section aria-labelledby="verleiher" className="mt-10 rounded-[10px] border border-line p-5 md:p-6 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center anim-rise" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-4 min-w-0">
              <Monogram name={copy.owner_name} seed={copy.owner_id} size={56} photo={copy.owner_avatar} />
              <div className="min-w-0">
                <p className="text-[13px] text-muted">{own ? "Dein Exemplar" : "Verleiht"}</p>
                <Link id="verleiher" href={`/profil/${copy.owner_id}`} className="text-[22px] font-[560] tracking-[-0.03em] leading-tight hover:underline underline-offset-4 decoration-1">{copy.owner_name}</Link>
                <p className="text-[13.5px] text-muted mt-0.5">
                  {trustLabel[copy.owner_trust] ?? "Neu"}{copy.owner_municipality && ` · ${copy.owner_municipality}`} · seit {fmtMonthYear(copy.owner_since)}
                </p>
              </div>
            </div>
            {owner && (
              <dl className="grid grid-cols-3 gap-2">
                {[[String(owner.lent), "verliehen"], [String(owner.borrowed), "geliehen"], [owner.punctual_pct == null ? "–" : `${owner.punctual_pct}%`, "pünktlich"]].map(([n, l]) => (
                  <div key={l} className="rounded-[8px] bg-paper-2 px-4 py-3 min-w-[84px] flex flex-col-reverse">
                    <dt className="text-[12px] text-muted mt-1">{l}</dt>
                    <dd className="text-[24px] font-[560] tracking-[-0.04em] leading-none tnum">{n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {!own && cal && (
            <RequestPanel
              copyId={copy.id}
              offers={copy.offers}
              calendar={cal}
              loggedIn={Boolean(user)}
              blocker={blocker}
              paused={copy.owner_paused}
              myOffers={myOffers}
              loanDays={loanDays}
              title={copy.title}
            />
          )}
          {own && cal && (
            <section className="mt-12 pt-12 border-t border-line" aria-labelledby="kalender">
              <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-7">
                <span className="text-[13px] tnum text-muted pt-1.5">01</span>
                <div>
                  <h2 id="kalender" className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em]">Verleihkalender</h2>
                  <p className="text-[15px] text-muted mt-1.5">Du siehst Namen, andere nur frei und belegt.</p>
                </div>
              </div>
              <div className="md:pl-[72px]"><div className="rounded-[10px] border border-line p-5 md:p-6"><CalendarView cal={cal} /></div></div>
            </section>
          )}
        </div>
      </div>

      {related && <MoreBooks related={related} ownerName={copy.owner_name} ownerId={copy.owner_id} workId={copy.work_id} title={copy.title} hasOrigin={Boolean(origin(user))} />}
    </div>
  );
}

/** Weiterstöbern: mehrere Bretter mit weiteren Büchern rund um dieses Exemplar */
function MoreBooks({ related, ownerName, ownerId, workId, title, hasOrigin }: {
  related: NonNullable<Awaited<ReturnType<typeof relatedForCopy>>>; ownerName: string; ownerId: string; workId: string; title: string; hasOrigin: boolean;
}) {
  const where = hasOrigin ? "in deiner Nähe" : "in der Nähe";
  const note = (c: RelatedCopy) => {
    const free = c.status === "available";
    const d = c.dist != null ? fmtDistance(c.dist) : null;
    return { tone: free ? ("ok" as const) : ("lent" as const), text: [free ? "frei" : "belegt", c.owner_name, d].filter(Boolean).join(" · ") };
  };
  const shelves: { id: string; title: string; desc: string; items: RelatedCopy[]; link?: { href: string; label: string }; withNote: boolean }[] = [
    { id: "regal", title: `Mehr aus dem Regal von ${ownerName}`, desc: "Was sonst noch bei dieser Person steht. Eine Übergabe, mehrere Bücher.", items: related.owner, link: { href: `/profil/${ownerId}`, label: "Ganzes Regal" }, withNote: false },
    { id: "titel", title: `Weitere Exemplare von «${title}»`, desc: "Dasselbe Buch bei anderen Mitgliedern, das nächste zuerst.", items: related.sameWork, link: { href: `/titel/${workId}`, label: "Alle vergleichen" }, withNote: true },
    { id: "autor", title: `Mehr von ${related.authorName}`, desc: `Andere Titel ${where}, im Umkreis von 25 km.`, items: related.author, link: related.authorName ? { href: `/suche?q=${encodeURIComponent(related.authorName)}`, label: "Alle suchen" } : undefined, withNote: true },
    { id: "genre", title: `Ebenfalls ${related.genreName}`, desc: `Aus demselben Genre, ${where}.`, items: related.genre, link: related.genreName ? { href: `/suche?genre=${encodeURIComponent(related.genreName)}`, label: "Ganzes Genre" } : undefined, withNote: true },
    { id: "neu", title: `Neu ${where}`, desc: "Zuletzt eingestellt, im Umkreis von 25 km.", items: related.nearby, link: { href: "/suche", label: "Alle durchsuchen" }, withNote: true },
  ].filter((s) => s.items.length > 0);
  if (!shelves.length) return null;
  const total = shelves.reduce((n, s) => n + s.items.length, 0);

  return (
    <section aria-labelledby="weiter" className="mt-16 md:mt-24 pt-10 md:pt-12 border-t border-line">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="eyebrow">Weiterstöbern</p>
          <h2 id="weiter" className="display text-[28px] md:text-[38px] mt-2">Noch mehr Bücher, <em>{where}.</em></h2>
        </div>
        <p className="text-[14px] text-muted tnum pb-1">{total} Bücher auf {shelves.length} {shelves.length === 1 ? "Brett" : "Brettern"}</p>
      </header>

      <nav aria-label="Bretter" className="mt-6 flex flex-wrap gap-2">
        {shelves.map((s) => (
          <a key={s.id} href={`#mehr-${s.id}`} className="h-9 pl-3.5 pr-1.5 rounded-[8px] border border-line inline-flex items-center gap-2.5 text-[13.5px] font-medium hover:border-accent hover:text-accent-hover transition-colors">
            <span className="max-w-[28ch] truncate">{s.title}</span>
            <span className="h-6 min-w-6 px-1.5 rounded-[5px] bg-paper-2 text-ink-2 text-[12px] grid place-items-center tnum">{s.items.length}</span>
          </a>
        ))}
      </nav>

      {/* Kleine Bretter (bis 3 Bücher) stehen auf grossen Bildschirmen paarweise nebeneinander */}
      <div className="mt-10 grid lg:grid-cols-2 gap-x-8 gap-y-12 md:gap-y-14 [grid-auto-flow:dense]">
        {shelves.map((s) => (
          <div key={s.id} id={`mehr-${s.id}`} className={cx("scroll-mt-28 min-w-0 flex flex-col", s.items.length > 3 && "lg:col-span-2")}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-4">
              <div className="min-w-0">
                <h3 className="text-[20px] md:text-[24px] font-[560] tracking-[-0.03em] leading-tight">{s.title}</h3>
                <p className="text-[14.5px] text-muted mt-1">{s.desc}</p>
              </div>
              {s.link && (
                <Link href={s.link.href} className="inline-flex items-center gap-1 text-[13.5px] font-medium text-accent-hover hover:underline underline-offset-4 pb-1">
                  {s.link.label} <IconArrowRight width={14} height={14} />
                </Link>
              )}
            </div>
            <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0 flex-1">
              <BookRow label={s.title} height={165} hrefBase="/exemplar/"
                items={s.withNote ? s.items.map((c) => ({ ...c, note: note(c) })) : s.items} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
