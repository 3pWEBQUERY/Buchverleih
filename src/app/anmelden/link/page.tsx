import { AuthHead, AuthStage } from "@/components/auth/stage";
import { safeNext } from "@/lib/safe-next";
import { VerifyLink } from "./verify";
import { getLocale } from "@/lib/i18n/server";
import { ONBOARDING } from "@/lib/i18n/messages/onboarding";

export async function generateMetadata() {
  return { title: ONBOARDING[await getLocale()].link.title };
}

/** Der Link wird erst per Knopfdruck eingelöst, damit Vorschauen von Mailprogrammen ihn nicht verbrauchen. */
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token, next: rawNext } = await searchParams;
  const next = safeNext(rawNext) || null;
  const t = ONBOARDING[await getLocale()].link;
  return (
    <AuthStage eyebrow={t.eyebrow} title={<>{t.heading[0]}<em>{t.heading[1]}</em></>} lead={t.lead}>
      <AuthHead eyebrow={t.headEyebrow} title={<>{t.headTitle[0]}<em>{t.headTitle[1]}</em></>} />
      <VerifyLink token={token ?? ""} next={next ?? null} />
    </AuthStage>
  );
}
