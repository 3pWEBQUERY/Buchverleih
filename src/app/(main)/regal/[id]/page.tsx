import { notFound, redirect } from "next/navigation";
import { pageUser, origin } from "@/lib/page";
import { sql } from "@/lib/db";
import { copyDetail } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { myCircles } from "@/lib/circles";
import { CopyEditor, type HistoryRow } from "./copy-editor";
import { getLocale } from "@/lib/i18n/server";
import { COPY } from "@/lib/i18n/messages/copy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = COPY[await getLocale()];
  if (!UUID.test(id)) return { title: t.titleFallback };
  const [c] = await sql<{ title: string }[]>`select w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id where c.id = ${id}`;
  return { title: c ? t.editTitle(c.title) : t.titleFallback };
}

/** Exemplar bearbeiten (nur Besitzer). Jede Änderung speichert sofort. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/regal/${id}`);
  if (!UUID.test(id)) notFound();
  const copy = await copyDetail(id, user.id, origin(user));
  if (!copy) notFound();
  if (copy.owner_id !== user.id) redirect(`/exemplar/${id}`);
  const [calendar, circles, history] = await Promise.all([
    getCalendar(sql, id, user.id),
    myCircles(user.id),
    sql<HistoryRow[]>`
      select l.id, l.kind, l.status, l.late, b.id as borrower_id, b.first_name as borrower_name, b.avatar_key as borrower_avatar,
             to_json(l.requested_at) #>> '{}' as requested_at, to_json(l.handed_over_at) #>> '{}' as handed_over_at,
             to_json(coalesce(l.returned_at, l.closed_at)) #>> '{}' as ended_at, to_json(l.due_at) #>> '{}' as due_at
        from loans l join users b on b.id = l.borrower_id
       where l.copy_id = ${id} and l.owner_id = ${user.id}
       order by l.requested_at desc limit 50`,
  ]);
  if (!calendar) notFound();
  return (
    <CopyEditor
      copy={copy}
      calendar={calendar}
      circles={circles.filter((c) => c.my_status === "active").map((c) => ({ id: c.id, name: c.name, loanDays: c.loan_days }))}
      history={history}
    />
  );
}
