import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listSpots } from "@/lib/copies";
import { EMAIL_CATEGORIES } from "@/lib/notify";
import { fmtDay } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import {
  AccountActions, BlockList, EmailPrefs, PasskeyList, PhoneSection, ProfileForm, ShelfPause, SpotList, ThemeChoice,
} from "./sections";

export const metadata = { title: "Einstellungen" };

export default async function Page() {
  const user = await pageUser("/einstellungen");
  const [spots, passkeys, blocks] = await Promise.all([
    listSpots(user.id),
    sql<{ id: string; name: string; created_at: Date; last_used_at: Date | null }[]>`
      select id, name, created_at, last_used_at from passkeys where user_id = ${user.id} order by created_at`,
    sql<{ blocked_id: string; first_name: string; created_at: Date }[]>`
      select b.blocked_id, u.first_name, b.created_at from blocks b join users u on u.id = b.blocked_id
       where b.blocker_id = ${user.id} order by b.created_at desc`,
  ]);
  const categories = Object.entries(EMAIL_CATEGORIES).map(([key, label]) => ({
    key,
    label: label.replace(/\s*\(immer aktiv\)/, ""),
    locked: key === "cases",
  }));

  return (
    <div className="max-w-4xl">
        <PageTitle sub={<>Angemeldet als {user.email}</>}>Einstellungen</PageTitle>

        <Section id="profil" title="Profil" text="Andere sehen deinen Vornamen und deine Gemeinde, nie deine Adresse.">
          <ProfileForm firstName={user.first_name} plz={user.plz ?? ""} municipality={user.municipality} />
        </Section>

        <Section id="mobilnummer" title="Mobilnummer" text="Nötig vor der ersten Anfrage. Eine Nummer, ein Konto. Andere Mitglieder sehen sie nie.">
          <PhoneSection
            phone={user.phone_e164}
            verifiedAt={user.phone_verified_at ? fmtDay(user.phone_verified_at) : null}
          />
        </Section>

        <Section id="passkeys" title="Passkeys" text="Melde dich mit Fingerabdruck, Gesicht oder Geräte-PIN an, ohne E-Mail-Link.">
          <PasskeyList passkeys={passkeys.map((p) => ({
            id: p.id,
            name: p.name,
            created: fmtDay(p.created_at),
            lastUsed: p.last_used_at ? fmtDay(p.last_used_at) : null,
          }))} />
        </Section>

        <Section id="uebergabeorte" title="Übergabeorte" text="Höchstens drei. Wer anfragt, sieht nur die Bezeichnung. Den genauen Ort zeigen wir erst nach deiner Annahme.">
          <SpotList spots={spots} />
        </Section>

        <Section id="ferienmodus" title="Ferienmodus" text="Dein Regal bleibt sichtbar, aber niemand kann anfragen. Laufende Leihen sind nicht betroffen.">
          <ShelfPause paused={user.shelf_paused} />
        </Section>

        <Section id="benachrichtigungen" title="E-Mail-Benachrichtigungen" text="In der App siehst du immer alles. Hier legst du fest, was zusätzlich per E-Mail kommt.">
          <EmailPrefs categories={categories} prefs={user.email_prefs ?? {}} />
        </Section>

        <Section id="blockiert" title="Blockierte Personen" text="Blockierte Personen sehen dein Regal nicht und können dich nicht anfragen.">
          <BlockList blocks={blocks.map((b) => ({ id: b.blocked_id, name: b.first_name, since: fmtDay(b.created_at) }))} />
        </Section>

        <Section id="darstellung" title="Darstellung" text="Gilt für diesen Browser.">
          <ThemeChoice />
        </Section>

        <Section id="daten" title="Daten und Konto" text="Lade alles herunter, was wir zu dir gespeichert haben, oder lösche dein Konto.">
          <AccountActions />
        </Section>
    </div>
  );
}

function Section({ id, title, text, children }: { id: string; title: string; text: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20 md:scroll-mt-10 border-t border-line py-8 md:py-10 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-14">
      <div className="mb-5 md:mb-0">
        <h2 id={`${id}-t`} className="text-xl md:text-2xl">{title}</h2>
        <p className="text-sm text-muted mt-1.5 max-w-prose">{text}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
