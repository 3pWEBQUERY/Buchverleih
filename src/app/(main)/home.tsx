import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { newNearby } from "@/lib/copies";
import { myLoans } from "@/lib/loans/queries";
import { requirePhone } from "@/lib/trust";
import { LinkButton, Notice, cx } from "@/components/ui";
import { BookRow } from "@/components/regal/book-row";
import { StatTile, StepSection } from "@/components/step-section";
import { Monogram } from "@/components/person/monogram";
import { LoanRow } from "@/components/loan/loan-row";
import { fmtDistance } from "@/lib/geo";
import { IconArrowRight, IconBookmark, IconCheck, IconScan, IconSearch } from "@/components/icons";

/** Start angemeldet (PRD 8.4): Handlungsbedarf zuoberst, darunter zwei Regalreihen. */
export async function Home({ user }: { user: SessionUser }) {
  const origin = { lat: user.home_lat!, lng: user.home_lng! };
  const [loans, nearby, circleCopies, [counts], genres] = await Promise.all([
    myLoans(user.id),
    newNearby(user.id, origin, 5, 18),
    sql<{ id: string; work_id: string; title: string; authors: string[]; photo_key: string | null; photo_w: number | null; photo_h: number | null; cover_key: string | null; owner_name: string; circle: string }[]>`
      select distinct on (c.id) c.id, e.work_id, w.title, w.authors, e.cover_key, o.first_name as owner_name, ci.name as circle,
             ph.key as photo_key, ph.width as photo_w, ph.height as photo_h, c.created_at
        from circle_members m
        join circles ci on ci.id = m.circle_id
        join circle_copies cc on cc.circle_id = m.circle_id
        join copies c on c.id = cc.copy_id and c.removed_at is null and c.owner_id <> ${user.id} and cardinality(c.offers) > 0
        join editions e on e.id = c.edition_id join works w on w.id = e.work_id join users o on o.id = c.owner_id
        left join lateral (select key, width, height from copy_photos p where p.copy_id = c.id order by position limit 1) ph on true
       where m.user_id = ${user.id} and m.status = 'active'
       order by c.id, c.created_at desc limit 18`,
    sql<{ shelf: number; lent: number; borrowed: number }[]>`
      select (select count(*)::int from copies where owner_id = ${user.id} and removed_at is null) as shelf,
             (select count(*)::int from loans where owner_id = ${user.id} and status in ('active', 'return_reported', 'disputed')) as lent,
             (select count(*)::int from loans where borrower_id = ${user.id} and status in ('active', 'return_reported', 'disputed')) as borrowed`,
    sql<{ genre: string; n: number }[]>`
      select w.genre, count(*)::int as n from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
       where c.removed_at is null and cardinality(c.offers) > 0 and w.genre is not null and c.owner_id <> ${user.id}
       group by w.genre order by n desc limit 10`,
  ]);
  const mine = loans.filter((l) => l.turn === "me" && l.step);
  const running = loans.filter((l) => !mine.includes(l) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(l.status));
  const hour = Number(new Intl.DateTimeFormat("de-CH", { hour: "numeric", hour12: false, timeZone: "Europe/Zurich" }).format(new Date()));
  const greet = hour < 11 ? "Guten Morgen" : hour < 18 ? "Grüezi" : "Guten Abend";
  const today = new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Zurich" }).format(new Date());
  const summary = [
    mine.length ? `${mine.length === 1 ? "Ein Vorgang wartet" : `${mine.length} Vorgänge warten`} auf dich.` : "Gerade wartet nichts auf dich.",
    counts.lent ? `${counts.lent === 1 ? "Ein Buch ist" : `${counts.lent} Bücher sind`} verliehen.` : null,
    nearby.length ? `${nearby.length} neue ${nearby.length === 1 ? "Buch" : "Bücher"} im Umkreis von 5 km.` : null,
  ].filter(Boolean).join(" ");
  let n = 0;

  const quick: [string, string, string, React.ReactNode][] = [
    ["/regal/neu", "Buch erfassen", "Scannen, Zustand antippen, fertig.", <IconScan key="s" width={20} height={20} />],
    ["/suche", "Bücher suchen", "Titel, Autorin oder ISBN in deiner Nähe.", <IconSearch key="q" width={20} height={20} />],
    ["/wunschliste", "Wunschliste", "Titelalarm, sobald ein Buch frei wird.", <IconBookmark key="b" width={20} height={20} />],
  ];

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex items-center gap-4 md:gap-5 anim-rise">
          <Link href="/einstellungen#profilbild" className="flex-none hidden sm:block" aria-label="Profilbild ändern">
            <Monogram name={user.first_name || "?"} seed={user.id} size={64} photo={user.avatar_key} />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">{today} · {user.municipality}</p>
            <h1 className="display text-[32px] md:text-[44px] mt-1.5">{greet}, <em>{user.first_name}.</em></h1>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
          <StatTile n={counts.borrowed} label="bei dir" href="/vorgaenge?seite=leihe" />
          <StatTile n={counts.lent} label="verliehen" href="/vorgaenge?seite=verleihe" />
          <StatTile n={counts.shelf} label="im Regal" href="/regal" />
        </dl>
      </header>
      <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-4 max-w-2xl leading-relaxed anim-rise" style={{ animationDelay: "40ms" }}>{summary}</p>

      {requirePhone() && !user.phone_verified_at && (
        <Notice tone="accent" className="mt-6">
          Bevor du anfragen kannst, bestätige deine Mobilnummer. Das dauert eine Minute. <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4 font-medium">Jetzt bestätigen</Link>
        </Notice>
      )}

      {/* Schnellzugriff */}
      <ul className="mt-8 grid sm:grid-cols-3 gap-2 anim-rise" style={{ animationDelay: "80ms" }}>
        {quick.map(([href, title, text, icon], i) => (
          <li key={href}>
            <Link href={href} className={cx("group h-full rounded-[10px] border p-4 flex items-center gap-3.5 transition-colors",
              i === 0 && counts.shelf === 0 ? "border-accent bg-accent-soft/30 hover:bg-accent-soft/50" : "border-line hover:border-accent")}>
              <span className="h-10 w-10 rounded-[8px] bg-accent-soft text-accent-hover grid place-items-center flex-none transition-colors group-hover:bg-accent group-hover:text-accent-ink">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[15px]">{title}</span>
                <span className="block text-[13px] text-muted truncate">{text}</span>
              </span>
              <IconArrowRight width={16} height={16} className="flex-none text-accent-hover opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform]" />
            </Link>
          </li>
        ))}
      </ul>

      <StepSection id="wartet" n={++n} title="Wartet auf dich" className="mt-12 md:mt-14"
        aside={loans.length > 0 && <Link href="/vorgaenge" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">Alle Vorgänge <IconArrowRight width={14} height={14} /></Link>}
        desc={mine.length ? "Hier bist du am Zug. Ein Tippen führt direkt zum nächsten Schritt." : undefined}>
        {mine.length === 0 ? (
          <div className="rounded-[10px] bg-paper-2 px-5 py-5 flex items-center gap-4">
            <span className="h-10 w-10 rounded-full bg-accent-soft text-accent-hover grid place-items-center flex-none"><IconCheck width={18} height={18} /></span>
            <div>
              <p className="font-medium">Alles erledigt.</p>
              <p className="text-ink-2 text-[14.5px]">{running.length > 0 ? `${running.length} ${running.length === 1 ? "Vorgang läuft" : "Vorgänge laufen"}, die andere Seite ist am Zug.` : "Kein offener Vorgang. Zeit, etwas Neues zu lesen."}</p>
            </div>
          </div>
        ) : (
          <ul className="grid xl:grid-cols-2 gap-3">
            {mine.slice(0, 4).map((l, i) => <LoanRow key={l.id} loan={l} variant="action" i={i} />)}
          </ul>
        )}
        {running.length > 0 && mine.length > 0 && (
          <p className="text-[13.5px] text-muted mt-4">Dazu {running.length === 1 ? "ein laufender Vorgang, bei dem" : `${running.length} laufende Vorgänge, bei denen`} die andere Seite am Zug ist.</p>
        )}
      </StepSection>

      <StepSection id="naehe" n={++n} title="Neu in deiner Nähe" desc="Zuletzt eingestellt, im Umkreis von 5 km."
        aside={<Link href="/suche" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">Alle durchsuchen <IconArrowRight width={14} height={14} /></Link>}>
        {nearby.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-line-strong p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-ink-2 text-[15px]">Im Umkreis von 5 km ist in letzter Zeit nichts dazugekommen.</p>
            <LinkButton href="/suche" variant="secondary">Weiter suchen</LinkButton>
          </div>
        ) : (
          <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0">
            <BookRow label="Neu in deiner Nähe" height={165} hrefBase="/exemplar/"
              items={nearby.map((c) => ({ ...c, note: { tone: c.status === "available" ? "ok" as const : "lent" as const, text: `${c.status === "available" ? "frei" : "belegt"} · ${fmtDistance(c.dist)}` } }))} />
          </div>
        )}
      </StepSection>

      {circleCopies.length > 0 && (
        <StepSection id="kreise" n={++n} title="Aus deinen Kreisen" desc="Bücher von Mitgliedern deiner Kreise."
          aside={<Link href="/kreise" className="inline-flex items-center gap-1 font-medium text-accent-hover hover:underline underline-offset-4">Kreise <IconArrowRight width={14} height={14} /></Link>}>
          <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5 -mx-1 md:mx-0">
            <BookRow label="Aus deinen Kreisen" height={150} hrefBase="/exemplar/"
              items={circleCopies.map((c) => ({ ...c, note: { tone: "ok" as const, text: `${c.owner_name} · ${c.circle}` } }))} />
          </div>
        </StepSection>
      )}

      {genres.length > 0 && (
        <StepSection id="stoebern" n={++n} title="Stöbern" desc="Was gerade in den Regalen steht, nach Genre.">
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Link key={g.genre} href={`/suche?genre=${encodeURIComponent(g.genre)}`}
                className="h-11 pl-4 pr-1.5 rounded-[8px] border border-line inline-flex items-center gap-3 text-[14.5px] font-medium hover:border-accent hover:text-accent-hover transition-colors">
                {g.genre} <span className="h-8 min-w-8 px-2 rounded-[6px] bg-paper-2 text-ink-2 text-[12.5px] grid place-items-center tnum">{g.n}</span>
              </Link>
            ))}
          </div>
        </StepSection>
      )}

      {counts.shelf === 0 && (
        <section className="mt-12 rounded-[12px] border border-accent/40 bg-accent-soft/25 p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <p className="eyebrow">Dein Regal ist leer</p>
            <h2 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] mt-2 max-w-[22ch]">Ein Buch einstellen dauert keine Minute.</h2>
          </div>
          <LinkButton href="/regal/neu" variant="primary" size="lg"><IconScan width={18} height={18} /> Erstes Buch erfassen</LinkButton>
        </section>
      )}
    </div>
  );
}
