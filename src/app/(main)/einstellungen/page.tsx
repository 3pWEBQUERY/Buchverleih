import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listSpots } from "@/lib/copies";
import { EMAIL_CATEGORIES } from "@/lib/notify";
import { fmtDay } from "@/lib/dates";
import { trustLabel } from "@/lib/i18n/de-CH";
import { cx } from "@/components/ui";
import {
  BlockList, DeleteAccount, EmailPrefs, ExportData, Logout, PasskeyList, PhoneSection, ProfileForm, ShelfPause, SpotList, ThemeChoice,
} from "./sections";
import { SettingsNav, type NavGroup } from "./settings-nav";

export const metadata = { title: "Einstellungen" };

const NAV: NavGroup[] = [
  { title: "Konto", items: [{ id: "profil", label: "Profil" }, { id: "mobilnummer", label: "Mobilnummer" }, { id: "passkeys", label: "Passkeys" }] },
  { title: "Leihen", items: [{ id: "uebergabeorte", label: "Übergabeorte" }, { id: "ferienmodus", label: "Ferienmodus" }, { id: "blockiert", label: "Blockiert" }] },
  { title: "Allgemein", items: [{ id: "benachrichtigungen", label: "E-Mail" }, { id: "darstellung", label: "Darstellung" }, { id: "daten", label: "Daten" }] },
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
  const initial = (user.first_name || "?").slice(0, 1).toUpperCase();

  return (
    <div>
      <header className="mb-10 md:mb-14 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 anim-rise">
          <p className="eyebrow">Konto und Vorlieben</p>
          <h1 className="display text-[52px] md:text-[84px] mt-3">Einstellungen</h1>
        </div>
        <div className="panel-quiet flex items-center gap-3.5 pl-3 pr-5 py-3 rounded-[6px] anim-rise min-w-0 max-w-full" style={{ animationDelay: "60ms" }}>
          <span className="h-11 w-11 flex-none rounded-full bg-ink text-paper grid place-items-center font-semibold text-[22px]">{initial}</span>
          <span className="min-w-0 leading-tight">
            <span className="block font-semibold truncate">{user.first_name} · {trustLabel[user.trust_level]}</span>
            <span className="block text-[13px] text-muted truncate">{user.email}</span>
          </span>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <SettingsNav groups={NAV} />

        <div className="space-y-12 md:space-y-14 min-w-0">
          <Group title="Konto" text="Was andere von dir sehen und wie du dich anmeldest.">
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
          </Group>

          <Group title="Leihen" text="Wo du Bücher übergibst und wer dich anfragen kann.">
            <Row id="uebergabeorte" label="Übergabeorte" text="Höchstens drei. Wer anfragt, sieht nur die Bezeichnung. Den genauen Ort zeigen wir erst nach deiner Annahme.">
              <SpotList spots={spots} />
            </Row>
            <Row id="ferienmodus" label="Ferienmodus" text="Dein Regal bleibt sichtbar, aber niemand kann anfragen. Laufende Leihen sind nicht betroffen.">
              <ShelfPause paused={user.shelf_paused} />
            </Row>
            <Row id="blockiert" label="Blockierte Personen" text="Blockierte Personen sehen dein Regal nicht und können dich nicht anfragen.">
              <BlockList blocks={blocks.map((b) => ({ id: b.blocked_id, name: b.first_name, since: fmtDay(b.created_at) }))} />
            </Row>
          </Group>

          <Group title="Allgemein" text="Mitteilungen, Aussehen und deine Daten.">
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
          </Group>

          <section id="konto-loeschen" aria-labelledby="konto-loeschen-t" className="scroll-mt-32 md:scroll-mt-20 lg:scroll-mt-10 rounded-[8px] border border-late/35 bg-late/[0.04] p-5 md:p-7 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
            <div className="mb-5 md:mb-0">
              <p className="eyebrow !text-late">Gefahrenzone</p>
              <h2 id="konto-loeschen-t" className="ui-title text-[18px] mt-2">Konto löschen</h2>
              <p className="text-sm text-muted mt-1.5">Möglich, sobald kein Vorgang mehr offen ist. Lässt sich nicht rückgängig machen.</p>
            </div>
            <DeleteAccount />
          </section>
        </div>
      </div>
    </div>
  );
}

function Group({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="anim-rise">
      <div className="mb-4 md:mb-5">
        <h2 className="ui-title text-[22px] md:text-[26px]">{title}</h2>
        <p className="text-[15px] text-muted mt-1">{text}</p>
      </div>
      <div className="panel rounded-[8px] divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ id, label, text, children, className }: { id: string; label: string; text: string; children: ReactNode; className?: string }) {
  return (
    <div id={id} className={cx("scroll-mt-32 md:scroll-mt-20 lg:scroll-mt-10 p-5 md:p-7 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10", className)}>
      <div className="mb-5 md:mb-0">
        <h3 className="ui-title text-[16px]">{label}</h3>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">{text}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
