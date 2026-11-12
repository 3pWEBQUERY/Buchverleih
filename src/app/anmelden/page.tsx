import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getUser } from "@/lib/auth/session";
import { AuthHead, AuthStage } from "@/components/auth/stage";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext) || undefined;
  const u = await getUser();
  if (u?.onboarded_at) redirect(next || "/");
  if (u) redirect(`/willkommen${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return (
    <AuthStage
      eyebrow="Beta in Zürich und im Zürcher Unterland"
      title={<>Das Regal der <em>Nachbarschaft.</em></>}
      lead="Leih, was andere gelesen haben, und verleih, was bei dir nur steht. Kostenlos, mit festen Fristen und einem Scan bei jeder Übergabe."
    >
      <AuthHead eyebrow="Anmelden oder Konto anlegen" title={<>Anmelden. <em>Ohne Passwort.</em></>}>
        Wir schicken dir einen Link, oder du nimmst deinen Passkey. Neu hier? Derselbe Weg legt dein Konto an.
      </AuthHead>
      <LoginForm next={next ?? null} />
    </AuthStage>
  );
}
