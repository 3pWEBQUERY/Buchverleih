import { notFound, redirect } from "next/navigation";
import { pageUser, origin } from "@/lib/page";
import { sql } from "@/lib/db";
import { copyDetail } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { myCircles } from "@/lib/circles";
import { CopyEditor } from "./copy-editor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Buch" };
  const [c] = await sql<{ title: string }[]>`select w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id where c.id = ${id}`;
  return { title: c ? `${c.title} bearbeiten` : "Buch" };
}

/** Exemplar bearbeiten (nur Besitzer). Jede Änderung speichert sofort. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/regal/${id}`);
  if (!UUID.test(id)) notFound();
  const copy = await copyDetail(id, user.id, origin(user));
  if (!copy) notFound();
  if (copy.owner_id !== user.id) redirect(`/exemplar/${id}`);
  const [calendar, circles] = await Promise.all([getCalendar(sql, id, user.id), myCircles(user.id)]);
  if (!calendar) notFound();
  return (
    <CopyEditor
      copy={copy}
      calendar={calendar}
      circles={circles.filter((c) => c.my_status === "active").map((c) => ({ id: c.id, name: c.name, loanDays: c.loan_days }))}
    />
  );
}
