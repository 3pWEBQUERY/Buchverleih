import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listMessages, threadMembers } from "@/lib/chat";
import { dayToDate, fmtDay, fmtDayTime } from "@/lib/dates";
import { Dl } from "@/components/ui";
import { HandoverChat } from "./live";

export const metadata = { title: "Übergabe-Chat" };

/**
 * Übergabe-Chat (PRD 4.10): ein Chat pro Wechsel mit Verleiher, aktuellem und nächstem Leiher.
 * Zuoberst fest angeheftet, was vereinbart ist: Weg, Ort, Datum.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await pageUser(`/uebergabe/${id}`);
  const m = await threadMembers(sql, { type: "handover", id }).catch(() => null);
  if (!m || !m.members.includes(user.id)) notFound();
  const [h] = await sql<{ route: string | null; agreed_place: string | null; agreed_at: Date | null; read_only_at: Date | null; prev_id: string; next_id: string; owner: string; prev_b: string; next_b: string; prev_end: string; next_start: string; owner_id: string; prev_bid: string }[]>`
    select hc.route, hc.agreed_place, hc.agreed_at, hc.read_only_at, p.id as prev_id, n.id as next_id,
           o.first_name as owner, pb.first_name as prev_b, nb.first_name as next_b, n.owner_id, p.borrower_id as prev_bid,
           (upper(p.wanted) - 1)::text as prev_end, lower(n.wanted)::text as next_start
      from handover_chats hc join loans p on p.id = hc.prev_loan_id join loans n on n.id = hc.next_loan_id
      join users o on o.id = n.owner_id join users pb on pb.id = p.borrower_id join users nb on nb.id = n.borrower_id
     where hc.id = ${id}`;
  const messages = await listMessages({ type: "handover", id });
  const myLoan = user.id === h.prev_bid ? h.prev_id : h.next_id;

  return (
    <div className="max-w-3xl">
      <p className="eyebrow">Übergabe-Chat</p>
      <h1 className="display text-4xl md:text-5xl mt-3">{m.title}</h1>
      <p className="text-ink-2 mt-3">{h.prev_b} hat das Buch bis {fmtDay(dayToDate(h.prev_end))}, {h.next_b} ab {fmtDay(dayToDate(h.next_start))}. {h.owner} verleiht.</p>

      <section className="mt-8 border-y-2 border-ink py-4" aria-label="Vereinbart">
        <p className="eyebrow mb-2">Vereinbart</p>
        <Dl className="border-y-0" items={[
          ["Weg", h.route === "direct" ? `Direkt von ${h.prev_b} an ${h.next_b}` : h.route === "via_owner" ? `Über ${h.owner}` : "Noch offen"],
          ["Ort", h.agreed_place ?? "Noch offen"],
          ["Zeit", h.agreed_at ? fmtDayTime(h.agreed_at) : "Noch offen"],
        ]} />
        <p className="text-sm text-muted mt-2">Ein Terminvorschlag gilt erst, wenn alle drei angenommen haben.</p>
      </section>

      <section className="mt-10">
        <HandoverChat id={id} me={user.id} initial={JSON.parse(JSON.stringify(messages))} readOnly={m.readOnly} defaultPlace={h.agreed_place} />
      </section>
      <p className="mt-8 text-sm"><Link href={`/vorgaenge/${user.id === h.owner_id ? h.next_id : myLoan}`} className="underline underline-offset-4">Zum Vorgang</Link></p>
    </div>
  );
}
