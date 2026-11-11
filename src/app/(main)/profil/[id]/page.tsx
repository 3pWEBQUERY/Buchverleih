import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { publicProfile } from "@/lib/profile";
import { listVisibleShelf, type ShelfCopy } from "@/lib/copies";
import { isUuid } from "@/lib/title-queries";
import { trustLabel } from "@/lib/i18n/de-CH";
import { TZ } from "@/lib/dates";
import { Shelf } from "@/components/shelf";
import { StatusText, shelfStatusText } from "@/components/status";
import { Empty, LinkButton, Notice, SectionTitle } from "@/components/ui";
import { ProfileActions } from "./profile-actions";

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
      <div>
        <h1 className="display text-4xl md:text-6xl">Konto gelöscht</h1>
        <p className="text-ink-2 mt-4">Diese Person ist nicht mehr bei Leihregal.</p>
      </div>
    );
  }

  const own = viewer?.id === p.id;
  const shelf = await listVisibleShelf(p.id, viewer?.id ?? null);
  const level = trustLabel[p.trust_level] ?? "Neu";

  const stats: { n: string; label: string; note?: string }[] = [
    { n: String(p.lent), label: p.lent === 1 ? "Buch verliehen" : "Bücher verliehen" },
    { n: String(p.borrowed), label: p.borrowed === 1 ? "Buch geliehen" : "Bücher geliehen" },
    { n: p.punctual_pct == null ? "–" : `${p.punctual_pct} %`, label: "pünktlich zurückgegeben", note: p.punctual_pct == null ? "noch keine Rückgabe" : undefined },
  ];

  return (
    <div className="space-y-12 md:space-y-16">
      <header className="md:flex md:items-start md:justify-between md:gap-8">
        <div className="min-w-0">
          <p className="eyebrow">{[p.municipality, `Mitglied seit ${sinceFmt.format(new Date(p.member_since))}`].filter(Boolean).join(" · ")}</p>
          <h1 className="display text-5xl md:text-7xl mt-2 break-words">{p.first_name}</h1>
          <p className="mt-4 text-[17px]">
            Stufe <span className="font-medium">{level}</span>
            <span className="text-sm text-muted"> · {LEVEL_HINT[p.trust_level] ?? LEVEL_HINT[0]}</span>
          </p>
        </div>
        {own ? (
          <div className="mt-5 md:mt-0 flex flex-wrap items-center gap-3 flex-none md:self-end">
            <LinkButton href="/regal" variant="secondary">Mein Regal</LinkButton>
            <LinkButton href="/einstellungen" variant="ghost">Einstellungen</LinkButton>
          </div>
        ) : viewer ? (
          <div className="mt-4 md:mt-0 flex-none md:text-right"><ProfileActions userId={p.id} name={p.first_name} blocked={p.blocked_by_me} /></div>
        ) : null}
      </header>
      {p.blocked_by_me && !own && (
        <Notice className="-mt-6 md:-mt-10">Du hast {p.first_name} blockiert. {p.first_name} sieht dein Regal nicht und kann dich nicht anfragen.</Notice>
      )}

      <section aria-label="Zahlen">
        <dl className="grid grid-cols-3 border-y border-line divide-x divide-line">
          {stats.map((s, i) => (
            <div key={i} className="py-5 md:py-7 px-3 md:px-6 first:pl-0 flex flex-col-reverse justify-end">
              <dt className="text-sm text-muted mt-2 leading-snug">{s.label}{s.note && <span className="block text-xs mt-0.5">{s.note}</span>}</dt>
              <dd className="display text-4xl md:text-6xl tnum">{s.n}</dd>
            </div>
          ))}
        </dl>
        {(p.visible_losses > 0 || (!own && p.shared_circles.length > 0)) && (
          <div className="mt-3 text-sm text-muted space-y-1">
            {p.visible_losses > 0 && (
              <p>{p.visible_losses === 1 ? "1 Buch gilt als verloren." : `${p.visible_losses} Bücher gelten als verloren.`}</p>
            )}
            {!own && p.shared_circles.length > 0 && (
              <p>{p.shared_circles.length === 1 ? "Gemeinsamer Kreis" : "Gemeinsame Kreise"}: <span className="text-ink-2">{p.shared_circles.join(", ")}</span></p>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="regal">
        <SectionTitle aside={shelf.length > 0 && <span className="tnum">{shelf.length === 1 ? "1 Buch" : `${shelf.length} Bücher`}</span>}>
          <span id="regal">{own ? "Dein Regal, wie andere es sehen" : `Regal von ${p.first_name}`}</span>
        </SectionTitle>
        {shelf.length === 0 ? (
          own ? (
            <Empty text="In deinem Regal steht noch nichts, das andere sehen." action={<LinkButton href="/regal/neu" variant="primary">Buch einstellen</LinkButton>} />
          ) : (
            <p className="text-ink-2 py-6">{p.first_name} bietet gerade keine Bücher an, die du sehen kannst.</p>
          )
        ) : (
          <div className="space-y-10">
            {rows(shelf).map((row, r) => (
              <Shelf
                key={r}
                label={r === 0 ? `Regal von ${p.first_name}` : `Regal von ${p.first_name}, Reihe ${r + 1}`}
                items={row.map((c) => {
                  const st = shelfStatusText(c);
                  return {
                    id: c.id,
                    href: `/exemplar/${c.id}`,
                    cover: { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id },
                    caption: <span className="block min-h-[2.75em]">{c.title}</span>,
                    meta: <StatusText tone={st.tone} className="text-muted">{st.text}</StatusText>,
                  };
                })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
