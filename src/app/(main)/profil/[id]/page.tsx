import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { publicProfile } from "@/lib/profile";
import { listVisibleShelf } from "@/lib/copies";
import { isUuid } from "@/lib/title-queries";
import { TZ, dayToDate, dueDay, fmtDay } from "@/lib/dates";
import { sql } from "@/lib/db";
import type { statusLabel } from "@/lib/i18n/de-CH";
import { labels } from "@/lib/i18n/labels";
import { htmlLang } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { PROFILE, responseTextL } from "@/lib/i18n/messages/profile";
import { Cover } from "@/components/cover";
import type { ShelfCopy } from "@/lib/copies";
import { Monogram } from "@/components/person/monogram";
import { LinkButton, Notice, cx } from "@/components/ui";
import { ProfileActions } from "./profile-actions";
import { BookRow } from "@/components/regal/book-row";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconCheck } from "@/components/icons";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const fallback = PROFILE[await getLocale()].title;
  if (!isUuid(id)) return { title: fallback };
  const p = await publicProfile(id, null);
  return { title: p && !p.deleted ? p.first_name : fallback, robots: { index: false, follow: false } };
}

/** Profil (PRD 4.7, 8.4): Vertrauen einschätzen. Drei Zahlen, Stufe, Regal. Keine Biografie, keine Sterne. */
export default async function ProfilPage({ params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await getUser();
  const viewer = user?.onboarded_at ? user : null;
  const p = await publicProfile(id, viewer?.id ?? null);
  if (!p) notFound();
  const l = await getLocale();
  const t = PROFILE[l];
  const L = labels(l);
  const LEVEL_HINT = t.levelHint;

  if (p.deleted) {
    return (
      <div className="space-y-8">
        <h1 className="display text-[32px] md:text-[44px] anim-rise">{t.deleted[0]}<em>{t.deleted[1]}</em></h1>
        <div className="rounded-[10px] border border-dashed border-line-strong px-6 py-8 md:px-8 flex flex-wrap items-center justify-between gap-5">
          <p className="text-ink-2 text-[16px]">{t.deletedText}</p>
          <LinkButton href="/suche" variant="secondary">{t.searchBooks}</LinkButton>
        </div>
      </div>
    );
  }

  const own = viewer?.id === p.id;
  const [shelf, genres, together] = await Promise.all([
    listVisibleShelf(p.id, viewer?.id ?? null),
    sql<{ genre: string; n: number }[]>`
      select w.genre, count(*)::int as n from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
       where c.owner_id = ${p.id} and c.removed_at is null and w.genre is not null
       group by w.genre order by n desc limit 4`,
    viewer && viewer.id !== p.id
      ? sql<{ id: string; kind: "lend" | "swap" | "gift"; status: keyof typeof statusLabel; title: string; authors: string[]; work_id: string; cover_key: string | null; mine: boolean; at: string }[]>`
          select l.id, l.kind, l.status, w.title, w.authors, e.work_id, e.cover_key, l.owner_id = ${viewer.id} as mine,
                 to_json(coalesce(l.closed_at, l.handed_over_at, l.requested_at)) #>> '{}' as at
            from loans l join copies c on c.id = l.copy_id join editions e on e.id = c.edition_id join works w on w.id = e.work_id
           where (l.owner_id = ${viewer.id} and l.borrower_id = ${p.id}) or (l.owner_id = ${p.id} and l.borrower_id = ${viewer.id})
           order by l.requested_at desc limit 6`
      : Promise.resolve([]),
  ]);
  const freeShelf = shelf.filter((c) => c.status === "available");
  const busyShelf = shelf.filter((c) => c.status !== "available");
  const noteFor = (c: ShelfCopy) =>
    c.status === "available" ? { tone: "ok" as const, text: t.note.free }
      : c.status === "lent" && c.lent_until ? { tone: "lent" as const, text: t.note.until(fmtDay(dayToDate(dueDay(c.lent_until)), l)) }
      : c.status === "reserved" ? { tone: "wait" as const, text: t.note.booked }
      : c.status === "requested" ? { tone: "wait" as const, text: t.note.requested }
      : c.status === "paused" ? { tone: "done" as const, text: t.note.paused }
      : { tone: "done" as const, text: t.note.notOffered };
  const done = p.lent + p.borrowed;
  const nextAt = [3, 10][p.trust_level] ?? null;
  const toNext = nextAt != null ? Math.max(0, nextAt - done) : null;
  const ratings = p.good_ratings + p.problem_ratings;
  const level = L.trustLabel[p.trust_level] ?? t.newcomer;

  const since = new Intl.DateTimeFormat(htmlLang[l], { month: "long", year: "numeric", timeZone: TZ }).format(new Date(p.member_since));
  const response = responseTextL(p.median_response_hours, l);
  const facts: [string, string][] = [
    ...(response ? [[t.answersUsually, response] as [string, string]] : []),
    [t.booksInShelf, String(shelf.length)],
  ];
  const otherHeading = t.otherHeading(p.first_name);
  const levels = [0, 1, 2];

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
      {/* ------------------------------------------------ Personenblatt */}
      <aside className="lg:sticky lg:top-8 space-y-5 min-w-0">
        {/* Eine Karte: Bild, Name, Ort, Stufe – darunter die Angaben */}
        <div className="rounded-[12px] border border-line overflow-hidden anim-rise">
          <div className="bg-paper-2 px-5 py-5 lg:px-6 lg:pt-9 lg:pb-7 flex items-center gap-4 lg:flex-col lg:text-center lg:gap-0">
            <span className="lg:hidden flex-none"><Monogram name={p.first_name} seed={p.id} size={76} photo={p.avatar_key} className="ring-4 ring-paper" /></span>
            <span className="hidden lg:block"><Monogram name={p.first_name} seed={p.id} size={128} photo={p.avatar_key} className="ring-[6px] ring-paper" /></span>
            <div className="min-w-0 lg:mt-5">
              <h1 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] leading-tight break-words">{p.first_name}</h1>
              <p className="text-[13.5px] text-muted mt-1">{[p.municipality, t.since(since)].filter(Boolean).join(" · ")}</p>
              <p className={cx("mt-3 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[12.5px] font-semibold",
                p.trust_level >= 2 ? "bg-ok/10 text-ok" : p.trust_level === 1 ? "bg-wait/10 text-ink-2" : "bg-paper text-ink-2")}>
                <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", p.trust_level >= 2 ? "bg-ok" : p.trust_level === 1 ? "bg-wait" : "bg-done")} />
                {t.level(level)}
              </p>
            </div>
          </div>

          <div className="divide-y divide-line border-t border-line">
          <p className="px-4 py-3 text-[13px] text-muted leading-snug">{t.levelLine(level, LEVEL_HINT[p.trust_level] ?? LEVEL_HINT[0])}</p>
          <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {facts.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
            ))}
          </dl>
          {genres.length > 0 && (
            <div className="px-4 py-3.5">
              <p className="text-[13px] text-muted">{t.mostly}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <li key={g.genre}>
                    <Link href={`/suche?genre=${encodeURIComponent(g.genre)}`} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-[6px] bg-paper-2 text-[12.5px] font-medium text-ink-2 hover:bg-accent-soft hover:text-accent-hover transition-colors">
                      {L.genreLabel[g.genre] ?? g.genre}<span className="text-muted tnum text-[11.5px]">{g.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>
        </div>

        {own ? (
          <div className="flex flex-col gap-2">
            <Link href="/einstellungen#profilbild" className="h-11 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
              {t.edit} <IconArrowRight width={16} height={16} />
            </Link>
            <Link href="/regal" className="h-11 rounded-[6px] border border-line-strong font-medium text-[14.5px] inline-flex items-center justify-center hover:border-ink-2 transition-colors">{t.manageShelf}</Link>
          </div>
        ) : viewer ? (
          <ProfileActions userId={p.id} name={p.first_name} blocked={p.blocked_by_me} />
        ) : null}
      </aside>

      {/* ------------------------------------------------ Zahlen, Regal, Vertrauen */}
      <div className="min-w-0">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 anim-rise">
          <div className="min-w-0">
            <p className="eyebrow">{own ? t.yourProfile : t.profile}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">
              {own ? <>{t.ownHeading[0]}<em>{t.ownHeading[1]}</em></> : <>{otherHeading[0]}<em>{otherHeading[1]}</em></>}
            </h2>
          </div>
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <StatTile n={p.lent} label={t.lent} />
            <StatTile n={p.borrowed} label={t.borrowed} />
            <StatTile n={p.punctual_pct == null ? "–" : `${p.punctual_pct}%`} label={t.punctual} />
          </dl>
        </header>

        {p.blocked_by_me && !own && (
          <Notice className="mt-6">{t.blocked(p.first_name)}</Notice>
        )}

        <StepSection id="regal" n={1} title={own ? t.yourShelf : t.shelfOf(p.first_name)} className="mt-10 md:mt-12"
          desc={own ? t.ownShelfDesc : t.otherShelfDesc}
          aside={t.books(shelf.length)}>
          {shelf.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-line-strong p-6 flex flex-wrap items-center justify-between gap-4">
              {own ? (
                <>
                  <p className="text-ink-2 text-[15px]">{t.ownEmpty}</p>
                  <LinkButton href="/regal/neu" variant="primary">{t.addBook}</LinkButton>
                </>
              ) : (
                <>
                  <p className="text-ink-2 text-[15px]">{t.otherEmpty(p.first_name)}</p>
                  <LinkButton href="/suche" variant="secondary">{t.searchOn}</LinkButton>
                </>
              )}
            </div>
          ) : (
            <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5">
              {[[t.freeNow, freeShelf], [t.busy, busyShelf]].filter(([, list]) => (list as ShelfCopy[]).length > 0).map(([label, list], gi) => (
                <section key={label as string} className={cx(gi > 0 && "mt-8")} aria-label={label as string}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-[19px] md:text-[22px] font-[560] tracking-[-0.03em] leading-none">{label as string}</h3>
                    <span className="text-[13px] text-night-muted tnum">{t.books((list as ShelfCopy[]).length)}</span>
                  </div>
                  <BookRow items={(list as ShelfCopy[]).map((c) => ({ ...c, note: noteFor(c) }))} height={150} hrefBase="/exemplar/" label={`${label as string}: ${t.shelfOf(p.first_name)}`} />
                </section>
              ))}
            </div>
          )}
        </StepSection>

        <StepSection id="rueckmeldungen" n={2} title={t.feedback} desc={t.feedbackDesc}>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="rounded-[10px] border border-line p-4 col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] text-muted">{t.punctualReturned}</p>
                <p className="text-[22px] font-[560] tracking-[-0.04em] tnum leading-none">{p.punctual_pct == null ? "–" : `${p.punctual_pct}%`}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-paper-3 overflow-hidden" aria-hidden>
                <span className={cx("block h-full rounded-full", (p.punctual_pct ?? 0) >= 90 ? "bg-ok" : (p.punctual_pct ?? 0) >= 70 ? "bg-wait" : "bg-late")} style={{ width: `${p.punctual_pct ?? 0}%` }} />
              </div>
              <p className="text-[12.5px] text-muted mt-2">{p.punctual_pct == null ? t.noReturns : t.fromAll(own ? null : p.first_name)}</p>
            </div>
            <div className="rounded-[10px] border border-line p-4 flex flex-col">
              <p className="text-[13px] text-muted">{t.good}</p>
              <p className="text-[26px] font-[560] tracking-[-0.04em] tnum leading-none mt-auto pt-3 text-ok">{p.good_ratings}</p>
              <p className="text-[12.5px] text-muted mt-1">{ratings ? t.of(ratings) : t.none}</p>
            </div>
            <div className="rounded-[10px] border border-line p-4 flex flex-col">
              <p className="text-[13px] text-muted">{t.answersUsually}</p>
              <p className="text-[20px] font-[560] tracking-[-0.03em] leading-tight mt-auto pt-3">{response ?? "–"}</p>
              <p className="text-[12.5px] text-muted mt-1">{t.onRequests}</p>
            </div>
          </div>
          {p.problem_ratings > 0 && (
            <p className="mt-3 text-[13.5px] text-ink-2 inline-flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wait" />{t.problems(p.problem_ratings)}</p>
          )}
        </StepSection>

        <StepSection id="vertrauen" n={3} title={t.trust} desc={t.trustDesc}
          aside={toNext != null ? (toNext > 0 ? t.toNext(toNext, L.trustLabel[p.trust_level + 1]) : t.soon(L.trustLabel[p.trust_level + 1])) : t.highest}>
          <ol className="grid sm:grid-cols-3 gap-2">
            {levels.map((lv) => {
              const on = lv === p.trust_level;
              const reached = lv <= p.trust_level;
              const isNext = lv === p.trust_level + 1 && nextAt != null;
              const pct = isNext ? Math.min(100, Math.round((done / nextAt!) * 100)) : reached ? 100 : 0;
              return (
                <li key={lv} className={cx("rounded-[10px] border p-4 flex flex-col", on ? "border-accent bg-accent-soft/30" : "border-line")} aria-current={on ? "step" : undefined}>
                  <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span className={cx("h-6 w-6 rounded-full grid place-items-center text-[12px] font-semibold tnum",
                        on ? "bg-accent text-accent-ink" : reached ? "bg-ink-2 text-paper" : "border-[1.5px] border-line-strong text-muted")}>
                        {reached && !on ? <IconCheck width={13} height={13} /> : lv + 1}
                      </span>
                      <span className={cx("font-medium text-[15px]", !reached && "text-muted")}>{L.trustLabel[lv]}</span>
                    </span>
                    {on && <span className="text-[12px] font-semibold text-accent-hover">{t.current}</span>}
                  </p>
                  <p className="text-[13px] text-muted mt-2 leading-snug">{LEVEL_HINT[lv]}</p>
                  <div className="mt-auto pt-3">
                    <div className="h-1 rounded-full bg-paper-3 overflow-hidden" aria-hidden>
                      <span className={cx("block h-full rounded-full", reached ? "bg-ink-2" : "bg-accent")} style={{ width: `${pct}%` }} />
                    </div>
                    {isNext && <p className="text-[12px] text-muted mt-1.5 tnum">{t.progress(Math.min(done, nextAt!), nextAt!)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {(p.visible_losses > 0 || (!own && p.shared_circles.length > 0)) && (
            <ul className="mt-3 rounded-[10px] border border-line divide-y divide-line text-[14px]">
              {p.visible_losses > 0 && (
                <li className="px-4 py-3 flex items-center gap-2.5 text-late">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-late" />
                  {t.losses(p.visible_losses)}
                </li>
              )}
              {!own && p.shared_circles.map((c) => (
                <li key={c}>
                  <Link href="/kreise" className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-paper-2 transition-colors">
                    <span className="flex items-center gap-2.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />{t.sharedCircle}<span className="font-medium">{c}</span></span>
                    <IconArrowRight width={15} height={15} className="text-accent-hover" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </StepSection>

        {together.length > 0 && (
          <StepSection id="mit-dir" n={4} title={t.together(p.first_name)} desc={t.togetherDesc} aside={t.loans(together.length)}>
            <ul className="rounded-[10px] border border-line divide-y divide-line overflow-hidden">
              {together.map((tg) => (
                <li key={tg.id}>
                  <Link href={`/vorgaenge/${tg.id}`} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] gap-4 items-center px-4 md:px-5 py-3 hover:bg-paper-2 transition-colors">
                    <Cover data={{ title: tg.title, authors: tg.authors, coverKey: tg.cover_key, seed: tg.work_id }} width={32} height={48} uniform />
                    <div className="min-w-0">
                      <p className="font-serif text-[16.5px] leading-tight truncate group-hover:underline underline-offset-4 decoration-1">{tg.title}</p>
                      <p className="text-[13px] text-muted mt-0.5 truncate">{L.offerNoun[tg.kind]} · {tg.mine ? t.youTo(p.first_name) : t.toYou(p.first_name)} · {fmtDay(tg.at, l)}</p>
                    </div>
                    <span className="text-[13px] text-ink-2 whitespace-nowrap">{L.statusLabel[tg.status] ?? tg.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </StepSection>
        )}
      </div>
    </div>
  );
}
