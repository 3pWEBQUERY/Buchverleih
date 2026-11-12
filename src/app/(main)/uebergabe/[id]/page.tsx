import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listMessages, threadMembers } from "@/lib/chat";
import { dayToDate, fmtDay, fmtDayTime } from "@/lib/dates";
import { Cover } from "@/components/cover";
import { Monogram } from "@/components/person/monogram";
import { StepSection } from "@/components/step-section";
import { cx } from "@/components/ui";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { HandoverChat } from "./live";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";

export async function generateMetadata() {
  return { title: LOANS[await getLocale()].handover.title };
}

type Row = {
  route: string | null; agreed_place: string | null; agreed_at: Date | null; read_only_at: Date | null;
  prev_id: string; next_id: string; owner: string; prev_b: string; next_b: string; prev_end: string; next_start: string;
  owner_id: string; prev_bid: string; next_bid: string; copy_id: string; owner_avatar: string | null; prev_avatar: string | null; next_avatar: string | null;
  title: string; authors: string[]; work_id: string; cover_key: string | null; photo_key: string | null; photo_w: number | null; photo_h: number | null;
};

/**
 * Übergabe-Chat (PRD 4.10): ein Chat pro Wechsel mit Verleiher, aktuellem und nächstem Leiher.
 * Links fest, was vereinbart ist (Weg, Ort, Zeit), rechts der Wechsel und der Chat zu dritt.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await pageUser(`/uebergabe/${id}`);
  const l = await getLocale();
  const t = LOANS[l].handover;
  const D = LOANS[l].detail;
  const m = await threadMembers(sql, { type: "handover", id }).catch(() => null);
  if (!m || !m.members.includes(user.id)) notFound();
  const [h] = await sql<Row[]>`
    select hc.route, hc.agreed_place, hc.agreed_at, hc.read_only_at, p.id as prev_id, n.id as next_id,
           o.first_name as owner, pb.first_name as prev_b, nb.first_name as next_b, n.owner_id, p.borrower_id as prev_bid, n.borrower_id as next_bid,
           (upper(p.wanted) - 1)::text as prev_end, lower(n.wanted)::text as next_start, n.copy_id,
           o.avatar_key as owner_avatar, pb.avatar_key as prev_avatar, nb.avatar_key as next_avatar,
           w.title, w.authors, e.work_id, e.cover_key, ph.key as photo_key, ph.width as photo_w, ph.height as photo_h
      from handover_chats hc join loans p on p.id = hc.prev_loan_id join loans n on n.id = hc.next_loan_id
      join users o on o.id = n.owner_id join users pb on pb.id = p.borrower_id join users nb on nb.id = n.borrower_id
      join copies c on c.id = n.copy_id join editions e on e.id = c.edition_id join works w on w.id = e.work_id
      left join lateral (select key, width, height from copy_photos x where x.copy_id = c.id order by position limit 1) ph on true
     where hc.id = ${id}`;
  const messages = await listMessages({ type: "handover", id });
  const myLoan = user.id === h.prev_bid ? h.prev_id : h.next_id;
  const cover = { title: h.title, authors: h.authors, coverKey: h.cover_key, photoKey: h.photo_key, photoW: h.photo_w, photoH: h.photo_h, seed: h.work_id };
  const settled = Boolean(h.route && h.agreed_place && h.agreed_at);

  const agreed: [string, string | null][] = [
    [t.route, h.route === "direct" ? t.direct(h.prev_b, h.next_b) : h.route === "via_owner" ? t.viaOwner(h.owner) : null],
    [t.place, h.agreed_place],
    [t.time, h.agreed_at ? fmtDayTime(h.agreed_at, l) : null],
  ];
  const prevEnd = fmtDay(dayToDate(h.prev_end), l);
  const nextStart = fmtDay(dayToDate(h.next_start), l);
  const people: { id: string; name: string; role: string; photo: string | null }[] = [
    { id: h.prev_bid, name: h.prev_b, role: t.hasUntil(prevEnd), photo: h.prev_avatar },
    { id: h.next_bid, name: h.next_b, role: t.readsFrom(nextStart), photo: h.next_avatar },
    { id: h.owner_id, name: h.owner, role: t.lendsBook, photo: h.owner_avatar },
  ];
  const steps: { label: string; note: string; state: "done" | "current" | "open" }[] = [
    { label: h.prev_b, note: t.until(prevEnd), state: "done" },
    { label: t.handover, note: h.agreed_at ? fmtDayTime(h.agreed_at, l) : t.timeOpen, state: "current" },
    { label: h.next_b, note: t.from(nextStart), state: "open" },
  ];

  return (
    <div>
      <Link href={`/vorgaenge/${user.id === h.owner_id ? h.next_id : myLoan}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {t.toLoan}
      </Link>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] gap-x-10 xl:gap-x-16 gap-y-8 items-start">
        {/* ------------------------------------------------ Blatt: Buch, Vereinbart, Beteiligte */}
        <aside className="lg:col-start-1 lg:row-start-1 space-y-5 min-w-0">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
              <Link href={`/exemplar/${h.copy_id}`} className="book block" aria-label={D.viewCopy(h.title)}>
                <span className="book-face block lg:hidden"><Cover priority data={cover} width={104} height={156} uniform /></span>
                <span className="book-face hidden lg:block"><Cover priority large data={cover} width={220} height={330} uniform /></span>
              </Link>
            </div>
            <div className="anim-rise min-w-0">
              <h1 lang="de" className="font-serif text-[24px] md:text-[32px] leading-[1.1] hyphens-auto break-words">{h.title}</h1>
              {h.authors[0] && <p className="text-[14.5px] md:text-[15px] text-ink-2 mt-1.5">{h.authors.join(", ")}</p>}
            </div>
          </div>

          <section aria-labelledby="vereinbart" className="rounded-[10px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <h2 id="vereinbart" className="inline-flex items-center gap-2 text-[14px] font-medium">
                <span aria-hidden className={cx("h-2 w-2 rounded-full", settled ? "bg-ok" : "bg-wait")} />
                {settled ? t.allAgreed : t.agreed}
              </h2>
              {m.readOnly && <span className="text-[12.5px] text-muted">{t.closed}</span>}
            </div>
            <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {agreed.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className={cx("text-right", !v && "text-muted")}>{v ?? t.stillOpen}</dd>
                </div>
              ))}
            </dl>
            <p className="px-4 py-3 text-[12.5px] text-muted leading-snug">{t.allThree}</p>
          </section>

        </aside>

        {/* ------------------------------------------------ Wechsel und Chat */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 min-w-0">
          <header className="anim-rise">
            <p className="eyebrow">{t.eyebrow}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">{t.heading(h.prev_b, h.next_b)}<em>{settled ? t.settled : t.unsettled}</em></h2>
          </header>

          {/* Der Wechsel als drei Schritte */}
          <ol className="mt-8 rounded-[10px] border border-line p-5 md:p-6 grid grid-cols-3 gap-2 md:gap-3 anim-rise" style={{ animationDelay: "60ms" }} aria-label={t.stepsAria}>
            {steps.map((s, i) => (
              <li key={i} className="min-w-0" aria-current={s.state === "current" ? "step" : undefined}>
                <span aria-hidden className={cx("block h-1.5 rounded-full", s.state === "done" ? "bg-ink-2" : s.state === "current" ? (settled ? "bg-ok" : "bg-accent") : "bg-paper-3")} />
                <span className="mt-3 flex items-center gap-1.5 text-[13.5px] font-medium leading-tight truncate">
                  {s.state === "current" && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full flex-none", settled ? "bg-ok" : "bg-accent live-dot")} />}
                  {s.label}
                </span>
                <span className="block text-[12.5px] text-muted mt-1 tnum leading-snug">{s.note}</span>
              </li>
            ))}
          </ol>

          <StepSection id="chat" n={1} className="mt-10 md:mt-12" title={t.chatTitle}
            desc={m.readOnly ? t.chatClosed : t.chatOpen}
            aside={!m.readOnly && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok live-dot" /> {D.live}</span>}>
            <div className="rounded-[10px] border border-line overflow-hidden min-w-0">
              <HandoverChat id={id} me={user.id} initial={JSON.parse(JSON.stringify(messages))} readOnly={m.readOnly} defaultPlace={h.agreed_place} />
            </div>
            <Link href={`/vorgaenge/${user.id === h.owner_id ? h.next_id : myLoan}`} className="group mt-3 rounded-[10px] border border-line px-5 py-4 flex items-center justify-between gap-4 hover:border-accent transition-colors">
              <span>
                <span className="font-medium">{user.id === h.prev_bid ? t.myLoan : user.id === h.next_bid ? t.myNext : t.theNext}</span>
                <span className="block text-[13.5px] text-muted">{t.loanText}</span>
              </span>
              <IconArrowRight className="flex-none text-accent-hover transition-transform group-hover:translate-x-0.5" />
            </Link>
          </StepSection>
        </div>
        <aside className="lg:col-start-1 lg:row-start-2 min-w-0">
          <section aria-labelledby="beteiligt" className="rounded-[10px] border border-line p-4">
            <h2 id="beteiligt" className="text-[13px] text-muted mb-3">{t.involved}</h2>
            <ul className="space-y-3">
              {people.map((p) => (
                <li key={p.id + p.role} className="flex items-center gap-3 min-w-0">
                  <Monogram name={p.name} seed={p.id} size={36} photo={p.photo} />
                  <span className="min-w-0 leading-tight">
                    <Link href={`/profil/${p.id}`} className="font-medium hover:underline underline-offset-4">{p.name}</Link>
                    {p.id === user.id && <span className="text-muted">{t.you}</span>}
                    <span className="block text-[12.5px] text-muted mt-0.5 truncate">{p.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
