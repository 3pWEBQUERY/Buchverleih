import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { StandaloneShell } from "@/components/auth/standalone";
import { LinkButton } from "@/components/ui";
import { LogoutButton } from "./logout";
import { getLocale } from "@/lib/i18n/server";
import { ONBOARDING } from "@/lib/i18n/messages/onboarding";

export async function generateMetadata() {
  return { title: ONBOARDING[await getLocale()].banned.title, robots: { index: false } };
}

/** Eigene schlichte Seite ohne App-Navigation (pageUser leitet gesperrte Konten hierher). */
export default async function Page() {
  const user = await getUser();
  if (user && !user.banned_at) redirect("/");
  const [row] = user
    ? await sql<{ ban_reason: string | null }[]>`select ban_reason from users where id = ${user.id}`
    : [];
  const reason = row?.ban_reason?.trim() || null;
  const t = ONBOARDING[await getLocale()].banned;

  return (
    <StandaloneShell motif={{ label: t.motif, gap: 5 }}>
      <p className="eyebrow anim-rise">{t.eyebrow}</p>
      <h1 className="display text-[32px] md:text-[44px] mt-4 anim-rise" style={{ animationDelay: "40ms" }}>{t.heading[0]}<em>{t.heading[1]}</em></h1>
      {reason && (
        <div className="mt-8 rounded-[8px] bg-late/[0.06] border-l-[3px] border-late px-5 py-4 anim-rise" style={{ animationDelay: "80ms" }}>
          <p className="eyebrow !text-late">{t.reason}</p>
          <p className="text-[17px] mt-1.5">{reason}</p>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-4 text-[16px] md:text-[17px] leading-relaxed text-ink-2 max-w-prose anim-rise" style={{ animationDelay: "120ms" }}>
        <p>{t.p1}</p>
        <p>{t.p2}</p>
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-2 anim-rise" style={{ animationDelay: "160ms" }}>
        {user && <LogoutButton label={t.logout} />}
        <LinkButton href="/regeln" variant="ghost" size="sm">{t.rules}</LinkButton>
        <LinkButton href="/nutzungsbedingungen" variant="ghost" size="sm">{t.terms}</LinkButton>
        <LinkButton href="/datenschutz" variant="ghost" size="sm">{t.privacy}</LinkButton>
      </div>
    </StandaloneShell>
  );
}
