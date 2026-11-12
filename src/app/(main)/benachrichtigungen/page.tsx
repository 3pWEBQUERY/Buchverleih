import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";
import { ago, diffDays, fmtDayTime, isoDay, todayCH } from "@/lib/dates";
import { LinkButton, PageTitle, cx } from "@/components/ui";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconBell, IconBookmark, IconCalendar, IconChat, IconCheck, IconFlag, IconLoans, IconSwap } from "@/components/icons";
import { MarkAllRead } from "./mark-read";
import { timeMeter, TimeMeterInline, type MeterInput } from "@/components/loan/loan-row";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import { NOTIF } from "@/lib/i18n/messages/notifications";

export async function generateMetadata(): Promise<Metadata> {
  return { title: NOTIF[await getLocale()].title };
}

type Row = { id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; read_at: Date | null; created_at: Date };
type Item = Row & { title: string; body: string; href: string | null; meter?: ReturnType<typeof timeMeter> };
type Group = "anfragen" | "fristen" | "alarme" | "weiteres";

/** Symbol, Tonlage und Gruppe je Art – das Symbol ordnet ein, der Text sagt, was los ist */
function kindOf(t: NotificationType): { icon: typeof IconBell; tone: "late" | "ok" | "wait" | "plain"; group: Group } {
  if (t.startsWith("request_") || t === "cancelled" || t === "extension_requested" || t === "start_earlier") return { icon: IconLoans, tone: "wait", group: "anfragen" };
  if (t === "overdue" || t === "overdue_late" || t === "overdue_case_possible" || t === "recalled") return { icon: IconCalendar, tone: "late", group: "fristen" };
  if (t.startsWith("due_") || t === "extended" || t === "bookings_paused" || t === "someone_waiting") return { icon: IconCalendar, tone: "plain", group: "fristen" };
  if (t.startsWith("case_") || t === "damage_reported") return { icon: IconFlag, tone: "late", group: "weiteres" };
  if (t === "returned" || t === "completed" || t === "handover_done" || t === "return_reported") return { icon: IconCheck, tone: "ok", group: "anfragen" };
  if (t === "title_alarm") return { icon: IconBookmark, tone: "ok", group: "alarme" };
  if (t === "swap_offer" || t.startsWith("pass_on")) return { icon: IconSwap, tone: "plain", group: "anfragen" };
  if (t === "handover_chat") return { icon: IconChat, tone: "plain", group: "anfragen" };
  return { icon: IconBell, tone: "plain", group: "weiteres" };
}

const toneCls = {
  late: "bg-late/10 text-late",
  ok: "bg-ok/10 text-ok",
  wait: "bg-accent-soft text-accent-hover",
  plain: "bg-paper-2 text-ink-2",
};

const FILTERS: { id: "alle" | Group }[] = [{ id: "alle" }, { id: "anfragen" }, { id: "fristen" }, { id: "alarme" }, { id: "weiteres" }];

/** Nach Tagen gruppiert: Heute, Gestern, Diese Woche, Früher */
function dayGroup(d: Date, today: string, l: Locale) {
  const n = diffDays(isoDay(d), today);
  const t = NOTIF[l].days;
  return n <= 0 ? t.today : n === 1 ? t.yesterday : n < 7 ? t.week : t.earlier;
}

