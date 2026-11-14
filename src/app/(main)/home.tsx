import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { nearestFreeCopy, newNearby } from "@/lib/copies";
import { topGenres, wishlistMatches } from "@/lib/home-data";
import { pulse } from "@/lib/pulse";
import { PulseList } from "@/components/pulse";
import { COMMUNITY } from "@/lib/i18n/messages/community";
import { ExampleBook } from "@/components/example-book";
import { myLoans } from "@/lib/loans/queries";
import { requirePhone } from "@/lib/trust";
import { LinkButton, Notice, cx } from "@/components/ui";
import { BookRow } from "@/components/regal/book-row";
import { StatTile, StepSection } from "@/components/step-section";
import { Monogram } from "@/components/person/monogram";
import { LoanRow } from "@/components/loan/loan-row";
import { fmtDistance } from "@/lib/geo";
import { IconArrowRight, IconBookmark, IconCheck, IconScan, IconSearch } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import { htmlLang } from "@/lib/i18n/locale";
import { labels } from "@/lib/i18n/labels";
import { HOME } from "@/lib/i18n/messages/home";

/** Start angemeldet (PRD 8.4): Handlungsbedarf zuoberst, darunter zwei Regalreihen. */
export async function Home({ user }: { user: SessionUser }) {
  const origin = { lat: user.home_lat!, lng: user.home_lng! };
  const l = await getLocale();
  const t = HOME[l];
  const [loans, nearby, circleCopies, [counts], genres, matches, week] = await Promise.all([
    myLoans(user.id, l),
    newNearby(user.id, origin, 10, 24),
    sql<{ id: string; work_id: string; title: string; authors: string[]; photo_key: string | null; photo_w: number | null; photo_h: number | null; photo_color: string | null; cover_key: string | null; cover_color: string | null; owner_name: string; circle: string }[]>`
      select distinct on (c.id) c.id, e.work_id, w.title, w.authors, e.cover_key, o.first_name as owner_name, ci.name as circle,
             ph.key as photo_key, ph.width as photo_w, ph.height as photo_h, ph.color as photo_color, e.cover_color, c.created_at
        from circle_members m
        join circles ci on ci.id = m.circle_id
        join circle_copies cc on cc.circle_id = m.circle_id
        join copies c on c.id = cc.copy_id and c.removed_at is null and c.owner_id <> ${user.id} and cardinality(c.offers) > 0
        join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
        left join lateral (select key, width, height, color from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
       where m.user_id = ${user.id} and m.status = 'active'
       order by c.id, c.created_at desc limit 18`,
    sql<{ shelf: number; lent: number; borrowed: number }[]>`
      select (select count(*)::int from copies where owner_id = ${user.id} and removed_at is null) as shelf,
             (select count(*)::int from loans where owner_id = ${user.id} and status in ('active', 'return_reported', 'disputed')) as lent,
             (select count(*)::int from loans where borrower_id = ${user.id} and status in ('active', 'return_reported', 'disputed')) as borrowed`,
    topGenres(user.id),
    wishlistMatches(user.id, 8),
    pulse(user.id),
  ]);
  // Leerer Zustand mit echtem Beispiel: nur abfragen, wenn wirklich nichts läuft
  const example = loans.length === 0 ? await nearestFreeCopy(user.id) : null;
  const mine = loans.filter((x) => x.turn === "me" && x.step);
  const running = loans.filter((x) => !mine.includes(x) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(x.status));
  const hour = Number(new Intl.DateTimeFormat("de-CH", { hour: "numeric", hour12: false, timeZone: "Europe/Zurich" }).format(new Date()));
  const greet = t.greet(hour);
  const today = new Intl.DateTimeFormat(htmlLang[l], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Zurich" }).format(new Date());
  const summary = [
    t.waiting(mine.length),
    counts.lent ? t.lent(counts.lent) : null,
    nearby.length ? t.nearby(nearby.length) : null,
  ].filter(Boolean).join(" ");
  let n = 0;

  const quick: [string, string, string, React.ReactNode][] = [
    ["/regal/neu", t.quick[0][0], t.quick[0][1], <IconScan key="s" width={20} height={20} />],
    ["/suche", t.quick[1][0], t.quick[1][1], <IconSearch key="q" width={20} height={20} />],
    ["/wunschliste", t.quick[2][0], t.quick[2][1], <IconBookmark key="b" width={20} height={20} />],
  ];

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex items-center gap-4 md:gap-5 anim-rise">
          <Link href="/einstellungen#profilbild" className="flex-none hidden sm:block" aria-label={t.changePhoto}>
            <Monogram name={user.first_name || "?"} seed={user.id} size={64} photo={user.avatar_key} />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">{today} · {user.municipality}</p>
            <h1 className="display text-display mt-1.5">{greet}, <em>{user.first_name}.</em></h1>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise">
          <StatTile n={counts.borrowed} label={t.stats.borrowed} href="/vorgaenge?seite=leihe" />
          <StatTile n={counts.lent} label={t.stats.lent} href="/vorgaenge?seite=verleihe" />
          <StatTile n={counts.shelf} label={t.stats.shelf} href="/regal" />
        </dl>
      </header>
      <p className="text-body-lg text-ink-2 mt-4 max-w-2xl leading-relaxed anim-rise">{summary}</p>

      {requirePhone() && !user.phone_verified_at && (
        <Notice tone="accent" className="mt-6">
          {t.phone[0]}<Link href="/einstellungen#mobilnummer" className="underline underline-offset-4 font-medium">{t.phone[1]}</Link>
        </Notice>
      )}

      {/* Schnellzugriff */}
      <ul className="mt-8 grid sm:grid-cols-3 gap-2 anim-rise">
        {quick.map(([href, title, text, icon], i) => (
          <li key={href}>
            <Link href={href} className={cx("press-card group h-full rounded-md border p-4 flex items-center gap-3.5",
              i === 0 && counts.shelf === 0 ? "border-accent bg-accent-soft/30 hover:bg-accent-soft/50" : "border-line hover:border-accent")}>
              <span className="h-10 w-10 rounded-md bg-accent-soft text-accent-hover grid place-items-center flex-none transition-colors group-hover:bg-accent group-hover:text-accent-ink">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-body">{title}</span>
                <span className="block text-meta text-muted truncate">{text}</span>
              </span>
              <IconArrowRight width={16} height={16} className="flex-none text-accent-hover opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform]" />
            </Link>
          </li>
        ))}
      </ul>

      <StepSection id="wartet" n={++n} title={t.waitingTitle} className="mt-12 md:mt-14"
        aside={loans.length > 0 && <Link href="/vorgaenge" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">{t.allLoans} <IconArrowRight width={14} height={14} /></Link>}
        desc={mine.length ? t.yourTurn : undefined}>
        {mine.length === 0 ? (
          <>
          <div className="rounded-md bg-paper-2 px-5 py-5 flex items-center gap-4">
            <span className="h-10 w-10 rounded-full bg-accent-soft text-accent-hover grid place-items-center flex-none"><IconCheck width={18} height={18} /></span>
            <div>
              <p className="font-medium">{t.allDone}</p>
              <p className="text-ink-2 text-body-sm">{running.length > 0 ? t.othersTurn(running.length) : t.nothingOpen}</p>
            </div>
          </div>
          {example && <div className="mt-3 rounded-md border border-line px-5 py-4"><ExampleBook copy={example} l={l} /></div>}
          </>
        ) : (
          <ul className="grid xl:grid-cols-2 gap-3">
            {mine.slice(0, 4).map((x, i) => <LoanRow key={x.id} loan={x} variant="action" i={i} l={l} />)}
          </ul>
        )}
        {mine.length > 4 && (
          <p className="text-body-sm text-muted mt-4"><Link href="/vorgaenge" className="font-medium text-accent-hover hover:underline underline-offset-4">{t.moreWaiting(mine.length - 4)}</Link></p>
        )}

        {running.length > 0 && (
          <div className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 mb-4">
              <div>
                <h3 className="text-title-sm font-title tracking-title">{t.running}</h3>
                <p className="text-body-sm text-muted mt-0.5">{t.runningText}</p>
              </div>
              {running.length > 4 && <Link href="/vorgaenge" className="text-body-sm font-medium text-accent-hover hover:underline underline-offset-4 pb-0.5">{t.seeAll(running.length)}</Link>}
            </div>
            <ul className="grid xl:grid-cols-2 gap-3">
              {running.slice(0, 4).map((x, i) => <LoanRow key={x.id} loan={x} variant="running" i={i} l={l} />)}
            </ul>
          </div>
        )}
      </StepSection>

      {matches.length > 0 && (
        <StepSection id="wunsch" n={++n} title={t.matchTitle} desc={t.matchDesc}
          aside={<Link href="/wunschliste" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">{t.quick[2][0]} <IconArrowRight width={14} height={14} /></Link>}>
          <div className="surface-night rounded-lg px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0">
            <BookRow l={l} label={t.matchTitle} height={150}
              items={matches.map((c) => ({ ...c, note: { tone: c.reason === "swap" ? "accent" as const : "ok" as const, text: [c.reason === "swap" ? t.matchSwap : t.matchWish, c.distance_km != null ? fmtDistance(c.distance_km * 1000, l) : null].filter(Boolean).join(" · ") } }))} />
          </div>
        </StepSection>
      )}

      <StepSection id="naehe" n={++n} title={t.nearTitle} desc={t.nearDesc}
        aside={<Link href="/suche" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">{t.searchAll} <IconArrowRight width={14} height={14} /></Link>}>
        {nearby.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-ink-2 text-body">{t.nearEmpty}</p>
            <LinkButton href="/suche" variant="secondary">{t.searchOn}</LinkButton>
          </div>
        ) : (
          <div className="surface-night rounded-lg px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0">
            <BookRow l={l} morph="copy" label={t.nearTitle} height={165} hrefBase="/exemplar/"
              items={nearby.map((c) => ({ ...c, note: { tone: c.status === "available" ? "ok" as const : "lent" as const, text: `${c.status === "available" ? t.free : t.taken} · ${fmtDistance(c.dist, l)}` } }))} />
          </div>
        )}
      </StepSection>

      {/* Puls: nur Aggregiertes oder selbst Veröffentlichtes – nie «X hat Y von Z geliehen» */}
      {week.length > 0 && (
        <StepSection id="puls" n={++n} title={COMMUNITY[l].pulseHome.title} desc={COMMUNITY[l].pulseHome.desc}
          aside={<Link href="/kreise" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">{t.circles} <IconArrowRight width={14} height={14} /></Link>}>
          <PulseList items={week} l={l} showCircle />
        </StepSection>
      )}

      {circleCopies.length > 0 && (
        <StepSection id="kreise" n={++n} title={t.circlesTitle} desc={t.circlesDesc}
          aside={<Link href="/kreise" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">{t.circles} <IconArrowRight width={14} height={14} /></Link>}>
          <div className="surface-night rounded-lg px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0">
            <BookRow l={l} label={t.circlesTitle} height={150} hrefBase="/exemplar/"
              items={circleCopies.map((c) => ({ ...c, note: { tone: "ok" as const, text: `${c.owner_name} · ${c.circle}` } }))} />
          </div>
        </StepSection>
      )}

      {genres.length > 0 && (
        <StepSection id="stoebern" n={++n} title={t.browse} desc={t.browseDesc}>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Link key={g.genre} href={`/suche?genre=${encodeURIComponent(g.genre)}`}
                className="h-11 pl-4 pr-1.5 rounded-md border border-line inline-flex items-center gap-3 text-body-sm font-medium hover:border-accent hover:text-accent-hover transition-colors">
                {labels(l).genreLabel[g.genre] ?? g.genre} <span className="h-8 min-w-8 px-2 rounded-sm bg-paper-2 text-ink-2 text-meta grid place-items-center tnum">{g.n}</span>
              </Link>
            ))}
          </div>
        </StepSection>
      )}

      {counts.shelf === 0 && (
        <section className="mt-12 rounded-lg border border-accent/40 bg-accent-soft/25 p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <p className="eyebrow">{t.emptyEyebrow}</p>
            <h2 className="text-title font-title tracking-title mt-2 max-w-[22ch]">{t.emptyTitle}</h2>
          </div>
          <LinkButton href="/regal/neu" variant="primary" size="lg"><IconScan width={18} height={18} /> {t.firstBook}</LinkButton>
        </section>
      )}
    </div>
  );
}
