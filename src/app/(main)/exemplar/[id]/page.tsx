import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { copyDetail } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { origin } from "@/lib/page";
import { requestBlocker } from "@/lib/trust";
import { Cover, imageUrl } from "@/components/cover";
import { Dl, LinkButton } from "@/components/ui";
import { StatusText, shelfStatusText } from "@/components/status";
import { conditionHint, conditionLabel, languageLabel, offerLabel, trustLabel } from "@/lib/i18n/de-CH";
import { fmtDistance } from "@/lib/geo";
import { RequestPanel } from "./request-panel";
import { CalendarView } from "@/components/calendar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c] = await sql<{ title: string }[]>`select e.title from copies c join editions e on e.id = c.edition_id where c.id = ${id}`;
  return { title: c?.title ?? "Buch" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const copy = await copyDetail(id, user?.id ?? null, origin(user));
  if (!copy) notFound();
  const own = user?.id === copy.owner_id;
  const [cal, blocker, myOffers, circles] = await Promise.all([
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
  ]);
  const st = shelfStatusText(copy);
  const photo = copy.photos[0];

  return (
    <div className="grid md:grid-cols-12 gap-x-12 gap-y-10">
      <div className="md:col-span-4">
        <div className="anim-cover md:sticky md:top-12">
          <Cover large priority width={280} className="max-w-full" data={{ title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id }} />
          {copy.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {copy.photos.slice(1).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={imageUrl(p.key, false)} target="_blank"><img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-20 w-auto rounded-xs outline outline-1 outline-black/10" /></a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-8 min-w-0">
        <p className="eyebrow">{copy.offers.map((o) => offerLabel[o]).join(" · ") || "Nicht angeboten"}</p>
        <h1 className="display text-4xl md:text-6xl mt-3">{copy.title}</h1>
        <p className="text-lg text-ink-2 mt-3">{copy.authors.join(", ")}</p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 items-center">
          <StatusText tone={st.tone}>{st.text}</StatusText>
          <Link href={`/titel/${copy.work_id}`} className="text-sm text-muted hover:underline">Weitere Exemplare dieses Titels</Link>
        </div>

        <section className="mt-10">
          <Dl items={[
            ["Zustand", <span key="z">{conditionLabel[copy.condition]} <span className="text-muted">· {conditionHint[copy.condition]}</span></span>],
            ...(copy.condition_note ? [["Notiz", copy.condition_note] as [string, string]] : []),
            ["Ausgabe", [copy.publisher, copy.year, copy.binding === "hardcover" ? "gebunden" : copy.binding === "paperback" ? "Taschenbuch" : null].filter(Boolean).join(", ") || "–"],
            ["Sprache", copy.language ? languageLabel[copy.language] ?? copy.language : "–"],
            ["Leihfrist", `${circles[0]?.loan_days ?? copy.loan_days} Tage${circles[0] ? ` (Kreis ${circles[0].name})` : ""}`],
          ]} />
        </section>

        <section className="mt-10 grid sm:grid-cols-[1fr_auto] gap-6 items-start border-b border-line pb-8">
          <div>
            <p className="eyebrow">Verleiht</p>
            <Link href={`/profil/${copy.owner_id}`} className="font-serif text-2xl hover:underline mt-1 inline-block">{copy.owner_name}</Link>
            <p className="text-muted mt-1 text-[15px]">
              {trustLabel[copy.owner_trust]} · {copy.owner_municipality}
              {copy.dist != null && ` · ${fmtDistance(copy.dist)}`}
            </p>
          </div>
          {own && <LinkButton href={`/regal/${copy.id}`}>Bearbeiten</LinkButton>}
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
          <section className="mt-10">
            <h2 className="text-2xl mb-4">Verleihkalender</h2>
            <p className="text-sm text-muted mb-4">Andere sehen hier nur frei und belegt, ohne Namen.</p>
            <OwnCalendar cal={cal} />
          </section>
        )}
        <p className="mt-12 text-sm text-muted">
          Etwas stimmt an den Titeldaten nicht? <Link href={`/titel/${copy.work_id}#korrektur`} className="underline underline-offset-4">Fehler melden</Link>
        </p>
      </div>
    </div>
  );
}

function OwnCalendar({ cal }: { cal: NonNullable<Awaited<ReturnType<typeof getCalendar>>> }) {
  return <CalendarView cal={cal} />;
}
