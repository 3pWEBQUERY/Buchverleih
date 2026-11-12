import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getUser } from "@/lib/auth/session";
import { AuthStage } from "@/components/auth/stage";
import { Onboarding } from "./onboarding";
import { env } from "@/lib/env";
import { requirePhone } from "@/lib/trust";

export const metadata = { title: "Willkommen" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext) || undefined;
  const u = await getUser();
  if (!u) redirect("/anmelden");
  const step = !u.onboarded_at ? "profile" : requirePhone() && !u.phone_verified_at ? "phone" : "done";
  if (step === "done") redirect(next || "/");
  return (
    <AuthStage
      eyebrow="Konto einrichten"
      title={<>Zwei Schritte, dann <em>leihst du.</em></>}
      lead="Danach siehst du, was in den Regalen rund um dich steht, und kannst selbst verleihen. Das Einrichten dauert keine zwei Minuten."
      steps={[
        ["Profil", "Vorname, Postleitzahl und Bestätigung, dass du mindestens 16 bist."],
        ["Mobilnummer", "Eine Nummer, ein Konto. Andere Mitglieder sehen sie nie."],
        ["Loslegen", "Bücher in der Nähe anfragen oder das erste eigene Buch erfassen."],
      ]}
    >
      <Onboarding initialStep={step} next={next ?? "/"} firstName={u.first_name} devCodes={env.showCodes} />
    </AuthStage>
  );
}
