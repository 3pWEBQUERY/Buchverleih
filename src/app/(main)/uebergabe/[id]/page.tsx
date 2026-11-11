import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listMessages, threadMembers } from "@/lib/chat";
import { dayToDate, fmtDay, fmtDayTime } from "@/lib/dates";
import { Avatar, Faces } from "@/components/kreise/faces";
import { IconArrowLeft, IconChat } from "@/components/icons";
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

  const agreed: [string, string | null][] = [
    ["Weg", h.route === "direct" ? `Direkt von ${h.prev_b} an ${h.next_b}` : h.route === "via_owner" ? `Über ${h.owner}` : null],
    ["Ort", h.agreed_place],
    ["Zeit", h.agreed_at ? fmtDayTime(h.agreed_at) : null],
  ];
  const people: [string, string][] = [[h.prev_b, `hat es bis ${fmtDay(dayToDate(h.prev_end))}`], [h.next_b, `ab ${fmtDay(dayToDate(h.next_start))}`], [h.owner, "verleiht"]];

  return (
    <div>
      <Link href={`/vorgaenge/${user.id === h.owner_id ? h.next_id : myLoan}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Zum Vorgang
      </Link>

      <header className="mb-8 md:mb-10 anim-rise">
        <p className="eyebrow">Übergabe-Chat</p>
        <h1 className="display text-[32px] md:text-[44px] mt-3">{m.title}</h1>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
          {people.map(([n, t]) => (
            <li key={n + t} className="flex items-center gap-2.5">
              <Avatar name={n} size={32} />
              <span className="text-[14px]"><span className="font-semibold">{n}</span> <span className="text-muted">{t}</span></span>
            </li>
          ))}
        </ul>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 lg:items-start">
        <section aria-label="Vereinbart" className="lg:order-2 lg:sticky lg:top-8 rounded-[12px] bg-paper-2 p-5 md:p-6">
          <p className="eyebrow">Vereinbart</p>
          <dl className="mt-3 divide-y divide-line">
            {agreed.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-3 text-[15px]">
                <dt className="text-muted">{k}</dt>
                <dd className={v ? "text-right font-semibold" : "text-right text-muted inline-flex items-center gap-1.5"}>{v ?? <><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait" />Noch offen</>}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-muted mt-3">Ein Terminvorschlag gilt erst, wenn alle drei angenommen haben.</p>
        </section>

        <section aria-labelledby="chat" className="lg:order-1 panel !rounded-[10px] overflow-hidden min-w-0">
          <div className="flex items-center justify-between gap-4 px-5 md:px-6 h-16 border-b border-line">
            <h2 id="chat" className="ui-title text-[19px] flex items-center gap-2.5"><IconChat width={18} height={18} className="text-muted" /> Zu dritt</h2>
            <Faces names={[h.prev_b, h.next_b, h.owner]} total={3} size={28} />
          </div>
          <HandoverChat id={id} me={user.id} initial={JSON.parse(JSON.stringify(messages))} readOnly={m.readOnly} defaultPlace={h.agreed_place} />
        </section>
      </div>
    </div>
  );
}
