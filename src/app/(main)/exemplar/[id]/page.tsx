import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { copyDetail, relatedForCopy } from "@/lib/copies";
import { getCalendar } from "@/lib/loans/calendar";
import { origin } from "@/lib/page";
import { publicProfile } from "@/lib/profile";
import { requestBlocker } from "@/lib/trust";
import { Cover, imageUrl } from "@/components/cover";
import { cx } from "@/components/ui";
import { shelfStatusText } from "@/components/status";
import { Monogram } from "@/components/person/monogram";
import { conditionHint, conditionLabel, languageLabel, offerLabel, trustLabel } from "@/lib/i18n/de-CH";
import { fmtDistance } from "@/lib/geo";
import { dayToDate, fmtDay, fmtMonthYear } from "@/lib/dates";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { CalendarView } from "@/components/calendar";
import { MoreBooks } from "@/components/more-books";
import { RequestPanel } from "./request-panel";
import { CorrectionForm } from "./correction";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Buch" };
  const [c] = await sql<{ title: string }[]>`select w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id where c.id = ${id}`;
  return { title: c?.title ?? "Buch" };
}

const toneDot = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" } as const;

/**
 * Exemplar (PRD 8.4): links das Produktblatt (Cover, Angaben, wer verleiht),
 * rechts die Anfrage in nummerierten Schritten mit Verleihkalender.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const copy = await copyDetail(id, user?.id ?? null, origin(user));
  if (!copy) notFound();
  const own = user?.id === copy.owner_id;
  const [rawCal, blocker, myOffers, circles, owner, related] = await Promise.all([
    getCalendar(sql, id, user?.id ?? null),
    user ? requestBlocker(sql, user) : Promise.resolve(null),
    user && copy.offers.includes("swap")
      ? sql<{ id: string; title: string }[]>`
          select c.id, w.title from copies c join editions e on e.id = c.edition_id join works w on w.id = e.work_id
           where c.owner_id = ${user.id} and c.removed_at is null and 'swap' = any(c.offers)
             and (c.transfer_locked_until is null or c.transfer_locked_until < now()) order by w.title`
      : Promise.resolve([]),
    user ? sql<{ loan_days: number; name: string }[]>`
      select ci.loan_days, ci.name from circles ci where ci.id = shared_circle_for_copy(${user.id}, ${id})` : Promise.resolve([]),
    publicProfile(copy.owner_id, user?.id ?? null),
    relatedForCopy(id, user?.id ?? null, origin(user)).catch(() => null),
  ]);
  const st = shelfStatusText(copy);
  const photo = copy.photos[0];
  const cover = { title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id };
  const dist = own ? null : fmtDistance(copy.dist);
  const loanDays = circles[0]?.loan_days ?? copy.loan_days;
  // Im Kreis gilt dessen Leihfrist – auch im Kalender
  const cal = rawCal ? { ...rawCal, loanDays } : rawCal;
  const extraPhotos = copy.cover_key ? copy.photos : copy.photos.slice(1);
  const freeFrom = cal?.free[0]?.start ?? null;
  const freeNow = freeFrom != null && cal != null && freeFrom === cal.today;
  const respond = owner?.median_response_hours;
  const respondText = respond == null ? null : respond < 1 ? "Antwortet meist innert einer Stunde" : respond < 24 ? `Antwortet meist innert ${Math.ceil(respond)} Std.` : `Antwortet meist innert ${Math.ceil(respond / 24)} Tagen`;
  const quick: { text: string; tone: "ok" | "wait" | "plain" }[] = [
    ...(copy.offers.includes("lend") && cal ? [{ text: freeNow ? "Jetzt frei" : freeFrom ? `Frei ab ${fmtDay(dayToDate(freeFrom))}` : "Gerade nicht buchbar", tone: freeNow ? "ok" as const : "wait" as const }] : []),
    ...(copy.offers.includes("lend") ? [{ text: `Bis ${loanDays} Tage`, tone: "plain" as const }] : []),
    ...(dist ? [{ text: `${dist} entfernt`, tone: "plain" as const }] : []),
    ...(respondText ? [{ text: respondText, tone: "plain" as const }] : []),
  ];

  const facts: [string, React.ReactNode][] = [
    ["Ausgabe", [copy.publisher, copy.year, copy.binding === "hardcover" ? "gebunden" : copy.binding === "paperback" ? "Taschenbuch" : null].filter(Boolean).join(", ") || "–"],
    ["Sprache", copy.language ? languageLabel[copy.language] ?? copy.language : "–"],
    ["Leihfrist", `${loanDays} Tage`],
    ...(copy.isbn13 ? [["ISBN", copy.isbn13] as [string, string]] : []),
  ];

  return (
    <div>
      <Link href={own ? "/regal" : "/suche"} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> {own ? "Mein Regal" : "Suche"}
      </Link>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
        {/* ------------------------------------------------ Produktblatt */}
        <aside className="lg:sticky lg:top-8 space-y-5">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-5 items-end lg:block lg:space-y-5">
            <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:p-8 flex justify-center anim-cover">
              <span className="block lg:hidden"><Cover priority data={cover} width={104} height={156} uniform /></span>
              <span className="hidden lg:block"><Cover priority large data={cover} width={220} height={330} uniform /></span>
            </div>
            <div className="anim-rise min-w-0">
              <h1 lang="de" className="font-serif text-[24px] md:text-[32px] leading-[1.1] hyphens-auto break-words">{copy.title}</h1>
              <p className="text-[14.5px] md:text-[15px] text-ink-2 mt-1.5">{copy.authors.join(", ")}</p>
            </div>
          </div>

          {extraPhotos.length > 0 && (
            <ul className="grid grid-cols-4 gap-2" aria-label="Fotos des Exemplars">
              {extraPhotos.slice(0, 4).map((p) => (
                <li key={p.id} className="aspect-[3/4]">
                  <a href={imageUrl(p.key, false)} target="_blank" className="block h-full rounded-[8px] overflow-hidden border border-line hover:border-ink-2 transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-full w-full object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-[10px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[14px] font-medium"><span aria-hidden className={cx("h-2 w-2 rounded-full", toneDot[st.tone])} />{st.text}</span>
              {dist && <span className="text-[13px] text-muted tnum">{dist}</span>}
            </div>
            <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {facts.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
              ))}
            </dl>
            <div className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] text-muted">Zustand</p>
                <p className="text-[13.5px] font-medium">{conditionLabel[copy.condition]}</p>
              </div>
              <div aria-hidden className="mt-2 grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((c) => (
                  <span key={c} className={cx("h-1.5 rounded-full", c <= copy.condition ? (c === copy.condition ? "bg-accent" : "bg-ink-2/70") : "bg-paper-3")} />
                ))}
              </div>
              <div aria-hidden className="mt-1.5 flex justify-between text-[11px] text-muted"><span>Wie neu</span><span>Stark gebraucht</span></div>
              <p className="text-[13px] text-muted leading-snug mt-2.5">
                {conditionHint[copy.condition]}.{copy.condition_note && <> Notiz: <span className="text-ink">«{copy.condition_note}»</span></>}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {own && (
              <Link href={`/regal/${copy.id}`} className="h-11 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
                Bearbeiten <IconArrowRight width={16} height={16} />
              </Link>
            )}
            <Link href={`/titel/${copy.work_id}`} className="h-11 rounded-[6px] border border-line-strong font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:border-accent hover:text-accent-hover transition-colors">
              {related && related.sameWork.length > 0 ? `${related.sameWork.length} ${related.sameWork.length === 1 ? "weiteres Exemplar" : "weitere Exemplare"} vergleichen` : "Zur Titelseite"} <IconArrowRight width={16} height={16} />
            </Link>
          </div>
          <CorrectionForm editionId={copy.edition_id} loggedIn={Boolean(user)} />
        </aside>

        {/* ------------------------------------------------ Anfrage */}
        <div className="min-w-0">
          <header className="anim-rise">
            <p className="eyebrow">{copy.offers.map((o) => offerLabel[o]).join(" · ") || "Nicht angeboten"}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">
              {own ? <>Dein Exemplar. <em>So sehen es andere.</em></>
                : copy.offers.includes("lend") ? <>Leih dir <em>dieses Buch.</em></>
                : copy.offers.includes("swap") ? <>Tausch <em>dieses Buch.</em></>
                : <>Ein Geschenk <em>für dich.</em></>}
            </h2>
            {!own && quick.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Auf einen Blick">
                {quick.map((q) => (
                  <li key={q.text} className={cx("inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[13px] font-medium",
                    q.tone === "ok" ? "bg-ok/10 text-ok" : q.tone === "wait" ? "bg-wait/10 text-ink-2" : "bg-paper-2 text-ink-2")}>
                    {q.tone !== "plain" && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", q.tone === "ok" ? "bg-ok" : "bg-wait")} />}
                    {q.text}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {/* Wer verleiht – vor der Anfrage sichtbar (PRD 6.1) */}
          <section aria-labelledby="verleiher" className="mt-10 rounded-[10px] border border-line p-5 md:p-6 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center anim-rise" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-4 min-w-0">
              <Monogram name={copy.owner_name} seed={copy.owner_id} size={56} photo={copy.owner_avatar} />
              <div className="min-w-0">
                <p className="text-[13px] text-muted">{own ? "Dein Exemplar" : "Verleiht"}</p>
                <Link id="verleiher" href={`/profil/${copy.owner_id}`} className="text-[22px] font-[560] tracking-[-0.03em] leading-tight hover:underline underline-offset-4 decoration-1">{copy.owner_name}</Link>
                <p className="text-[13.5px] text-muted mt-0.5">
                  {trustLabel[copy.owner_trust] ?? "Neu"}{copy.owner_municipality && ` · ${copy.owner_municipality}`} · seit {fmtMonthYear(copy.owner_since)}
                </p>
              </div>
            </div>
            {owner && (
              <dl className="grid grid-cols-3 gap-2">
                {[[String(owner.lent), "verliehen"], [String(owner.borrowed), "geliehen"], [owner.punctual_pct == null ? "–" : `${owner.punctual_pct}%`, "pünktlich"]].map(([n, l]) => (
                  <div key={l} className="rounded-[8px] bg-paper-2 px-4 py-3 min-w-[84px] flex flex-col-reverse">
                    <dt className="text-[12px] text-muted mt-1">{l}</dt>
                    <dd className="text-[24px] font-[560] tracking-[-0.04em] leading-none tnum">{n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {owner && !own && (owner.shared_circles.length > 0 || owner.good_ratings > 0) && (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-[13px] text-muted">
              {owner.shared_circles.length > 0 && <li>Gemeinsam in <span className="text-ink-2 font-medium">{owner.shared_circles.join(", ")}</span></li>}
              {owner.good_ratings > 0 && <li><span className="text-ink-2 font-medium tnum">{owner.good_ratings}</span> gute Bewertungen</li>}
            </ul>
          )}

          {/* So läuft es ab */}
          {!own && copy.offers.length > 0 && (
            <section aria-labelledby="ablauf" className="mt-8 anim-rise" style={{ animationDelay: "90ms" }}>
              <h3 id="ablauf" className="eyebrow mb-3">So läuft es ab</h3>
              <ol className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                {[
                  ["Anfragen", copy.offers.includes("lend") ? "Zeitraum wählen, kurz hallo sagen." : "Kurz hallo sagen und senden."],
                  ["Antwort", `${copy.owner_name} antwortet innert 72 Stunden${respond != null && respond < 24 ? `, meist in ${Math.max(1, Math.ceil(respond))} Std.` : "."}`],
                  ["Übergabe", "Ort im Chat abmachen, Code scannen, fertig."],
                  copy.offers.includes("lend")
                    ? ["Zurückgeben", `Nach ${loanDays} Tagen${copy.auto_extend ? ", verlängern geht" : ""}. Wir erinnern dich.`]
                    : ["Behalten", copy.offers.includes("swap") ? "Ihr tauscht, jedes Buch gehört danach der anderen Person." : "Das Buch gehört danach dir."],
                ].map(([t, d], i) => (
                  <li key={t} className="rounded-[10px] bg-paper-2 px-4 py-3.5">
                    <p className="flex items-center gap-2 text-[14px] font-semibold">
                      <span className="h-6 w-6 rounded-full bg-paper text-accent-hover text-[12px] grid place-items-center tnum border border-line">{i + 1}</span>{t}
                    </p>
                    <p className="text-[13px] text-muted mt-1.5 leading-snug">{d}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {!own && cal && (
            <RequestPanel
              copyId={copy.id}
              offers={copy.offers}
              calendar={cal}
              loggedIn={Boolean(user)}
              blocker={blocker}
              paused={copy.owner_paused}
              myOffers={myOffers}
              loanDays={loanDays}
              title={copy.title}
            />
          )}
          {own && cal && (
            <section className="mt-12 pt-12 border-t border-line" aria-labelledby="kalender">
              <div className="grid md:grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 mb-7">
                <span className="text-[13px] tnum text-muted pt-1.5">01</span>
                <div>
                  <h2 id="kalender" className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em]">Verleihkalender</h2>
                  <p className="text-[15px] text-muted mt-1.5">Du siehst Namen, andere nur frei und belegt.</p>
                </div>
              </div>
              <div className="md:pl-[72px]"><div className="rounded-[10px] border border-line p-5 md:p-6"><CalendarView cal={cal} /></div></div>
            </section>
          )}
        </div>
      </div>

      {related && <MoreBooks related={related} ownerName={copy.owner_name} ownerId={copy.owner_id} workId={copy.work_id} title={copy.title} hasOrigin={Boolean(origin(user))} />}
    </div>
  );
}
