import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { newNearby } from "@/lib/copies";
import { myLoans } from "@/lib/loans/queries";
import { requirePhone } from "@/lib/trust";
import { Shelf } from "@/components/shelf";
import { Empty, LinkButton, Notice, SectionTitle } from "@/components/ui";
import { LoanRow } from "@/components/loan/loan-row";
import { fmtDistance } from "@/lib/geo";
import { StatusText } from "@/components/status";

/** Start angemeldet (PRD 8.4): Handlungsbedarf zuoberst, darunter zwei Regalreihen. */
export async function Home({ user }: { user: SessionUser }) {
  const origin = { lat: user.home_lat!, lng: user.home_lng! };
  const [loans, nearby, circleCopies, ownCount] = await Promise.all([
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
    sql<{ n: number }[]>`select count(*)::int as n from copies where owner_id = ${user.id} and removed_at is null`,
  ]);
  const mine = loans.filter((l) => l.turn === "me" && l.step);
  const running = loans.filter((l) => !(l.turn === "me" && l.step) && ["requested", "accepted", "active", "return_reported", "returned", "disputed"].includes(l.status));
  const hour = Number(new Intl.DateTimeFormat("de-CH", { hour: "numeric", hour12: false, timeZone: "Europe/Zurich" }).format(new Date()));
  const greet = hour < 11 ? "Guten Morgen" : hour < 18 ? "Grüezi" : "Guten Abend";

  return (
    <div className="space-y-14 md:space-y-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{user.municipality}</p>
          <h1 className="display text-4xl md:text-6xl mt-2">{greet}, {user.first_name}.</h1>
        </div>
        <LinkButton href="/regal/neu" variant="secondary">Buch einstellen</LinkButton>
      </header>

      {requirePhone() && !user.phone_verified_at && (
        <Notice tone="accent">
          Bevor du anfragen kannst, bestätige deine Mobilnummer. <Link href="/einstellungen#mobilnummer" className="underline underline-offset-4 font-medium">Jetzt bestätigen</Link>
        </Notice>
      )}

      <section>
        <SectionTitle aside={loans.length > 0 && <Link href="/vorgaenge" className="hover:underline">Alle Vorgänge</Link>}>Wartet auf dich</SectionTitle>
        {mine.length === 0 ? (
          <p className="text-muted">Nichts zu tun. {running.length > 0 ? `${running.length} ${running.length === 1 ? "Vorgang läuft" : "Vorgänge laufen"}.` : ""}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {mine.slice(0, 6).map((l) => <LoanRow key={l.id} loan={l} />)}
          </ul>
        )}
        {mine.length > 0 && running.length > 0 && (
          <p className="text-sm text-muted mt-3">Dazu {running.length} {running.length === 1 ? "laufender Vorgang" : "laufende Vorgänge"}, bei denen die andere Seite am Zug ist.</p>
        )}
      </section>

      <section>
        <SectionTitle aside={<Link href="/suche" className="hover:underline">Suchen</Link>}>Neu in deiner Nähe</SectionTitle>
        {nearby.length === 0 ? (
          <Empty text="Im Umkreis von 5 km ist in letzter Zeit nichts dazugekommen." action={<LinkButton href="/suche" size="sm">Weiter suchen</LinkButton>} />
        ) : (
          <Shelf
            label="Neu in deiner Nähe"
            items={nearby.map((c) => ({
              id: c.id,
              href: `/exemplar/${c.id}`,
              cover: { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id },
              caption: c.title,
              meta: (
                <span className="text-xs text-muted block">
                  {c.status === "available" ? <StatusText tone="ok">{fmtDistance(c.dist)}</StatusText> : <StatusText tone="lent">{fmtDistance(c.dist)}</StatusText>}
                </span>
              ),
            }))}
          />
        )}
      </section>

      {circleCopies.length > 0 ? (
        <section>
          <SectionTitle aside={<Link href="/kreise" className="hover:underline">Kreise</Link>}>Aus deinen Kreisen</SectionTitle>
          <Shelf
            label="Aus deinen Kreisen"
            items={circleCopies.map((c) => ({
              id: c.id,
              href: `/exemplar/${c.id}`,
              cover: { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id },
              caption: c.title,
              meta: <span className="text-xs text-muted">{c.owner_name} · {c.circle}</span>,
            }))}
          />
        </section>
      ) : ownCount[0].n === 0 ? (
        <section>
          <SectionTitle>Dein Regal</SectionTitle>
          <Empty text="Dein Regal ist noch leer. Ein Buch einstellen dauert unter 20 Sekunden." action={<LinkButton href="/regal/neu" variant="primary">Erstes Buch scannen</LinkButton>} />
        </section>
      ) : null}
    </div>
  );
}
