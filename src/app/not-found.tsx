import { StandaloneShell } from "@/components/auth/standalone";
import { LinkButton } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { COMMON } from "@/lib/i18n/messages/common";

export async function generateMetadata() {
  return { title: COMMON[await getLocale()].notFound.title, robots: { index: false } };
}

/** 404: Seite, Buch, Vorgang oder Profil gibt es nicht (mehr) oder ist nicht sichtbar */
export default async function NotFound() {
  const t = COMMON[await getLocale()].notFound;
  return (
    <StandaloneShell motif={{ label: t.motif, gap: 6 }}>
      <p className="eyebrow anim-rise">{t.eyebrow}</p>
      <h1 className="display text-[32px] md:text-[44px] mt-4 anim-rise" style={{ animationDelay: "40ms" }}>{t.heading[0]}<em>{t.heading[1]}</em></h1>
      <p className="text-ink-2 text-[17px] md:text-[19px] leading-relaxed mt-6 max-w-prose anim-rise" style={{ animationDelay: "80ms" }}>{t.text}</p>
      <div className="mt-9 flex flex-wrap gap-2 anim-rise" style={{ animationDelay: "120ms" }}>
        <LinkButton href="/" variant="primary" size="lg">{t.home}</LinkButton>
        <LinkButton href="/suche" variant="secondary" size="lg">{t.search}</LinkButton>
      </div>
    </StandaloneShell>
  );
}
