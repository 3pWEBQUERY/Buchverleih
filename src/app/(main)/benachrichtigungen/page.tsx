import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";
import { ago, fmtDayTime } from "@/lib/dates";
import { LinkButton, cx } from "@/components/ui";
import { Spine } from "@/components/spine";
import { IconArrowRight, IconBell, IconBookmark, IconCalendar, IconChat, IconCheck, IconFlag, IconLoans, IconSwap } from "@/components/icons";
import { MarkAllRead } from "./mark-read";

export const metadata: Metadata = { title: "Benachrichtigungen" };

type Row = { id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; read_at: Date | null; created_at: Date };
type Item = Row & { title: string; body: string; href: string | null };

/** Symbol und Tonlage je Art – das Symbol ordnet ein, der Text sagt, was los ist */
function kindOf(t: NotificationType): { icon: typeof IconBell; tone: "late" | "ok" | "wait" | "plain" } {
  if (t.startsWith("request_") || t === "cancelled" || t === "extension_requested" || t === "start_earlier") return { icon: IconLoans, tone: "wait" };
  if (t === "overdue" || t === "overdue_late" || t === "overdue_case_possible" || t === "recalled") return { icon: IconCalendar, tone: "late" };
  if (t.startsWith("due_") || t === "extended" || t === "bookings_paused" || t === "someone_waiting") return { icon: IconCalendar, tone: "plain" };
  if (t.startsWith("case_") || t === "damage_reported") return { icon: IconFlag, tone: "late" };
  if (t === "returned" || t === "completed" || t === "handover_done" || t === "return_reported") return { icon: IconCheck, tone: "ok" };
  if (t === "title_alarm") return { icon: IconBookmark, tone: "ok" };
  if (t === "swap_offer" || t.startsWith("pass_on")) return { icon: IconSwap, tone: "plain" };
  if (t === "handover_chat") return { icon: IconChat, tone: "plain" };
  return { icon: IconBell, tone: "plain" };
}

const toneCls = {
  late: "bg-late/10 text-late",
  ok: "bg-ok/10 text-ok",
  wait: "bg-wait/10 text-wait",
  plain: "bg-paper-2 text-ink-2",
};

/** Benachrichtigungen in der Web-App (PRD 7.6). Beim Öffnen gelten alle als gelesen. */
export default async function BenachrichtigungenPage() {
  const user = await pageUser("/benachrichtigungen");
  const rows = await sql<Row[]>`
    select id, type, payload, loan_id, read_at, created_at from notifications
     where user_id = ${user.id} and channel = 'app' order by created_at desc limit 60`;
  const items: Item[] = rows.map((r) => ({ ...r, ...renderNotification(r.type, r.payload ?? {}), href: r.loan_id ? `/vorgaenge/${r.loan_id}` : r.payload?.href ?? null }));
  const unread = items.filter((i) => !i.read_at);
  const read = items.filter((i) => i.read_at);

  return (
    <div>
      <MarkAllRead active={unread.length > 0} />
      <header className="mb-10 md:mb-14 anim-rise">
        <p className="eyebrow flex items-center gap-2">
          {unread.length > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-accent live-dot" />}
          {unread.length > 0 ? (unread.length === 1 ? "1 neue seit deinem letzten Besuch" : `${unread.length} neue seit deinem letzten Besuch`) : "Alles gelesen"}
        </p>
        <h1 className="display text-[40px] min-[400px]:text-[44px] sm:text-[52px] md:text-[84px] mt-3 break-words">Benach&shy;richtigungen</h1>
      </header>

      {items.length === 0 ? (
        <div className="panel-quiet rounded-[18px] p-6 md:p-8 flex flex-col sm:flex-row sm:items-end gap-6">
          <div aria-hidden className="flex items-end gap-[3px] flex-none">
            <Spine title="Anfragen" height={74} />
            <Spine title="Fristen" height={66} />
            <Spine title="Titelalarme" height={80} />
          </div>
          <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
            <p className="text-[16px] text-ink-2 max-w-md">Noch nichts. Hier erscheinen Anfragen, Fristen und Titelalarme.</p>
            <LinkButton href="/suche" variant="ghost">Bücher suchen</LinkButton>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {unread.length > 0 && <List title="Neu" items={unread} unread />}
          {read.length > 0 && <List title={unread.length > 0 ? "Früher" : "Alle"} items={read} />}
        </div>
      )}
    </div>
  );
}

function List({ title, items, unread }: { title: string; items: Item[]; unread?: boolean }) {
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 className="ui-title text-[22px] md:text-[26px]">{title}</h2>
        <span className="text-sm text-muted tnum">{items.length}</span>
      </div>
      <ul className={cx("panel divide-y divide-line overflow-hidden", unread && "!border-line-strong")}>
        {items.map((n, i) => {
          const k = kindOf(n.type);
          const Icon = k.icon;
          const inner = (
            <>
              <span aria-hidden className={cx("relative h-10 w-10 rounded-full grid place-items-center flex-none", toneCls[k.tone])}>
                <Icon width={18} height={18} />
                {unread && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent ring-2 ring-paper" />}
              </span>
              <span className="min-w-0">
                <span className={cx("block leading-snug text-[15.5px]", unread ? "font-semibold text-ink" : "text-ink", n.href && "group-hover:underline underline-offset-4 decoration-1")}>
                  {unread && <span className="sr-only">Neu: </span>}{n.title}
                </span>
                {n.body && <span className="block text-[14px] text-muted mt-1 leading-snug">{n.body}</span>}
              </span>
              <span className="flex flex-col items-end gap-2 pt-0.5">
                <time dateTime={new Date(n.created_at).toISOString()} title={fmtDayTime(n.created_at)} className="text-[13px] text-muted whitespace-nowrap">
                  {ago(n.created_at)}
                </time>
                {n.href && <IconArrowRight aria-hidden width={16} height={16} className="text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-200" />}
              </span>
            </>
          );
          const cls = cx("group grid grid-cols-[40px_minmax(0,1fr)_auto] gap-x-4 px-4 md:px-6 py-4 items-start transition-colors", n.href && "hover:bg-paper-2");
          return (
            <li key={n.id} className={unread ? "anim-flash" : "anim-rise"} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              {n.href ? <Link href={n.href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
