import { StandaloneShell } from "@/components/auth/standalone";
import { LinkButton } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { SHELL } from "@/lib/i18n/messages/shell";
import { COMMON } from "@/lib/i18n/messages/common";

export async function generateMetadata() {
  return { title: COMMON[await getLocale()].notFound.title, robots: { index: false } };
}

/** 404: Seite, Buch, Vorgang oder Profil gibt es nicht (mehr) oder ist nicht sichtbar */
export default async function NotFound() {
  const t = COMMON[await getLocale()].notFound;
  return (
    <StandaloneShell homeLabel={SHELL[await getLocale()].home} motif={{ label: t.motif, gap: 6 }}>
      <div className="stagger">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="display text-display mt-4">{t.heading[0]}<em>{t.heading[1]}</em></h1>
      <p className="text-ink-2 text-lead leading-relaxed mt-6 max-w-prose">{t.text}</p>
      <div className="mt-9 flex flex-wrap gap-2">
        <LinkButton href="/" variant="primary" size="lg">{t.home}</LinkButton>
        <LinkButton href="/suche" variant="secondary" size="lg">{t.search}</LinkButton>
      </div>
      </div>
    </StandaloneShell>
  );
}
