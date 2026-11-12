import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getUser } from "@/lib/auth/session";
import { AuthHead, AuthStage } from "@/components/auth/stage";
import { LoginForm } from "./login-form";
import { getLocale } from "@/lib/i18n/server";
import { PUBLIC } from "@/lib/i18n/messages/public";
import { SHELL } from "@/lib/i18n/messages/shell";
import { env } from "@/lib/env";

export async function generateMetadata() {
  return { title: SHELL[await getLocale()].publicNav.login };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext) || undefined;
  const u = await getUser();
  if (u?.onboarded_at) redirect(next || "/");
  if (u) redirect(`/willkommen${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const p = PUBLIC[await getLocale()];
  const a = p.auth;
  return (
    <AuthStage eyebrow={p.landing.beta} title={<>{a.title[0]}<em>{a.title[1]}</em></>} lead={a.lead}>
      <AuthHead eyebrow={a.headEyebrow} title={<>{a.headTitle[0]}<em>{a.headTitle[1]}</em></>}>
        {a.headText}
      </AuthHead>
      <LoginForm next={next ?? null} mailEnabled={Boolean(env.smtpUrl) || env.showCodes} />
    </AuthStage>
  );
}
