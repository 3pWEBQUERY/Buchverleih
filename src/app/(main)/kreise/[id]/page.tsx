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
import { StatTile, StepSection } from "@/components/step-section";
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
        <h1 className="display text-[44px] md:text-[64px] mt-3">{mine.name}<em>.</em></h1>
        <div className="rounded-[10px] bg-paper-2 mt-8 p-6 md:p-8">
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
  const pendingCount = members.filter((m) => m.status === "pending").length;
  const rules: [string, string][] = [
    ["Leihfrist", `${circle.loan_days} Tage für alle Bücher im Kreis`],
    ["Annahme", circle.auto_accept ? "Automatisch, wenn der Kalender frei ist" : "Wer verleiht, nimmt Anfragen selbst an"],
    ["Übergabeort", circle.fixed_spot ?? "Wird pro Leihe vereinbart"],
    ["Beitritt", circle.join_mode === "link" ? "Mit dem Einladungslink sofort" : "Mit Freigabe durch einen Admin"],
  ];
  let n = 0;

  return (
    <div>
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Kreise
      </Link>

      <header className="mb-10 md:mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">Kreis{admin ? " · du bist Admin" : ""}</p>
          <h1 className="display text-[44px] md:text-[64px] mt-2 break-words">{circle.name}<em>.</em></h1>
          {circle.description && <p className="text-[16px] md:text-[17px] text-ink-2 mt-4 leading-relaxed max-w-2xl">{circle.description}</p>}
          <p className="sr-only">{settingsText(circle)}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
          <StatTile n={circle.member_count} label={circle.member_count === 1 ? "Mitglied" : "Mitglieder"} href="#mitglieder" live={admin && pendingCount > 0} />
          <StatTile n={circle.copy_count} label={circle.copy_count === 1 ? "Buch" : "Bücher"} href="#regal" />
          <StatTile n={circle.loan_days} label="Tage Leihfrist" href="#regeln" />
        </dl>
      </header>

      {/* Das gemeinsame Regal auf der dunklen Bühne */}
      <section id="regal" className="scroll-mt-24 surface-night rounded-[12px] px-5 md:px-9 pt-7 md:pt-9 pb-5 md:pb-7 -mx-1 md:mx-0" aria-labelledby="regal-t">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-night-muted">{copies.length} {copies.length === 1 ? "Buch" : "Bücher"} von {active.length} {active.length === 1 ? "Person" : "Personen"}</p>
            <h2 id="regal-t" className="text-[28px] md:text-[36px] font-[560] tracking-[-0.035em] leading-none mt-2">Gemeinsames Regal</h2>
          </div>
          <Faces names={active.slice(0, 5).map((m) => m.first_name)} total={active.length} ring="ring-night" night />
        </div>
        {copies.length === 0 ? (
          <div className="mt-6 mb-2 rounded-[8px] border border-night-line p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-night-muted">Noch keine Bücher im Kreis. Wähle bei deinen Büchern unter «Bearbeiten», welche hier stehen.</p>
            <Link href="/regal" className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium inline-flex items-center hover:bg-accent-hover transition-colors">Zum Regal</Link>
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

      <div className="mt-6 md:mt-8 grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-x-10 xl:gap-x-16 gap-y-10 items-start">
        <div className="min-w-0">
          <StepSection id="mitglieder" n={++n} title="Mitglieder" aside={`${active.length} aktiv`}
            desc={admin ? "Als Admin gibst du Anfragen frei, ernennst weitere Admins oder entfernst Mitglieder." : "Wer im Kreis ist, sieht das gemeinsame Regal und kann Bücher anfragen."}>
            <MemberList circleId={circle.id} me={user.id} admin={admin} members={members} />
          </StepSection>

          <StepSection id="regeln" n={++n} title="Regeln im Kreis" desc="Gelten für alle Leihen zwischen Mitgliedern.">
            <dl className="rounded-[10px] border border-line divide-y divide-line">
              {rules.map(([k, v]) => (
                <div key={k} className="grid sm:grid-cols-[160px_minmax(0,1fr)] gap-x-6 gap-y-0.5 px-4 md:px-5 py-3.5 text-[14.5px]">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
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
          </StepSection>
        </div>

        <aside className="lg:sticky lg:top-8 min-w-0 space-y-4 lg:mt-12">
          <InviteBox circleId={circle.id} url={inviteUrl} admin={admin} appUrl={env.appUrl} />
          <LeaveCircle circleId={circle.id} me={user.id} name={circle.name} lastAdmin={admin && admins === 1 && circle.member_count > 1} />
        </aside>
      </div>
    </div>
  );
}
