import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { newNearby } from "@/lib/copies";
import { myLoans, type LoanListItem } from "@/lib/loans/queries";
import { requirePhone } from "@/lib/trust";
import { Cover } from "@/components/cover";
import { Notice, SectionTitle } from "@/components/ui";
import { fmtDistance } from "@/lib/geo";
import { offerNoun, statusLabel } from "@/lib/i18n/de-CH";
import { deadline, dueDay, fmtDay, dayToDate, parseRange, relHours, fmtRange } from "@/lib/dates";
import { IconArrowRight, IconCheck, IconScan } from "@/components/icons";
import { loanTone } from "@/components/loan/loan-row";
import { StatusText } from "@/components/status";

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

  return (
    <div className="space-y-16 md:space-y-20">
      <header className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
        <div className="anim-rise">
          <p className="eyebrow">{today} · {user.municipality}</p>
          <h1 className="display text-[48px] md:text-[68px] mt-3">{greet}, <em>{user.first_name}.</em></h1>
        </div>
        <dl className="grid grid-cols-3 gap-2 anim-rise" style={{ animationDelay: "80ms" }}>
          {[
            [counts.borrowed, "bei dir", "/vorgaenge"],
            [counts.lent, "verliehen", "/vorgaenge"],
            [counts.shelf, "im Regal", "/regal"],
          ].map(([n, l, href]) => (
            <Link key={String(l)} href={String(href)} className="panel-quiet px-5 py-4 min-w-[108px] hover:bg-paper-3 transition-colors">
              <dd className="font-[520] tracking-[-0.035em] text-[40px] leading-none tnum">{n}</dd>
              <dt className="text-[13px] text-muted mt-1.5">{l}</dt>
            </Link>
          ))}
        </dl>
      </header>

      {requirePhone() && !user.phone_verified_at && (
        <Notice tone="accent">
          Bevor du anfragen kannst, bestätige deine Mobilnummer. Das dauert eine Minute. <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4 font-semibold">Jetzt bestätigen</Link>
        </Notice>
      )}

      <section>
        <SectionTitle aside={loans.length > 0 && <Link href="/vorgaenge" className="link-grow">Alle Vorgänge</Link>}>
          Wartet auf dich {mine.length > 0 && <span className="ml-2 inline-grid place-items-center h-7 min-w-7 px-2 rounded-[6px] bg-accent text-accent-ink text-[14px] tnum align-middle">{mine.length}</span>}
        </SectionTitle>
        {mine.length === 0 ? (
          <div className="panel-quiet px-6 py-6 flex items-center gap-4">
            <span className="h-11 w-11 rounded-full bg-ink text-paper grid place-items-center flex-none"><IconCheck /></span>
            <div>
              <p className="font-semibold">Alles erledigt.</p>
              <p className="text-ink-2 text-[15px]">{running.length > 0 ? `${running.length} ${running.length === 1 ? "Vorgang läuft" : "Vorgänge laufen"}, die andere Seite ist am Zug.` : "Kein offener Vorgang. Zeit, etwas Neues zu lesen."}</p>
            </div>
          </div>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {mine.slice(0, 6).map((l, i) => <ActionCard key={l.id} loan={l} i={i} />)}
          </ul>
        )}
        {running.length > 0 && mine.length > 0 && (
          <p className="text-sm text-muted mt-4">Dazu {running.length === 1 ? "ein laufender Vorgang, bei dem" : `${running.length} laufende Vorgänge, bei denen`} die andere Seite am Zug ist.</p>
        )}
      </section>

      {/* Neu in der Nähe – auf der dunklen Bühne, damit die Cover leuchten */}
      <section className="surface-night rounded-[12px] px-5 md:px-9 pt-8 md:pt-10 pb-8 -mx-1 md:mx-0">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[12px] font-medium text-night-muted">Umkreis 5 km</p>
            <h2 className="text-[36px] md:text-[48px] leading-none mt-2">Neu in deiner Nähe</h2>
          </div>
          <Link href="/suche" className="hidden sm:inline-flex items-center gap-1.5 font-semibold link-grow">Alle durchsuchen <IconArrowRight width={16} height={16} /></Link>
        </div>
        {nearby.length === 0 ? (
          <div className="rounded-[8px] border border-night-line p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-night-muted">Im Umkreis von 5 km ist in letzter Zeit nichts dazugekommen.</p>
            <Link href="/suche" className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-semibold inline-flex items-center">Weiter suchen</Link>
          </div>
        ) : (
          <ul className="shelf" aria-label="Neu in deiner Nähe">
            {nearby.map((c, i) => {
              const cover = { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id };
              const w = 116;
              const free = c.status === "available";
              return (
                <li key={c.id} style={{ width: w, animationDelay: `${Math.min(i, 10) * 30}ms` }} className="anim-rise">
                  <Link href={`/exemplar/${c.id}`} className="book block group">
                    <div className="flex items-end" style={{ height: 190 }}><div className="book-face"><Cover data={cover} width={116} height={174} uniform /></div></div>
                    <div className="h-[3px] bg-night-ink/90 rounded-full" />
                    <p className="pt-2.5 text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline">{c.title}</p>
                    <p className="text-[12px] text-night-muted mt-1 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${free ? "bg-[#8fd09a]" : "bg-[#f0c060]"}`} />
                      {free ? "frei" : "belegt"} · {fmtDistance(c.dist)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {circleCopies.length > 0 && (
        <section>
          <SectionTitle aside={<Link href="/kreise" className="link-grow">Kreise</Link>}>Aus deinen Kreisen</SectionTitle>
          <ul className="shelf" aria-label="Aus deinen Kreisen">
            {circleCopies.map((c, i) => {
              const cover = { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id };
              const w = 112;
              return (
                <li key={c.id} style={{ width: w }}>
                  <Link href={`/exemplar/${c.id}`} className="book block group">
                    <div className="flex items-end" style={{ height: 180 }}><div className="book-face"><Cover data={cover} width={112} height={168} uniform /></div></div>
                    <div className="shelf-board" />
                    <p className="pt-2.5 text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline">{c.title}</p>
                    <p className="text-[12px] text-muted mt-0.5 truncate">{c.owner_name} · {c.circle}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {genres.length > 0 && (
        <section>
          <SectionTitle>Stöbern</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Link key={g.genre} href={`/suche?genre=${encodeURIComponent(g.genre)}`}
                className="h-12 pl-5 pr-2 rounded-[6px] border border-line-strong inline-flex items-center gap-3 font-semibold hover:bg-ink hover:text-paper hover:border-ink transition-colors">
                {g.genre} <span className="h-8 min-w-8 px-2 rounded-[6px] bg-paper-2 text-ink text-[13px] grid place-items-center tnum">{g.n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {counts.shelf === 0 && (
        <section className="rounded-[12px] bg-accent text-accent-ink p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <p className="eyebrow !text-accent-ink/75">Dein Regal ist leer</p>
            <h2 className="display text-[44px] md:text-[64px] mt-3 max-w-[14ch]">Ein Buch einstellen dauert <em>unter 20 Sekunden.</em></h2>
          </div>
          <Link href="/regal/neu" className="h-14 px-7 rounded-[6px] bg-paper text-accent-hover font-semibold inline-flex items-center gap-2"><IconScan width={20} height={20} /> Erstes Buch scannen</Link>
        </section>
      )}
    </div>
  );
}

/** Karte für einen Vorgang, bei dem du am Zug bist */
function ActionCard({ loan, i }: { loan: LoanListItem; i: number }) {
  const r = parseRange(loan.wanted);
  let when: string | null = null;
  if (loan.status === "requested") when = `Antwort ${relHours(loan.respond_by)}`;
  else if (loan.status === "accepted" && r && loan.kind === "lend") when = fmtRange(r);
  else if (loan.due_at && ["active", "disputed"].includes(loan.status)) {
    const d = dueDay(loan.due_at);
    when = new Date(loan.due_at) < new Date() ? `Fällig war ${fmtDay(dayToDate(d))}` : deadline(d);
  }
  return (
    <li className="anim-rise min-w-0" style={{ animationDelay: `${i * 40}ms` }}>
      <Link href={`/vorgaenge/${loan.id}`} className="group panel flex gap-4 p-4 pr-5 hover:border-ink transition-colors h-full">
        <Cover data={{ title: loan.title, authors: loan.authors, photoKey: loan.photo_key, photoW: loan.photo_w, photoH: loan.photo_h, seed: loan.work_id }} width={64} />
        <div className="min-w-0 flex-1 flex flex-col">
          <p className="text-[12.5px] text-muted">{offerNoun[loan.kind]} · {loan.role === "owner" ? `an ${loan.other_name}` : `von ${loan.other_name}`}</p>
          <p className="font-serif text-[24px] leading-[1.05] mt-1 truncate">{loan.title}</p>
          <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <StatusText tone={loanTone(loan.status, loan.due_at)} className="text-muted">{when ?? statusLabel[loan.status]}</StatusText>
            <span className="h-9 px-4 rounded-[6px] bg-accent text-accent-ink text-[13.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap group-hover:bg-accent-hover transition-colors">
              {loan.step!.label} <IconArrowRight width={15} height={15} />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

