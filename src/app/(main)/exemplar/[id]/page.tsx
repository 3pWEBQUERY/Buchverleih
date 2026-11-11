import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { copyDetail } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { origin } from "@/lib/page";
import { publicProfile } from "@/lib/profile";
import { requestBlocker } from "@/lib/trust";
import { Cover, imageUrl } from "@/components/cover";
import { LinkButton, cx } from "@/components/ui";
import { shelfStatusText } from "@/components/status";
import { Monogram } from "@/components/person/monogram";
import { conditionHint, conditionLabel, languageLabel, offerLabel, trustLabel } from "@/lib/i18n/de-CH";
import { fmtDistance } from "@/lib/geo";
import { RequestPanel } from "./request-panel";
import { CorrectionForm } from "./correction";
import { CalendarView } from "@/components/calendar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c] = await sql<{ title: string }[]>`select e.title from copies c join editions e on e.id = c.edition_id where c.id = ${id}`;
  return { title: c?.title ?? "Buch" };
}

const toneDot = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" } as const;

/** Exemplar (PRD 8.4): Cover, Angaben, wer verleiht – und die Anfrage mit Verleihkalender. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const copy = await copyDetail(id, user?.id ?? null, origin(user));
  if (!copy) notFound();
  const own = user?.id === copy.owner_id;
  const [cal, blocker, myOffers, circles, owner] = await Promise.all([
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
  ]);
  const st = shelfStatusText(copy);
  const photo = copy.photos[0];
  const cover = { title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id };
  const dist = own ? null : fmtDistance(copy.dist);
  const long = copy.title.length > 22;

  const facts: [string, React.ReactNode][] = [
    ["Zustand", <>{conditionLabel[copy.condition]} <span className="text-muted">· {conditionHint[copy.condition]}</span></>],
    ...(copy.condition_note ? [["Notiz", copy.condition_note] as [string, string]] : []),
    ["Ausgabe", [copy.publisher, copy.year, copy.binding === "hardcover" ? "gebunden" : copy.binding === "paperback" ? "Taschenbuch" : null].filter(Boolean).join(", ") || "–"],
    ["Sprache", copy.language ? languageLabel[copy.language] ?? copy.language : "–"],
    ["Leihfrist", `${circles[0]?.loan_days ?? copy.loan_days} Tage${circles[0] ? ` (Kreis ${circles[0].name})` : ""}`],
  ];

  const numbers: [string, string][] = owner
    ? [
        [String(owner.lent), "verliehen"],
        [String(owner.borrowed), "geliehen"],
        [owner.punctual_pct == null ? "–" : `${owner.punctual_pct} %`, "pünktlich"],
      ]
    : [];

  return (
    <div className="grid md:grid-cols-12 gap-x-10 lg:gap-x-14 gap-y-8">
      {/* -------------------------------------------------- Cover, links fix */}
      <aside className="md:col-span-5" aria-label="Cover und Fotos">
        <div className="md:sticky md:top-10">
          <div className="panel-quiet rounded-[22px] px-6 py-8 md:px-8 md:py-12 grid place-items-center">
            <div className="md:hidden"><Cover large priority width={170} data={cover} className="anim-cover" /></div>
            <div className="hidden md:block lg:hidden"><Cover large priority width={220} data={cover} className="anim-cover" /></div>
            <div className="hidden lg:block"><Cover large priority width={280} data={cover} className="anim-cover" /></div>
          </div>
          {copy.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto [scrollbar-width:none]">
              {copy.photos.slice(1).map((p) => (
                <a key={p.id} href={imageUrl(p.key, false)} target="_blank" className="flex-none rounded-[8px] overflow-hidden border border-line hover:border-ink transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-20 w-auto block" />
                </a>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------- Angaben, Anfrage */}
      <div className="md:col-span-7 min-w-0 space-y-10">
        <header>
          <p className="eyebrow anim-rise">{copy.offers.map((o) => offerLabel[o]).join(" · ") || "Nicht angeboten"}</p>
          <h1 lang="de" className={cx("display mt-3 break-words hyphens-auto anim-rise", long ? "text-[44px] md:text-[56px] lg:text-[68px]" : "text-[52px] md:text-[68px] lg:text-[84px]")} style={{ animationDelay: "40ms" }}>
            {copy.title}
          </h1>
          <p className="text-[17px] md:text-[19px] font-medium mt-4 anim-rise" style={{ animationDelay: "60ms" }}>{copy.authors.join(", ")}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 anim-rise" style={{ animationDelay: "80ms" }}>
            <span className="chip"><span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", toneDot[st.tone])} />{st.text}</span>
            <span className="chip">{conditionLabel[copy.condition]}</span>
            {dist && <span className="chip tnum">{dist}</span>}
            <Link href={`/titel/${copy.work_id}`} className="ml-1 text-[14px] font-medium text-muted hover:text-ink link-grow">Weitere Exemplare dieses Titels</Link>
          </div>
        </header>

        <dl className="panel divide-y divide-line anim-rise" style={{ animationDelay: "100ms" }}>
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)] gap-4 px-5 py-3.5 text-[15px]">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        {/* Wer verleiht */}
        <section aria-labelledby="verleiher" className="panel p-5 md:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-4">
            <Monogram name={copy.owner_name} seed={copy.owner_id} size={56} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{own ? "Dein Exemplar" : "Verleiht"}</p>
              <Link id="verleiher" href={`/profil/${copy.owner_id}`} className="font-serif text-[28px] leading-none mt-1 inline-block hover:underline underline-offset-4 decoration-1">{copy.owner_name}</Link>
            </div>
            {own && <LinkButton href={`/regal/${copy.id}`} variant="secondary">Bearbeiten</LinkButton>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="chip"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />{trustLabel[copy.owner_trust] ?? "Neu"}</span>
            {copy.owner_municipality && <span className="text-[14px] text-muted">{copy.owner_municipality}{dist && ` · ${dist}`}</span>}
          </div>
          {numbers.length > 0 && (
            <dl className="mt-5 pt-5 border-t border-line grid grid-cols-3">
              {numbers.map(([n, l], i) => (
                <div key={l} className={cx("flex flex-col-reverse", i > 0 && "border-l border-line pl-4 md:pl-6")}>
                  <dt className="text-[13px] text-muted mt-1">{l}</dt>
                  <dd className="font-serif text-[32px] md:text-[40px] leading-none tnum">{n}</dd>
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
            loanDays={circles[0]?.loan_days ?? copy.loan_days}
          />
        )}
        {own && cal && (
          <section className="panel rounded-[18px] p-5 md:p-8" aria-labelledby="kalender">
            <p className="eyebrow">Nur für dich mit Namen</p>
            <h2 id="kalender" className="font-serif text-[34px] md:text-[44px] leading-none mt-2">Verleihkalender</h2>
            <p className="text-[14px] text-muted mt-3 mb-6">Andere sehen hier nur frei und belegt, ohne Namen.</p>
            <OwnCalendar cal={cal} />
          </section>
        )}
        <CorrectionForm editionId={copy.edition_id} loggedIn={Boolean(user)} />
      </div>
    </div>
  );
}

function OwnCalendar({ cal }: { cal: NonNullable<Awaited<ReturnType<typeof getCalendar>>> }) {
  return <CalendarView cal={cal} />;
}
