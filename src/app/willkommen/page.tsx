import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getUser } from "@/lib/auth/session";
import { AuthStage } from "@/components/auth/stage";
import { Onboarding } from "./onboarding";
import { env } from "@/lib/env";
import { requirePhone } from "@/lib/trust";
import { getLocale } from "@/lib/i18n/server";
import { ONBOARDING } from "@/lib/i18n/messages/onboarding";

export async function generateMetadata() {
  return { title: ONBOARDING[await getLocale()].welcome.title };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext) || undefined;
  const u = await getUser();
  if (!u) redirect("/anmelden");
  const step = !u.onboarded_at ? "profile" : requirePhone() && !u.phone_verified_at ? "phone" : "done";
  if (step === "done") redirect(next || "/");
  const w = ONBOARDING[await getLocale()].welcome;
  return (
    <AuthStage eyebrow={w.eyebrow} title={<>{w.heading[0]}<em>{w.heading[1]}</em></>} lead={w.lead} steps={w.steps}>
      <Onboarding initialStep={step} next={next ?? "/"} firstName={u.first_name} devCodes={env.showCodes} />
    </AuthStage>
  );
}
