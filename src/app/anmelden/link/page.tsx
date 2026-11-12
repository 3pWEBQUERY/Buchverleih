import { AuthHead, AuthStage } from "@/components/auth/stage";
import { safeNext } from "@/lib/safe-next";
import { VerifyLink } from "./verify";

export const metadata = { title: "Anmelden" };

/** Der Link wird erst per Knopfdruck eingelöst, damit Vorschauen von Mailprogrammen ihn nicht verbrauchen. */
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token, next: rawNext } = await searchParams;
  const next = safeNext(rawNext) || null;
  return (
    <AuthStage
      eyebrow="Anmeldelink"
      title={<>Schön, dass du <em>da bist.</em></>}
      lead="Der Link aus deiner E-Mail gilt 20 Minuten und nur einmal. Erst dein Tipp löst ihn ein – so verbraucht ihn keine Vorschau im Mailprogramm."
    >
      <AuthHead eyebrow="Fast geschafft" title={<>Willkommen <em>zurück.</em></>} />
      <VerifyLink token={token ?? ""} next={next ?? null} />
    </AuthStage>
  );
}
