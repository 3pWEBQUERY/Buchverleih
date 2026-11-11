import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { publicProfile } from "@/lib/profile";
import { listVisibleShelf, type ShelfCopy } from "@/lib/copies";
import { isUuid } from "@/lib/title-queries";
import { trustLabel } from "@/lib/i18n/de-CH";
import { TZ } from "@/lib/dates";
import { Monogram } from "@/components/person/monogram";
import { LinkButton, Notice, cx } from "@/components/ui";
import { ProfileActions } from "./profile-actions";
import { NightShelf } from "./night-shelf";

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

function rows(items: ShelfCopy[], size = 12) {
  const out: ShelfCopy[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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
        <h1 className="display text-[52px] md:text-[84px] anim-rise">Konto <em>gelöscht.</em></h1>
        <div className="panel-quiet px-6 py-8 md:px-8 flex flex-wrap items-center justify-between gap-5">
          <p className="text-ink-2 text-[16px]">Diese Person ist nicht mehr bei Leihregal.</p>
          <LinkButton href="/suche" variant="ghost">Bücher suchen</LinkButton>
        </div>
      </div>
    );
  }

  const own = viewer?.id === p.id;
  const shelf = await listVisibleShelf(p.id, viewer?.id ?? null);
  const level = trustLabel[p.trust_level] ?? "Neu";

  const stats: { n: string; label: string; note?: string }[] = [
    { n: String(p.lent), label: p.lent === 1 ? "Buch verliehen" : "Bücher verliehen" },
    { n: String(p.borrowed), label: p.borrowed === 1 ? "Buch geliehen" : "Bücher geliehen" },
    { n: p.punctual_pct == null ? "–" : `${p.punctual_pct} %`, label: "pünktlich zurück", note: p.punctual_pct == null ? "noch keine Rückgabe" : undefined },
  ];

  return (
    <div className="space-y-12 md:space-y-16">
      {/* ------------------------------------------------------------ Kopf */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto] gap-x-5 md:gap-x-10 gap-y-6 items-center md:items-end">
        <div className="anim-pop self-start md:self-end">
          <span className="md:hidden block"><Monogram name={p.first_name} seed={p.id} size={96} /></span>
          <span className="hidden md:block"><Monogram name={p.first_name} seed={p.id} size={168} /></span>
        </div>
        <div className="min-w-0 anim-rise" style={{ animationDelay: "60ms" }}>
          <p className="eyebrow">{[p.municipality, `Mitglied seit ${sinceFmt.format(new Date(p.member_since))}`].filter(Boolean).join(" · ")}</p>
          <h1 className="display text-[52px] md:text-[84px] mt-2 md:mt-3 break-words">{p.first_name}</h1>
          <div className="mt-4 md:mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="chip !h-8 !px-3.5 !text-[13.5px]">
              <span aria-hidden className={cx("h-2 w-2 rounded-full", p.trust_level >= 2 ? "bg-ok" : p.trust_level === 1 ? "bg-wait" : "bg-done")} />
              Stufe {level}
            </span>
            <span className="text-[14px] text-muted">{LEVEL_HINT[p.trust_level] ?? LEVEL_HINT[0]}</span>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 md:row-start-1 md:col-start-3 md:self-end md:pb-2 anim-rise" style={{ animationDelay: "100ms" }}>
          {own ? (
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href="/regal" variant="secondary">Mein Regal</LinkButton>
              <LinkButton href="/einstellungen" variant="ghost">Einstellungen</LinkButton>
            </div>
          ) : viewer ? (
            <ProfileActions userId={p.id} name={p.first_name} blocked={p.blocked_by_me} />
          ) : null}
        </div>
      </header>

      {p.blocked_by_me && !own && (
        <Notice className="-mt-4 md:-mt-8">Du hast {p.first_name} blockiert. {p.first_name} sieht dein Regal nicht und kann dich nicht anfragen.</Notice>
      )}

      {/* --------------------------------------------------------- Zahlen */}
      <section aria-label="Zahlen">
        <dl className="grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div key={i} className="panel-quiet px-4 py-5 md:px-7 md:py-7 flex flex-col-reverse justify-end anim-rise" style={{ animationDelay: `${140 + i * 40}ms` }}>
              <dt className="text-[13px] md:text-[14px] text-muted mt-2 leading-snug">
                {s.label}{s.note && <span className="block text-[12px] mt-0.5">{s.note}</span>}
              </dt>
              <dd className="font-[520] tracking-[-0.035em] text-[40px] md:text-[72px] leading-[0.9] tnum whitespace-nowrap">{s.n}</dd>
            </div>
          ))}
        </dl>
        {(p.visible_losses > 0 || (!own && p.shared_circles.length > 0)) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {p.visible_losses > 0 && (
              <span className="chip"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-late" />{p.visible_losses === 1 ? "1 Buch gilt als verloren" : `${p.visible_losses} Bücher gelten als verloren`}</span>
            )}
            {!own && p.shared_circles.map((c) => (
              <Link key={c} href="/kreise" className="chip hover:bg-paper-3 transition-colors"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />Gemeinsamer Kreis: {c}</Link>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- Regal */}
      <section aria-labelledby="regal" className="surface-night rounded-[12px] px-5 md:px-9 pt-8 md:pt-10 pb-8 -mx-1 md:mx-0">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[12px] font-medium text-night-muted">
              {shelf.length === 1 ? "1 Buch" : `${shelf.length} Bücher`}{own && " · so sehen es andere"}
            </p>
            <h2 id="regal" className="text-[36px] md:text-[48px] leading-none mt-2">{own ? "Dein Regal" : `Regal von ${p.first_name}`}</h2>
          </div>
          {own && shelf.length > 0 && <Link href="/regal" className="hidden sm:inline-flex font-semibold link-grow">Verwalten</Link>}
        </div>
        {shelf.length === 0 ? (
          <div className="rounded-[8px] border border-night-line p-6 flex flex-wrap items-center justify-between gap-4">
            {own ? (
              <>
                <p className="text-night-muted">In deinem Regal steht noch nichts, das andere sehen.</p>
                <LinkButton href="/regal/neu" variant="primary">Buch einstellen</LinkButton>
              </>
            ) : (
              <>
                <p className="text-night-muted">{p.first_name} bietet gerade keine Bücher an, die du sehen kannst.</p>
                <Link href="/suche" className="h-11 px-5 rounded-[6px] bg-accent text-accent-ink font-semibold inline-flex items-center">Weiter suchen</Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {rows(shelf).map((row, r) => (
              <NightShelf key={r} items={row} offset={r * 12}
                label={r === 0 ? `Regal von ${p.first_name}` : `Regal von ${p.first_name}, Reihe ${r + 1}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
