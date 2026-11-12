import type { ReactNode } from "react";
import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { listSpots } from "@/lib/copies";
import { EMAIL_CATEGORIES } from "@/lib/notify";
import { fmtDay } from "@/lib/dates";
import { labels } from "@/lib/i18n/labels";
import { SETTINGS } from "@/lib/i18n/messages/settings";
import type { Locale } from "@/lib/i18n/locale";
import { PageTitle, cx } from "@/components/ui";
import { StepSection } from "@/components/step-section";
import { Monogram } from "@/components/person/monogram";
import {
  AvatarEditor, BlockList, DeleteAccount, EmailPrefs, ExportData, Logout, PasskeyList, PasswordSection, PhoneSection, ProfileForm, PushSettings, ShelfPause, SpotList, ThemeChoice,
} from "./sections";
import { SettingsNav, type NavGroup } from "./settings-nav";
import { LanguageChoice } from "@/components/language-switch";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: SETTINGS[await getLocale()].title };
}

function nav(l: Locale): NavGroup[] {
  const g = SETTINGS[l].groups;
  const n = SETTINGS[l].nav;
  const items = (ids: (keyof typeof n)[]) => ids.map((id) => ({ id, label: n[id] }));
  return [
    { title: g.account, items: items(["profilbild", "profil", "mobilnummer", "passwort", "passkeys"]) },
    { title: g.lending, items: items(["uebergabeorte", "ferienmodus", "blockiert"]) },
    { title: g.general, items: items(["sprache", "push", "benachrichtigungen", "darstellung", "daten"]) },
    { title: g.danger, danger: true, items: [{ id: "konto-loeschen", label: n.kontoLoeschen }] },
  ];
}

export default async function Page() {
  const user = await pageUser("/einstellungen");
  const l = await getLocale();
  const m = SETTINGS[l];
  const r = m.rows;
  const [spots, passkeys, blocks, [pw]] = await Promise.all([
    listSpots(user.id),
    sql<{ id: string; name: string; created_at: Date; last_used_at: Date | null }[]>`
      select id, name, created_at, last_used_at from passkeys where user_id = ${user.id} order by created_at`,
    sql<{ blocked_id: string; first_name: string; created_at: Date }[]>`
      select b.blocked_id, u.first_name, b.created_at from blocks b join users u on u.id = b.blocked_id
       where b.blocker_id = ${user.id} order by b.created_at desc`,
    sql<{ has: boolean }[]>`select password_hash is not null as has from users where id = ${user.id}`,
  ]);
  const hasPassword = Boolean(pw?.has);
  const categories = Object.keys(EMAIL_CATEGORIES).map((key) => ({
    key,
    label: m.emailCategories[key] ?? key,
    locked: key === "cases",
  }));

  return (
    <div>
      <PageTitle eyebrow={m.eyebrow} sub={m.sub}
        aside={
          <div className="rounded-[10px] border border-line flex items-center gap-3.5 pl-3 pr-5 py-3 anim-rise min-w-0 max-w-full" style={{ animationDelay: "60ms" }}>
            <Monogram name={user.first_name || "?"} seed={user.id} size={44} photo={user.avatar_key} />
            <span className="min-w-0 leading-tight">
              <span className="block font-medium truncate">{user.first_name} <span className="text-muted font-normal">· {labels(l).trustLabel[user.trust_level]}</span></span>
              <span className="block text-[13px] text-muted truncate mt-0.5">{user.email}</span>
            </span>
          </div>
        }>
        {m.heading}
      </PageTitle>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <SettingsNav groups={nav(l)} label={m.sectionsAria} />

        <div className="min-w-0">
          <StepSection n={1} first title={m.account.title} desc={m.account.desc}>
            <Card>
              <Row id="profilbild" t={r.profilbild}>
                <AvatarEditor userId={user.id} name={user.first_name} avatarKey={user.avatar_key} />
              </Row>
              <Row id="profil" t={r.profil}>
                <ProfileForm firstName={user.first_name} plz={user.plz ?? ""} municipality={user.municipality} />
              </Row>
              <Row id="mobilnummer" t={r.mobilnummer}>
                <PhoneSection phone={user.phone_e164} verifiedAt={user.phone_verified_at ? fmtDay(user.phone_verified_at, l) : null} />
              </Row>
              <Row id="passwort" t={r.passwort}>
                <PasswordSection hasPassword={hasPassword} />
              </Row>
              <Row id="passkeys" t={r.passkeys}>
                <PasskeyList passkeys={passkeys.map((p) => ({
                  id: p.id,
                  name: p.name,
                  created: fmtDay(p.created_at, l),
                  lastUsed: p.last_used_at ? fmtDay(p.last_used_at, l) : null,
                }))} />
              </Row>
            </Card>
          </StepSection>

          <StepSection n={2} title={m.lending.title} desc={m.lending.desc}>
            <Card>
              <Row id="uebergabeorte" t={r.uebergabeorte}>
                <SpotList spots={spots} />
              </Row>
              <Row id="ferienmodus" t={r.ferienmodus}>
                <ShelfPause paused={user.shelf_paused} />
              </Row>
              <Row id="blockiert" t={r.blockiert}>
                <BlockList blocks={blocks.map((b) => ({ id: b.blocked_id, name: b.first_name, since: fmtDay(b.created_at, l) }))} />
              </Row>
            </Card>
          </StepSection>

          <StepSection n={3} title={m.general.title} desc={m.general.desc}>
            <Card>
              <Row id="sprache" t={r.sprache}>
                <LanguageChoice />
              </Row>
              <Row id="push" t={r.push}>
                <PushSettings />
              </Row>
              <Row id="benachrichtigungen" t={r.benachrichtigungen}>
                <EmailPrefs categories={categories} prefs={user.email_prefs ?? {}} />
              </Row>
              <Row id="darstellung" t={r.darstellung}>
                <ThemeChoice />
              </Row>
              <Row id="daten" t={r.daten}>
                <ExportData />
              </Row>
              <Row id="abmelden" t={r.abmelden}>
                <Logout />
              </Row>
            </Card>
          </StepSection>

          <StepSection id="konto-loeschen" n={4} title={<span className="text-late">{m.danger.title}</span>} desc={m.danger.desc}>
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

function Row({ id, t: [label, text], children, className }: { id: string; t: [string, string]; children: ReactNode; className?: string }) {
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
