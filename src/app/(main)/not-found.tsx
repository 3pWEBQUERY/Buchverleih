import { LinkButton } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { COMMON } from "@/lib/i18n/messages/common";

/** 404 innerhalb der App (Buch, Vorgang, Kreis, Profil): ohne zweite Kopfzeile, in der normalen Hülle */
export default async function NotFound() {
  const t = COMMON[await getLocale()].notFound;
  return (
    <div className="max-w-2xl py-6 md:py-10">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="display text-[32px] md:text-[44px] mt-3">{t.heading[0]}<em>{t.heading[1]}</em></h1>
      <p className="text-ink-2 text-[16px] leading-relaxed mt-4 max-w-prose">{t.textApp}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        <LinkButton href="/" variant="primary">{t.home}</LinkButton>
        <LinkButton href="/suche" variant="secondary">{t.search}</LinkButton>
      </div>
    </div>
  );
}
