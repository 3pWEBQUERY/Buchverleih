import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listSpots } from "@/lib/copies";
import { EMAIL_CATEGORIES } from "@/lib/notify";
import { fmtDay } from "@/lib/dates";
import { trustLabel } from "@/lib/i18n/de-CH";
import { PageTitle, cx } from "@/components/ui";
import { StepSection } from "@/components/step-section";
import { Monogram } from "@/components/person/monogram";
import {
  AvatarEditor, BlockList, DeleteAccount, EmailPrefs, ExportData, Logout, PasskeyList, PhoneSection, ProfileForm, PushSettings, ShelfPause, SpotList, ThemeChoice,
} from "./sections";
import { SettingsNav, type NavGroup } from "./settings-nav";

export const metadata = { title: "Einstellungen" };

const NAV: NavGroup[] = [
  { title: "Konto", items: [{ id: "profilbild", label: "Profilbild" }, { id: "profil", label: "Profil" }, { id: "mobilnummer", label: "Mobilnummer" }, { id: "passkeys", label: "Passkeys" }] },
  { title: "Leihen", items: [{ id: "uebergabeorte", label: "Übergabeorte" }, { id: "ferienmodus", label: "Ferienmodus" }, { id: "blockiert", label: "Blockiert" }] },
  { title: "Allgemein", items: [{ id: "push", label: "Push" }, { id: "benachrichtigungen", label: "E-Mail" }, { id: "darstellung", label: "Darstellung" }, { id: "daten", label: "Daten" }] },
  { title: "Gefahrenzone", danger: true, items: [{ id: "konto-loeschen", label: "Konto löschen" }] },
];

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
    <div>
      <PageTitle eyebrow="Konto und Vorlieben" sub="Profil, Anmeldung, Übergabeorte und Benachrichtigungen. Änderungen gelten sofort."
        aside={
          <div className="rounded-[10px] border border-line flex items-center gap-3.5 pl-3 pr-5 py-3 anim-rise min-w-0 max-w-full" style={{ animationDelay: "60ms" }}>
            <Monogram name={user.first_name || "?"} seed={user.id} size={44} photo={user.avatar_key} />
            <span className="min-w-0 leading-tight">
              <span className="block font-medium truncate">{user.first_name} <span className="text-muted font-normal">· {trustLabel[user.trust_level]}</span></span>
              <span className="block text-[13px] text-muted truncate mt-0.5">{user.email}</span>
            </span>
          </div>
        }>
        Einstellungen.
      </PageTitle>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <SettingsNav groups={NAV} />

        <div className="min-w-0">
          <StepSection n={1} first title="Konto" desc="Was andere von dir sehen und wie du dich anmeldest.">
            <Card>
              <Row id="profilbild" label="Profilbild" text="Ein Bild von dir, freiwillig. Keine anderen Personen, keine Werbung.">
                <AvatarEditor userId={user.id} name={user.first_name} avatarKey={user.avatar_key} />
              </Row>
              <Row id="profil" label="Profil" text="Andere sehen deinen Vornamen und deine Gemeinde, nie deine Adresse.">
                <ProfileForm firstName={user.first_name} plz={user.plz ?? ""} municipality={user.municipality} />
              </Row>
              <Row id="mobilnummer" label="Mobilnummer" text="Nötig vor der ersten Anfrage. Eine Nummer, ein Konto. Andere Mitglieder sehen sie nie.">
                <PhoneSection phone={user.phone_e164} verifiedAt={user.phone_verified_at ? fmtDay(user.phone_verified_at) : null} />
              </Row>
              <Row id="passkeys" label="Passkeys" text="Melde dich mit Fingerabdruck, Gesicht oder Geräte-PIN an, ohne E-Mail-Link.">
                <PasskeyList passkeys={passkeys.map((p) => ({
                  id: p.id,
                  name: p.name,
                  created: fmtDay(p.created_at),
                  lastUsed: p.last_used_at ? fmtDay(p.last_used_at) : null,
                }))} />
              </Row>
            </Card>
          </StepSection>

          <StepSection n={2} title="Leihen" desc="Wo du Bücher übergibst und wer dich anfragen kann.">
            <Card>
              <Row id="uebergabeorte" label="Übergabeorte" text="Höchstens drei. Wer anfragt, sieht nur die Bezeichnung. Den genauen Ort zeigen wir erst nach deiner Annahme.">
                <SpotList spots={spots} />
              </Row>
              <Row id="ferienmodus" label="Ferienmodus" text="Dein Regal bleibt sichtbar, aber niemand kann anfragen. Laufende Leihen sind nicht betroffen.">
                <ShelfPause paused={user.shelf_paused} />
              </Row>
              <Row id="blockiert" label="Blockierte Personen" text="Blockierte Personen sehen dein Regal nicht und können dich nicht anfragen.">
                <BlockList blocks={blocks.map((b) => ({ id: b.blocked_id, name: b.first_name, since: fmtDay(b.created_at) }))} />
              </Row>
            </Card>
          </StepSection>

          <StepSection n={3} title="Allgemein" desc="Mitteilungen, Aussehen und deine Daten.">
            <Card>
              <Row id="push" label="Push-Mitteilungen" text="Neues sofort aufs Handy oder den Computer, auch wenn Leihregal geschlossen ist. Pro Gerät einzeln.">
                <PushSettings />
              </Row>
              <Row id="benachrichtigungen" label="E-Mail-Benachrichtigungen" text="In der App siehst du immer alles. Hier legst du fest, was zusätzlich per E-Mail kommt.">
                <EmailPrefs categories={categories} prefs={user.email_prefs ?? {}} />
              </Row>
              <Row id="darstellung" label="Darstellung" text="Hell, dunkel oder wie dein System. Gilt für diesen Browser.">
                <ThemeChoice />
              </Row>
              <Row id="daten" label="Datenexport" text="Alles, was wir zu dir gespeichert haben, als JSON-Datei.">
                <ExportData />
              </Row>
              <Row id="abmelden" label="Abmelden" text="Beendet die Sitzung auf diesem Gerät. Andere Geräte bleiben angemeldet.">
                <Logout />
              </Row>
            </Card>
          </StepSection>

          <StepSection id="konto-loeschen" n={4} title={<span className="text-late">Konto löschen</span>} desc="Möglich, sobald kein Vorgang mehr offen ist. Lässt sich nicht rückgängig machen.">
            <div className="rounded-[10px] border border-late/35 bg-late/[0.03] p-5 md:p-6">
              <DeleteAccount />
            </div>
          </StepSection>
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] border border-line divide-y divide-line">{children}</div>;
}

function Row({ id, label, text, children, className }: { id: string; label: string; text: string; children: ReactNode; className?: string }) {
  return (
    <div id={id} className={cx("scroll-mt-32 md:scroll-mt-20 lg:scroll-mt-10 p-5 md:p-6 2xl:grid 2xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] 2xl:gap-10", className)}>
      <div className="mb-4 2xl:mb-0">
        <h3 className="font-medium text-[15.5px]">{label}</h3>
        <p className="text-[13.5px] text-muted mt-1 leading-relaxed">{text}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
