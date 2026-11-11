import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";
import { ago, fmtDayTime } from "@/lib/dates";
import { LinkButton, PageTitle, SectionTitle, cx } from "@/components/ui";
import { MarkAllRead } from "./mark-read";

export const metadata: Metadata = { title: "Benachrichtigungen" };

type Row = { id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; read_at: Date | null; created_at: Date };

/** Benachrichtigungen in der Web-App (PRD 7.6). Beim Öffnen gelten alle als gelesen. */
export default async function BenachrichtigungenPage() {
  const user = await pageUser("/benachrichtigungen");
  const rows = await sql<Row[]>`
    select id, type, payload, loan_id, read_at, created_at from notifications
     where user_id = ${user.id} and channel = 'app' order by created_at desc limit 60`;
  const items = rows.map((r) => ({ ...r, ...renderNotification(r.type, r.payload ?? {}), href: r.loan_id ? `/vorgaenge/${r.loan_id}` : r.payload?.href ?? null }));
  const unread = items.filter((i) => !i.read_at);
  const read = items.filter((i) => i.read_at);

  return (
    <div>
      <MarkAllRead active={unread.length > 0} />
      <PageTitle sub={unread.length > 0 ? (unread.length === 1 ? "1 neue seit deinem letzten Besuch." : `${unread.length} neue seit deinem letzten Besuch.`) : undefined}>
        Benachrichtigungen
      </PageTitle>

      {items.length === 0 ? (
        <div className="py-10 border-y border-line flex flex-wrap items-center justify-between gap-4">
          <p className="text-ink-2">Noch nichts. Hier erscheinen Anfragen, Fristen und Titelalarme.</p>
          <LinkButton href="/suche">Bücher suchen</LinkButton>
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

function List({ title, items, unread }: { title: string; items: (Row & { title: string; body: string; href: string | null })[]; unread?: boolean }) {
  return (
    <section aria-label={title}>
      <SectionTitle className="mb-0!">{title}</SectionTitle>
      <ul className="divide-y divide-line border-b border-line">
        {items.map((n) => {
          const inner = (
            <>
              <span aria-hidden className={cx("mt-[9px] h-1.5 w-1.5 rounded-full", unread ? "bg-accent" : "bg-transparent")} />
              <span className="min-w-0">
                <span className={cx("block leading-snug", unread ? "font-semibold text-ink" : "text-ink-2", n.href && "group-hover:underline underline-offset-4")}>
                  {unread && <span className="sr-only">Neu: </span>}{n.title}
                </span>
                {n.body && <span className="block text-sm text-muted mt-0.5 leading-snug">{n.body}</span>}
              </span>
              <time dateTime={new Date(n.created_at).toISOString()} title={fmtDayTime(n.created_at)} className="text-sm text-muted whitespace-nowrap pt-px">
                {ago(n.created_at)}
              </time>
            </>
          );
          const cls = "group grid grid-cols-[6px_minmax(0,1fr)_auto] gap-x-3.5 md:gap-x-5 py-4 items-start";
          return (
            <li key={n.id} className={unread ? "anim-flash" : undefined}>
              {n.href ? <Link href={n.href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
