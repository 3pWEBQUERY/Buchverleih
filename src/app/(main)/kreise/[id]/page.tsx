import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { circleFor, circleMembers, myCircles, type Circle } from "@/lib/circles";
import { circleShelf } from "@/lib/circle-queries";
import { BookRow } from "@/components/regal/book-row";
import { Faces } from "@/components/kreise/faces";
import { LinkButton } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
import { InviteBox, LeaveCircle, MemberList, CircleSettings } from "./circle-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Kreis" };
  const [c] = await sql<{ name: string }[]>`select name from circles where id = ${id}`;
  return { title: c?.name ?? "Kreis" };
}

/** Einstellungen in Klartext statt als Tabelle */
function settingsText(c: Circle) {
  return [
    `Leihfrist ${c.loan_days} Tage.`,
    c.auto_accept ? "Anfragen werden automatisch angenommen, wenn der Kalender frei ist." : "Wer verleiht, nimmt Anfragen selbst an.",
    c.fixed_spot ? `Übergabe immer am selben Ort: ${c.fixed_spot}.` : "Den Übergabeort vereinbart ihr pro Leihe.",
    c.join_mode === "link" ? "Wer den Einladungslink hat, kann beitreten." : "Neue Mitglieder brauchen die Freigabe eines Admins.",
  ].join(" ");
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/kreise/${id}`);
  if (!UUID.test(id)) notFound();

  let circle: Circle;
  try {
    circle = await circleFor(id, user.id);
  } catch {
    const mine = (await myCircles(user.id)).find((c) => c.id === id);
    if (mine?.my_status !== "pending") notFound();
    return (
      <div className="max-w-2xl">
        <p className="eyebrow flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait live-dot" /> Anfrage gesendet</p>
        <h1 className="display text-[52px] md:text-[84px] mt-3">{mine.name}</h1>
        <div className="panel-quiet !rounded-[10px] mt-8 p-6 md:p-8">
          <p className="text-[17px] text-ink-2">Deine Beitrittsanfrage ist gesendet. Sobald ein Admin dich freigibt, siehst du hier das gemeinsame Regal.</p>
          <LinkButton href="/kreise" className="mt-6">Zu deinen Kreisen</LinkButton>
        </div>
      </div>
    );
  }

  const [members, copies] = await Promise.all([circleMembers(id), circleShelf(id)]);
  const admin = circle.my_role === "admin";
  const inviteUrl = admin || circle.join_mode === "link" ? `${env.appUrl}/k/${circle.invite_code}` : null;
  const admins = members.filter((m) => m.role === "admin" && m.status === "active").length;

  const active = members.filter((m) => m.status === "active");
  return (
    <div>
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Kreise
      </Link>

      <header className="mb-10 md:mb-12 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-8 items-end">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">Kreis{admin ? " · du bist Admin" : ""}</p>
          <h1 className="display text-[52px] md:text-[84px] mt-3 break-words">{circle.name}</h1>
          {circle.description && <p className="text-[17px] text-ink-2 mt-4 leading-relaxed max-w-2xl">{circle.description}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="chip">Leihfrist {circle.loan_days} Tage</span>
            <span className="chip">{circle.auto_accept ? "Anfragen automatisch angenommen" : "Annahme durch die Besitzer"}</span>
            {circle.fixed_spot && <span className="chip">Übergabe: {circle.fixed_spot}</span>}
            <span className="chip">{circle.join_mode === "link" ? "Beitritt per Link" : "Beitritt mit Freigabe"}</span>
          </div>
          <p className="sr-only">{settingsText(circle)}</p>
        </div>
        <div className="anim-rise w-full lg:w-auto" style={{ animationDelay: "80ms" }}>
          <dl className="grid grid-cols-2 gap-2">
            {([[circle.member_count, circle.member_count === 1 ? "Mitglied" : "Mitglieder"], [circle.copy_count, circle.copy_count === 1 ? "Buch" : "Bücher"]] as [number, string][]).map(([n, l]) => (
              <div key={l} className="panel-quiet px-5 py-4 min-w-[124px]">
                <dd className="font-[520] tracking-[-0.035em] text-[40px] leading-none tnum">{n}</dd>
                <dt className="text-[13px] text-muted mt-1.5">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* Das gemeinsame Regal auf der dunklen Bühne */}
      <section className="surface-night rounded-[12px] px-5 md:px-9 pt-7 md:pt-9 pb-5 md:pb-7 -mx-1 md:mx-0" aria-labelledby="regal">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-night-muted">{copies.length} {copies.length === 1 ? "Buch" : "Bücher"}</p>
            <h2 id="regal" className="text-[36px] md:text-[48px] leading-none mt-2">Gemeinsames Regal</h2>
          </div>
          <Faces names={active.slice(0, 5).map((m) => m.first_name)} total={active.length} ring="ring-night" night />
        </div>
        {copies.length === 0 ? (
          <div className="mt-6 mb-2 rounded-[8px] border border-night-line p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-night-muted">Noch keine Bücher im Kreis. Wähle in deinem Regal, welche hier stehen.</p>
            <Link href="/regal" className="h-11 px-5 rounded-[6px] bg-night-ink text-night font-semibold inline-flex items-center">Zum Regal</Link>
          </div>
        ) : (
          <BookRow
            label={`Gemeinsames Regal von ${circle.name}`}
            height={160}
            items={copies.map((c) => ({
              ...c,
              href: `/exemplar/${c.id}`,
              note: { tone: c.lent_until ? "lent" : "ok", text: `${c.owner_id === user.id ? "Dein Buch" : c.owner_name}${c.lent_until ? " · ausgeliehen" : ""}` },
            }))}
          />
        )}
      </section>

      <div className="mt-12 md:mt-14 grid lg:grid-cols-12 gap-x-10 gap-y-10">
        <div className="lg:col-span-7 min-w-0">
          <MemberList circleId={circle.id} me={user.id} admin={admin} members={members} />
        </div>

        <aside className="lg:col-span-5 min-w-0 space-y-4">
          <InviteBox circleId={circle.id} url={inviteUrl} admin={admin} appUrl={env.appUrl} />
          {admin && (
            <CircleSettings
              circleId={circle.id}
              initial={{
                name: circle.name,
                description: circle.description ?? "",
                loanDays: circle.loan_days as 14 | 28 | 42 | 56,
                autoAccept: circle.auto_accept,
                fixedSpot: circle.fixed_spot ?? "",
                joinMode: circle.join_mode,
              }}
            />
          )}
          <LeaveCircle circleId={circle.id} me={user.id} name={circle.name} lastAdmin={admin && admins === 1 && circle.member_count > 1} />
        </aside>
      </div>
    </div>
  );
}
