import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { circleFor, circleMembers, myCircles, type Circle } from "@/lib/circles";
import { circleShelf } from "@/lib/circle-queries";
import { Shelf } from "@/components/shelf";
import { StatusText } from "@/components/status";
import { Empty, LinkButton, SectionTitle } from "@/components/ui";
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
      <div className="max-w-xl">
        <p className="eyebrow">Kreis</p>
        <h1 className="display text-4xl md:text-6xl mt-3">{mine.name}</h1>
        <p className="text-ink-2 mt-6">Deine Beitrittsanfrage ist gesendet. Sobald ein Admin dich freigibt, siehst du hier das gemeinsame Regal.</p>
        <LinkButton href="/kreise" className="mt-8">Zu deinen Kreisen</LinkButton>
      </div>
    );
  }

  const [members, copies] = await Promise.all([circleMembers(id), circleShelf(id)]);
  const admin = circle.my_role === "admin";
  const inviteUrl = admin || circle.join_mode === "link" ? `${env.appUrl}/k/${circle.invite_code}` : null;
  const admins = members.filter((m) => m.role === "admin" && m.status === "active").length;

  return (
    <div>
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6 md:mb-8">
        <IconArrowLeft width={16} height={16} /> Kreise
      </Link>

      <header className="mb-10 md:mb-14 max-w-3xl">
        <p className="eyebrow tnum">
          Kreis · {circle.member_count} {circle.member_count === 1 ? "Mitglied" : "Mitglieder"} · {circle.copy_count} {circle.copy_count === 1 ? "Buch" : "Bücher"}
        </p>
        <h1 className="display text-4xl md:text-6xl mt-3">{circle.name}</h1>
        {circle.description && <p className="text-lg text-ink-2 mt-4 leading-relaxed">{circle.description}</p>}
        <p className="text-[15px] text-muted mt-4 leading-relaxed">{settingsText(circle)}</p>
      </header>

      <div className="grid md:grid-cols-12 gap-x-12 gap-y-14">
        <div className="md:col-span-8 min-w-0 space-y-14">
          <section>
            <SectionTitle aside={<span className="tnum">{copies.length}</span>}>Gemeinsames Regal</SectionTitle>
            {copies.length === 0 ? (
              <div className="-mt-5"><Empty text="Noch keine Bücher im Kreis. Wähle in deinem Regal, welche hier stehen." action={<LinkButton href="/regal" size="sm">Zum Regal</LinkButton>} /></div>
            ) : (
              <Shelf
                label={`Gemeinsames Regal von ${circle.name}`}
                height={160}
                items={copies.map((c) => ({
                  id: c.id,
                  href: `/exemplar/${c.id}`,
                  cover: { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id },
                  caption: c.title,
                  meta: (
                    <StatusText tone={c.lent_until ? "lent" : "ok"} className="text-muted">
                      {c.owner_id === user.id ? "Dein Buch" : c.owner_name}{c.lent_until ? " · ausgeliehen" : ""}
                    </StatusText>
                  ),
                }))}
              />
            )}
          </section>

          <MemberList circleId={circle.id} me={user.id} admin={admin} members={members} />
        </div>

        <aside className="md:col-span-4 min-w-0 space-y-12">
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
