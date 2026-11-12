import Link from "next/link";
import { pageUser } from "@/lib/page";
import { myCircles } from "@/lib/circles";
import { circlePreviews } from "@/lib/kreise-queries";
import { LinkButton, cx } from "@/components/ui";
import { Cover } from "@/components/cover";
import { CircleMark } from "@/components/kreise/circle-mark";
import { Faces } from "@/components/kreise/faces";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconPlus } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import { CIRCLES } from "@/lib/i18n/messages/circles";

export async function generateMetadata() {
  return { title: CIRCLES[await getLocale()].title };
}

/** Meine Kreise (PRD 7.5): geschlossene Gruppen mit gemeinsamem Regal. */
export default async function Page() {
  const user = await pageUser("/kreise");
  const l = await getLocale();
  const t = CIRCLES[l];
  const m = t.list;
  const circles = await myCircles(user.id);
  const previews = await circlePreviews(circles.map((c) => c.id), user.id);
  const active = circles.filter((c) => c.my_status !== "pending");
  const books = active.reduce((n, c) => n + c.copy_count, 0);
  const people = active.reduce((n, c) => n + c.member_count, 0);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">{m.eyebrow}</p>
          <h1 className="display text-[32px] md:text-[44px] mt-2">{m.heading[0]}<em>{m.heading[1]}</em></h1>
          <p className="text-[15.5px] md:text-[16px] text-ink-2 mt-3 leading-relaxed max-w-xl">
            {m.lead}
          </p>
        </div>
        {circles.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto anim-rise" style={{ animationDelay: "60ms" }}>
            <StatTile n={active.length} label={t.circles(active.length)} />
            <StatTile n={people} label={t.membersWord} />
            <StatTile n={books} label={t.booksWord} />
          </dl>
        )}
      </header>

      {circles.length === 0 ? (
        <div className="mt-10">
          <StepSection n={1} first title={m.howTitle} desc={m.howDesc}>
            <ol className="grid sm:grid-cols-3 gap-3">
              {m.steps.map(([st, d], i) => (
                <li key={st} className="rounded-[10px] border border-line p-5">
                  <span className="text-[13px] tnum text-accent-hover font-medium">0{i + 1}</span>
                  <p className="font-medium text-[16px] mt-3">{st}</p>
                  <p className="text-[13.5px] text-muted mt-1 leading-snug">{d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <LinkButton href="/kreise/neu" variant="primary" size="lg"><IconPlus width={18} height={18} /> {m.found}</LinkButton>
              <p className="text-[14px] text-muted">{m.haveLink}</p>
            </div>
          </StepSection>
        </div>
      ) : (
        <div className="mt-10">
          <StepSection n={1} first title={m.yours} aside={t.nCircles(circles.length)}
            desc={m.yoursDesc}>
            <ul className="grid xl:grid-cols-2 gap-3">
              {circles.map((c, i) => <CircleCard key={c.id} c={c} p={previews[c.id]} i={i} l={l} />)}
              <li className="anim-rise" style={{ animationDelay: `${Math.min(circles.length, 8) * 50}ms` }}>
                <Link href="/kreise/neu" className="group h-full min-h-[260px] rounded-[10px] border border-dashed border-line-strong flex flex-col items-center justify-center gap-3 p-8 text-center hover:border-accent transition-colors">
                  <span className="h-11 w-11 rounded-[6px] bg-accent-soft text-accent-hover group-hover:bg-accent group-hover:text-accent-ink grid place-items-center transition-colors"><IconPlus /></span>
                  <span className="font-medium text-[16px]">{m.newCard}</span>
                  <span className="text-[13.5px] text-muted max-w-[30ch]">{m.newCardText}</span>
                </Link>
              </li>
            </ul>
          </StepSection>
        </div>
      )}
    </div>
  );
}

type CircleRow = Awaited<ReturnType<typeof myCircles>>[number];
type Preview = Awaited<ReturnType<typeof circlePreviews>>[string];

/** Eine Karte pro Kreis: Zeichen, Name, Kennzahlen, die neuesten Bücher auf dem Brett, Mitglieder */
function CircleCard({ c, p, i, l }: { c: CircleRow; p: Preview | undefined; i: number; l: Locale }) {
  const t = CIRCLES[l];
  const m = t.list;
  const pending = c.my_status === "pending";
  const admin = c.my_role === "admin";
  const pv = p ?? { names: [], books: [], stats: { free_now: 0, pending: 0, active_loans: 0, mine: 0, new_week: 0 } };
  const st = pv.stats;
  const shown = pv.names.slice(0, 3).map((n) => n.name);
  const rest = c.member_count - shown.length;
  const tiles: [string | number, string, boolean?][] = [
    [c.member_count, t.members(c.member_count)],
    [c.copy_count, t.books(c.copy_count)],
    [st.free_now, t.freeNow, st.free_now > 0],
    [c.loan_days, t.loanDaysLabel],
  ];

  const body = (
    <>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-4 items-start">
        <CircleMark id={c.id} name={c.name} />
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
            {pending ? (
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait live-dot" />{t.requestSent}</span>
            ) : (
              <span>{admin ? t.youAdmin : t.member}</span>
            )}
            <span aria-hidden>·</span>
            <span>{c.join_mode === "approval" ? t.joinApproval : t.joinLink}</span>
          </p>
          <h2 className="text-[22px] md:text-[26px] font-[560] tracking-[-0.035em] leading-[1.08] mt-1 break-words group-hover:underline underline-offset-4 decoration-2">{c.name}</h2>
        </div>
        {!pending && (
          <span aria-hidden className="h-10 w-10 flex-none rounded-[6px] bg-accent-soft text-accent-hover grid place-items-center transition-colors group-hover:bg-accent group-hover:text-accent-ink">
            <IconArrowRight width={17} height={17} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
      {c.description && <p className="text-ink-2 text-[14.5px] mt-3 line-clamp-2">{c.description}</p>}

      {(admin && st.pending > 0) || st.new_week > 0 || st.active_loans > 0 || st.mine > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5 text-[12.5px]">
          {admin && st.pending > 0 && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-[6px] bg-accent-soft text-accent-hover font-semibold">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />{t.joinRequests(st.pending)}
            </span>
          )}
          {st.new_week > 0 && <span className="inline-flex items-center h-6 px-2 rounded-[6px] bg-ok/10 text-ok font-medium">{m.newWeek(st.new_week)}</span>}
          {st.active_loans > 0 && <span className="inline-flex items-center h-6 px-2 rounded-[6px] bg-paper-2 text-ink-2">{m.activeLoans(st.active_loans)}</span>}
          {st.mine > 0 && <span className="inline-flex items-center h-6 px-2 rounded-[6px] bg-paper-2 text-ink-2">{m.mine(st.mine)}</span>}
        </div>
      ) : null}

      {/* Kennzahlen */}
      <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {tiles.map(([n, label, live]) => (
          <div key={label} className="rounded-[8px] bg-paper-2 px-3 py-2.5 flex flex-col-reverse min-w-0">
            <dt className="text-[11.5px] text-muted mt-1 truncate">{label}</dt>
            <dd className={cx("text-[20px] font-[560] tracking-[-0.04em] leading-none tnum flex items-center gap-1.5", live && "text-ok")}>
              {n}{live && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />}
            </dd>
          </div>
        ))}
      </dl>

      {/* Die neuesten Bücher des Kreises auf dem Brett */}
      <div aria-hidden className="mt-3 surface-night rounded-[10px] px-4 pt-3.5 pb-[3px] relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 text-[11.5px] text-night-muted">
          <span>{m.newInShelf}</span>
          {c.copy_count > pv.books.length && <span className="tnum">{m.more(c.copy_count - pv.books.length)}</span>}
        </div>
        {pv.books.length > 0 ? (
          <div className="flex items-end gap-2 h-[72px] overflow-hidden">
            {pv.books.map((b) => (
              <span key={b.id} className="flex-none">
                <Cover width={46} height={69} uniform
                  data={{ title: b.title, authors: b.authors, coverKey: b.cover_key, photoKey: b.photo_key, photoW: b.photo_w, photoH: b.photo_h, seed: b.work_id }} />
              </span>
            ))}
          </div>
        ) : (
          <p className="h-[72px] flex items-center text-[13.5px] text-night-muted">{m.noBooks}</p>
        )}
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-night-ink/90" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {pending ? (
          <p className="text-[13.5px] text-muted max-w-xs">{m.waiting}</p>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <Faces names={pv.names.map((n) => n.name)} seeds={pv.names.map((n) => n.id)} photos={pv.names.map((n) => n.photo)} total={c.member_count} size={30} l={l} />
            <p className="text-[13px] text-muted truncate">{shown.join(", ")}{rest > 0 && m.andMore(rest)}</p>
          </div>
        )}
        {c.fixed_spot && <p className="text-[12.5px] text-muted truncate max-w-full">{m.handover}<span className="text-ink-2">{c.fixed_spot}</span></p>}
      </div>
    </>
  );
  return (
    <li className="anim-rise min-w-0" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
      {pending ? (
        <div className="rounded-[10px] border border-dashed border-line-strong p-5 md:p-6 h-full">{body}</div>
      ) : (
        <Link href={`/kreise/${c.id}`} className={cx("group rounded-[10px] border p-5 md:p-6 h-full block transition-colors", admin && st.pending > 0 ? "border-accent/50 hover:border-accent" : "border-line hover:border-accent")}>{body}</Link>
      )}
    </li>
  );
}
