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
import { CircleMark } from "@/components/kreise/circle-mark";
import { dayToDate, dueDay, fmtDay } from "@/lib/dates";
import { InviteBox, LeaveCircle, MemberList, CircleSettings } from "./circle-client";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import { CIRCLES } from "@/lib/i18n/messages/circles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fallback = CIRCLES[await getLocale()].circle;
  if (!UUID.test(id)) return { title: fallback };
  const [c] = await sql<{ name: string }[]>`select name from circles where id = ${id}`;
  return { title: c?.name ?? fallback };
}

/** Einstellungen in Klartext statt als Tabelle */
function settingsText(c: Circle, l: Locale) {
  return CIRCLES[l].detail.settingsText(c.loan_days, c.auto_accept, c.fixed_spot, c.join_mode === "link");
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/kreise/${id}`);
  if (!UUID.test(id)) notFound();
  const l = await getLocale();
  const t = CIRCLES[l];
  const d = t.detail;

  let circle: Circle;
  try {
    circle = await circleFor(id, user.id);
  } catch {
    const mine = (await myCircles(user.id)).find((c) => c.id === id);
    if (mine?.my_status !== "pending") notFound();
    return (
      <div className="max-w-2xl">
        <p className="eyebrow flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait live-dot" /> {t.requestSent}</p>
        <h1 className="display text-[32px] md:text-[44px] mt-3">{mine.name}<em>.</em></h1>
        <div className="rounded-[10px] bg-paper-2 mt-8 p-6 md:p-8">
          <p className="text-[17px] text-ink-2">{d.pendingText}</p>
          <LinkButton href="/kreise" className="mt-6">{d.toCircles}</LinkButton>
        </div>
      </div>
    );
  }

  const [members, copies] = await Promise.all([circleMembers(id), circleShelf(id, user.id)]);
  const admin = circle.my_role === "admin";
  const inviteUrl = admin || circle.join_mode === "link" ? `${env.appUrl}/k/${circle.invite_code}` : null;
  const admins = members.filter((m) => m.role === "admin" && m.status === "active").length;

  const active = members.filter((m) => m.status === "active");
  const pendingCount = members.filter((m) => m.status === "pending").length;
  const lent = copies.filter((c) => c.lent_until).length;
  const free = copies.length - lent;
  const mine = copies.filter((c) => c.owner_id === user.id).length;
  const r = d.rules;
  const rules: [string, string, string][] = [
    [r.loanDays, r.loanDaysValue(circle.loan_days), r.loanDaysDesc],
    [r.accept, circle.auto_accept ? r.auto : r.manual, circle.auto_accept ? r.autoDesc : r.manualDesc],
    [r.spot, circle.fixed_spot ?? r.perLoan, circle.fixed_spot ? r.spotFixed : r.spotFree],
    [r.join, circle.join_mode === "link" ? r.byLink : r.byApproval, circle.join_mode === "link" ? r.linkDesc : r.approvalDesc],
  ];
  let n = 0;

  return (
    <div>
      <Link href="/kreise" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {t.back}
      </Link>

      <header className="mb-10 md:mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="min-w-0 flex items-start gap-4 md:gap-6 anim-rise">
          <span className="hidden sm:block"><CircleMark id={circle.id} name={circle.name} size={84} /></span>
          <span className="sm:hidden"><CircleMark id={circle.id} name={circle.name} size={56} /></span>
          <div className="min-w-0">
            <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{admin ? t.youAdmin : t.member}</span><span aria-hidden>·</span>
              <span>{circle.join_mode === "link" ? t.joinLink : t.joinApproval}</span>
              {admin && pendingCount > 0 && (
                <a href="#mitglieder" className="inline-flex items-center gap-1.5 h-6 px-2 rounded-[6px] bg-accent-soft text-accent-hover text-[12px] font-semibold normal-case tracking-normal">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />{t.joinRequests(pendingCount)}
                </a>
              )}
            </p>
            <h1 className="display text-[32px] md:text-[44px] mt-2 break-words">{circle.name}<em>.</em></h1>
            {circle.description && <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-2xl">{circle.description}</p>}
            <p className="sr-only">{settingsText(circle, l)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2 w-full lg:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
          <StatTile n={circle.member_count} label={t.members(circle.member_count)} href="#mitglieder" live={admin && pendingCount > 0} />
          <StatTile n={circle.copy_count} label={t.books(circle.copy_count)} href="#regal" />
          <StatTile n={free} label={t.freeNow} href="#regal" />
          <StatTile n={circle.loan_days} label={t.loanDaysLabel} href="#regeln" />
        </dl>
      </header>

      {/* Das gemeinsame Regal auf der dunklen Bühne */}
      <section id="regal" className="scroll-mt-24 surface-night rounded-[12px] px-5 md:px-9 pt-7 md:pt-9 pb-5 md:pb-7 -mx-1 md:mx-0" aria-labelledby="regal-t">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-night-muted">{d.shelfCount(copies.length, active.length)}</p>
            <h2 id="regal-t" className="text-[26px] md:text-[32px] font-[560] tracking-[-0.03em] leading-none mt-2">{d.shelf}</h2>
            {copies.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-night-muted tnum">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-night-ok" />{d.free(free)}</span>
                {lent > 0 && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-night-lent" />{d.lent(lent)}</span>}
                {mine > 0 && <span>{t.list.mine(mine)}</span>}
              </p>
            )}
          </div>
          <Faces names={active.slice(0, 5).map((m) => m.first_name)} seeds={active.slice(0, 5).map((m) => m.user_id)} photos={active.slice(0, 5).map((m) => m.avatar_key)} total={active.length} ring="ring-night" l={l} />
        </div>
        {copies.length === 0 ? (
          <div className="mt-6 mb-2 rounded-[8px] border border-night-line p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-night-muted">{d.noBooks}</p>
            <Link href="/regal" className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-medium inline-flex items-center hover:bg-accent-hover transition-colors">{d.toShelf}</Link>
          </div>
        ) : (
          <BookRow
            label={d.shelfOf(circle.name)}
            height={160}
            items={copies.map((c) => ({
              ...c,
              href: `/exemplar/${c.id}`,
              note: { tone: c.lent_until ? "lent" : "ok", text: `${c.lent_until ? d.until(fmtDay(dayToDate(dueDay(c.lent_until)), l)) : d.freeNote} · ${c.owner_id === user.id ? d.yourBook : c.owner_name}` },
            }))}
          />
        )}
      </section>

      <div className="mt-6 md:mt-8 grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-x-10 xl:gap-x-16 gap-y-10 items-start">
        <div className="min-w-0">
          <StepSection id="mitglieder" n={++n} title={d.members} aside={d.activeN(active.length)}
            desc={admin ? d.membersAdmin : d.membersMember}>
            <MemberList circleId={circle.id} me={user.id} admin={admin} members={members} />
          </StepSection>

          <StepSection id="regeln" n={++n} title={d.rulesTitle} desc={d.rulesDesc}>
            <dl className="grid sm:grid-cols-2 gap-2">
              {rules.map(([k, v, desc]) => (
                <div key={k} className="rounded-[10px] border border-line px-4 md:px-5 py-4 flex flex-col">
                  <dt className="text-[12.5px] text-muted">{k}</dt>
                  <dd className="text-[19px] font-[560] tracking-[-0.025em] mt-1 leading-tight break-words">{v}</dd>
                  <dd className="text-[13.5px] text-muted mt-1 leading-snug">{desc}</dd>
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
          <InviteBox circleId={circle.id} name={circle.name} url={inviteUrl} admin={admin} appUrl={env.appUrl} />
          <LeaveCircle circleId={circle.id} me={user.id} name={circle.name} lastAdmin={admin && admins === 1 && circle.member_count > 1} />
        </aside>
      </div>
    </div>
  );
}