/** Benachrichtigungen in der Web-App (PRD 7.6). Beim Öffnen gelten alle als gelesen. */
export default async function BenachrichtigungenPage({ searchParams }: { searchParams: Promise<{ art?: string }> }) {
  const user = await pageUser("/benachrichtigungen");
  const l = await getLocale();
  const m = NOTIF[l];
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.id === sp.art) ? (sp.art as (typeof FILTERS)[number]["id"]) : "alle";
  const rows = await sql<Row[]>`
    select id, type, payload, loan_id, read_at, created_at from notifications
     where user_id = ${user.id} and channel = 'app' order by created_at desc limit 60`;
  const all: Item[] = rows.map((r) => ({ ...r, ...renderNotification(r.type, r.payload ?? {}, l), href: r.loan_id ? `/vorgaenge/${r.loan_id}` : r.payload?.href ?? null }));
  // Restzeit der zugehörigen Vorgänge, so wie sie jetzt steht – einmal pro Vorgang, bei der neuesten Benachrichtigung
  const loanIds = [...new Set(rows.map((r) => r.loan_id).filter((x): x is string => Boolean(x)))];
  const loans = loanIds.length
    ? await sql<(Omit<MeterInput, "role" | "other_name"> & { id: string; owner_id: string; owner_name: string; borrower_name: string })[]>`
        select l.id, l.status, l.kind, l.owner_id, l.wanted::text as wanted, l.due_at, l.respond_by, l.requested_at, l.handed_over_at,
               l.handover_by, l.returned_at, l.inspection_until, o.first_name as owner_name, b.first_name as borrower_name
          from loans l join users o on o.id = l.owner_id join users b on b.id = l.borrower_id
         where l.id in ${sql(loanIds)} and (l.owner_id = ${user.id} or l.borrower_id = ${user.id})`
    : [];
  const meters = new Map(loans.map((x) => {
    const owner = x.owner_id === user.id;
    return [x.id, timeMeter({ ...x, role: owner ? "owner" : "borrower", other_name: owner ? x.borrower_name : x.owner_name }, l)] as const;
  }));
  const shown = new Set<string>();
  for (const i of all) {
    if (i.loan_id && !shown.has(i.loan_id) && meters.get(i.loan_id)) {
      i.meter = meters.get(i.loan_id);
      shown.add(i.loan_id);
    }
  }
  const items = all.filter((i) => filter === "alle" || kindOf(i.type).group === filter);
  const unreadAll = all.filter((i) => !i.read_at).length;
  const unread = items.filter((i) => !i.read_at);
  const today = todayCH();
  const groups = new Map<string, Item[]>();
  for (const i of items.filter((x) => x.read_at)) {
    const g = dayGroup(new Date(i.created_at), today, l);
    groups.set(g, [...(groups.get(g) ?? []), i]);
  }
  const count = (id: (typeof FILTERS)[number]["id"]) => all.filter((i) => id === "alle" || kindOf(i.type).group === id).length;
  let n = 0;

  return (
    <div>
      <MarkAllRead active={unreadAll > 0} />
      <PageTitle
        eyebrow={<>{unreadAll > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-accent live-dot" />}{unreadAll > 0 ? m.newSince(unreadAll) : m.allRead}</>}
        sub={m.sub}
        aside={all.length > 0 && (
          <dl className="grid grid-cols-2 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={unreadAll} label={m.statNew} live={unreadAll > 0} />
            <StatTile n={all.length} label={m.statAll} />
          </dl>
        )}
      >
        {m.heading[0]}<em>{m.heading[1]}</em>
      </PageTitle>

      {all.length > 0 && (
        <nav aria-label={m.filter} className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 bg-paper/95 backdrop-blur-sm border-b border-line">
          <ul className="flex gap-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FILTERS.filter((f) => f.id === "alle" || count(f.id) > 0).map((f) => {
              const on = f.id === filter;
              return (
                <li key={f.id}>
                  <Link href={f.id === "alle" ? "/benachrichtigungen" : `/benachrichtigungen?art=${f.id}`} scroll={false} aria-current={on ? "page" : undefined}
                    className={cx("relative inline-flex items-center gap-2 h-12 text-[14px] font-medium whitespace-nowrap transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}>
                    {m.filters[f.id]} <span className="text-[12px] tnum text-muted">{count(f.id)}</span>
                    {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {all.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line-strong p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <span aria-hidden className="h-12 w-12 rounded-[8px] bg-accent-soft text-accent-hover grid place-items-center flex-none"><IconBell /></span>
          <div className="flex-1">
            <p className="text-[17px] font-medium">{m.empty}</p>
            <p className="text-[14.5px] text-muted mt-0.5 max-w-md">{m.emptyText}</p>
          </div>
          <LinkButton href="/suche" variant="secondary">{m.searchBooks}</LinkButton>
        </div>
      ) : (
        <div className="mt-4">
          {unread.length > 0 && <StepSection id="neu" n={++n} first title={m.newSection} aside={`${unread.length}`}><List items={unread} unread l={l} /></StepSection>}
          {[...groups.entries()].map(([g, list]) => (
            <StepSection key={g} n={++n} first={n === 1} title={g} aside={`${list.length}`}><List items={list} l={l} /></StepSection>
          ))}
          {items.length === 0 && (
            <p className="mt-10 text-muted text-[15px]">
              {m.noneOfKind} <Link href="/benachrichtigungen" className="text-accent-hover font-medium inline-flex items-center gap-1 hover:underline underline-offset-4">{m.showAll} <IconArrowRight width={14} height={14} /></Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function List({ items, unread, l }: { items: Item[]; unread?: boolean; l: Locale }) {
  return (
    <ul className={cx("rounded-[10px] border divide-y divide-line overflow-hidden", unread ? "border-accent/40" : "border-line")}>
      {items.map((n, i) => {
        const k = kindOf(n.type);
        const Icon = k.icon;
        const inner = (
          <>
            <span aria-hidden className={cx("relative h-9 w-9 rounded-[8px] grid place-items-center flex-none", toneCls[k.tone])}>
              <Icon width={17} height={17} />
            </span>
            <span className="min-w-0">
              <span className={cx("block leading-snug text-[15px]", unread ? "font-medium text-ink" : "text-ink", n.href && "group-hover:underline underline-offset-4 decoration-1")}>
                {unread && <span className="sr-only">{NOTIF[l].newSr}</span>}{n.title}
              </span>
              {n.body && <span className="block text-[13.5px] text-muted mt-0.5 leading-snug">{n.body}</span>}
              {n.meter && <TimeMeterInline m={n.meter} className="mt-2.5" />}
            </span>
            <span className="flex flex-col items-end gap-2 pt-0.5">
              <time dateTime={new Date(n.created_at).toISOString()} title={fmtDayTime(n.created_at, l)} className="text-[12.5px] text-muted whitespace-nowrap tnum flex items-center gap-1.5">
                {unread && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
                {ago(n.created_at, l)}
              </time>
              {n.href && <IconArrowRight aria-hidden width={16} height={16} className="text-accent-hover opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-200" />}
            </span>
          </>
        );
        const cls = cx("group grid grid-cols-[36px_minmax(0,1fr)_auto] gap-x-4 px-4 md:px-5 py-3.5 items-start transition-colors", unread && "bg-accent-soft/15", n.href && "hover:bg-paper-2");
        return (
          <li key={n.id} className={unread ? "anim-flash" : "anim-rise"} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            {n.href ? <Link href={n.href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}
