import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { publicProfile } from "@/lib/profile";
import { listVisibleShelf } from "@/lib/copies";
import { isUuid } from "@/lib/title-queries";
import { trustLabel } from "@/lib/i18n/de-CH";
import { TZ } from "@/lib/dates";
import { Monogram } from "@/components/person/monogram";
import { LinkButton, Notice, cx } from "@/components/ui";
import { ProfileActions } from "./profile-actions";
import { BookRow } from "@/components/regal/book-row";
import { StatTile, StepSection } from "@/components/step-section";
import { IconArrowRight, IconCheck } from "@/components/icons";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Profil" };
  const p = await publicProfile(id, null);
  return { title: p && !p.deleted ? p.first_name : "Profil" };
}

const LEVEL_HINT: Record<number, string> = {
  0: "E-Mail und Mobilnummer bestätigt",
  1: "mindestens 3 Leihen, alle pünktlich",
  2: "mindestens 10 Leihen, kein Verlust in 12 Monaten",
};

const sinceFmt = new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric", timeZone: TZ });

/** Profil (PRD 4.7, 8.4): Vertrauen einschätzen. Drei Zahlen, Stufe, Regal. Keine Biografie, keine Sterne. */
export default async function ProfilPage({ params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await getUser();
  const viewer = user?.onboarded_at ? user : null;
  const p = await publicProfile(id, viewer?.id ?? null);
  if (!p) notFound();

  if (p.deleted) {
    return (
      <div className="space-y-8">
        <h1 className="display text-[32px] md:text-[44px] anim-rise">Konto <em>gelöscht.</em></h1>
        <div className="rounded-[10px] border border-dashed border-line-strong px-6 py-8 md:px-8 flex flex-wrap items-center justify-between gap-5">
          <p className="text-ink-2 text-[16px]">Diese Person ist nicht mehr bei Leihregal.</p>
          <LinkButton href="/suche" variant="secondary">Bücher suchen</LinkButton>
        </div>
      </div>
    );
  }

  const own = viewer?.id === p.id;
  const shelf = await listVisibleShelf(p.id, viewer?.id ?? null);
  const level = trustLabel[p.trust_level] ?? "Neu";

  const since = sinceFmt.format(new Date(p.member_since));
  const response = p.median_response_hours == null ? null
    : p.median_response_hours < 1 ? "unter 1 Stunde"
    : p.median_response_hours < 24 ? `ca. ${Math.round(p.median_response_hours)} Std.`
    : `ca. ${Math.round(p.median_response_hours / 24)} ${Math.round(p.median_response_hours / 24) === 1 ? "Tag" : "Tage"}`;
  const facts: [string, string][] = [
    ["Gemeinde", p.municipality ?? "–"],
    ["Mitglied seit", since],
    ...(response ? [["Antwortet meist", `innert ${response}`] as [string, string]] : []),
    ["Bücher im Regal", String(shelf.length)],
  ];
  const levels = [0, 1, 2];

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-10 xl:gap-16 items-start">
      {/* ------------------------------------------------ Personenblatt */}
      <aside className="lg:sticky lg:top-8 space-y-5 min-w-0">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-5 items-center lg:block lg:space-y-5">
          <div className="lg:rounded-[12px] lg:bg-paper-2 lg:border lg:border-line lg:py-10 flex justify-center anim-pop">
            <span className="lg:hidden"><Monogram name={p.first_name} seed={p.id} size={88} photo={p.avatar_key} /></span>
            <span className="hidden lg:block"><Monogram name={p.first_name} seed={p.id} size={136} photo={p.avatar_key} /></span>
          </div>
          <div className="anim-rise min-w-0">
            <h1 className="text-[26px] md:text-[30px] font-[560] tracking-[-0.03em] leading-tight break-words">{p.first_name}</h1>
            <p className="text-[14px] text-muted mt-1">{[p.municipality, `seit ${since}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <div className="rounded-[10px] border border-line divide-y divide-line">
          <div className="px-4 py-3.5">
            <p className="inline-flex items-center gap-2 text-[14px] font-medium">
              <span aria-hidden className={cx("h-2 w-2 rounded-full", p.trust_level >= 2 ? "bg-ok" : p.trust_level === 1 ? "bg-wait" : "bg-done")} />
              Stufe {level}
            </p>
            <p className="text-[13px] text-muted mt-1 leading-snug">{LEVEL_HINT[p.trust_level] ?? LEVEL_HINT[0]}</p>
          </div>
          <dl className="px-4 py-3 text-[13.5px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {facts.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum truncate">{v}</dd></div>
            ))}
          </dl>
        </div>

        {own ? (
          <div className="flex flex-col gap-2">
            <Link href="/einstellungen#profilbild" className="h-11 rounded-[6px] bg-accent-soft text-accent-hover font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-ink transition-colors">
              Profil bearbeiten <IconArrowRight width={16} height={16} />
            </Link>
            <Link href="/regal" className="h-11 rounded-[6px] border border-line-strong font-medium text-[14.5px] inline-flex items-center justify-center hover:border-ink-2 transition-colors">Mein Regal verwalten</Link>
          </div>
        ) : viewer ? (
          <ProfileActions userId={p.id} name={p.first_name} blocked={p.blocked_by_me} />
        ) : null}
      </aside>

      {/* ------------------------------------------------ Zahlen, Regal, Vertrauen */}
      <div className="min-w-0">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 anim-rise">
          <div className="min-w-0">
            <p className="eyebrow">{own ? "Dein Profil" : "Profil"}</p>
            <h2 className="display text-[28px] md:text-[38px] mt-2">
              {own ? <>So sehen dich <em>die anderen.</em></> : <>Bei {p.first_name} <em>leihen.</em></>}
            </h2>
          </div>
          <dl className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <StatTile n={p.lent} label="verliehen" />
            <StatTile n={p.borrowed} label="geliehen" />
            <StatTile n={p.punctual_pct == null ? "–" : `${p.punctual_pct}%`} label="pünktlich" />
          </dl>
        </header>

        {p.blocked_by_me && !own && (
          <Notice className="mt-6">Du hast {p.first_name} blockiert. {p.first_name} sieht dein Regal nicht und kann dich nicht anfragen.</Notice>
        )}

        <StepSection id="regal" n={1} title={own ? "Dein Regal" : `Regal von ${p.first_name}`} className="mt-10 md:mt-12"
          desc={own ? "So sieht dein Regal für andere aus. Nur angebotene Bücher erscheinen hier." : "Ein Tippen öffnet das Exemplar mit Kalender und Anfrage."}
          aside={shelf.length === 1 ? "1 Buch" : `${shelf.length} Bücher`}>
          {shelf.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-line-strong p-6 flex flex-wrap items-center justify-between gap-4">
              {own ? (
                <>
                  <p className="text-ink-2 text-[15px]">In deinem Regal steht noch nichts, das andere sehen.</p>
                  <LinkButton href="/regal/neu" variant="primary">Buch erfassen</LinkButton>
                </>
              ) : (
                <>
                  <p className="text-ink-2 text-[15px]">{p.first_name} bietet gerade keine Bücher an, die du sehen kannst.</p>
                  <LinkButton href="/suche" variant="secondary">Weiter suchen</LinkButton>
                </>
              )}
            </div>
          ) : (
            <div className="surface-night rounded-[12px] px-5 md:px-7 pt-5 md:pt-6 pb-4 md:pb-5">
              <BookRow items={shelf} height={150} hrefBase="/exemplar/" label={`Regal von ${p.first_name}`} wrap />
            </div>
          )}
        </StepSection>

        <StepSection id="vertrauen" n={2} title="Vertrauen" desc="Die Stufe ergibt sich allein aus abgeschlossenen Leihen. Keine Sterne, keine Punkte.">
          <ol className="grid sm:grid-cols-3 gap-2">
            {levels.map((l) => {
              const on = l === p.trust_level;
              const reached = l <= p.trust_level;
              return (
                <li key={l} className={cx("rounded-[10px] border p-4", on ? "border-accent bg-accent-soft/30" : "border-line")} aria-current={on ? "step" : undefined}>
                  <p className="flex items-center justify-between gap-2">
                    <span className={cx("font-medium text-[15px]", !reached && "text-muted")}>{trustLabel[l]}</span>
                    {reached && <IconCheck width={16} height={16} className={on ? "text-accent-hover" : "text-ok"} />}
                  </p>
                  <p className="text-[13px] text-muted mt-1 leading-snug">{LEVEL_HINT[l]}</p>
                </li>
              );
            })}
          </ol>
          {(p.visible_losses > 0 || (!own && p.shared_circles.length > 0)) && (
            <ul className="mt-3 rounded-[10px] border border-line divide-y divide-line text-[14px]">
              {p.visible_losses > 0 && (
                <li className="px-4 py-3 flex items-center gap-2.5 text-late">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-late" />
                  {p.visible_losses === 1 ? "1 Buch gilt als verloren" : `${p.visible_losses} Bücher gelten als verloren`} (letzte 24 Monate)
                </li>
              )}
              {!own && p.shared_circles.map((c) => (
                <li key={c}>
                  <Link href="/kreise" className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-paper-2 transition-colors">
                    <span className="flex items-center gap-2.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />Gemeinsamer Kreis: <span className="font-medium">{c}</span></span>
                    <IconArrowRight width={15} height={15} className="text-accent-hover" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </StepSection>
      </div>
    </div>
  );
}
