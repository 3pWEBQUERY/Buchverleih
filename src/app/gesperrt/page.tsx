import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { StandaloneShell } from "@/components/auth/standalone";
import { LinkButton } from "@/components/ui";
import { LogoutButton } from "./logout";

export const metadata = { title: "Konto gesperrt", robots: { index: false } };

/** Eigene schlichte Seite ohne App-Navigation (pageUser leitet gesperrte Konten hierher). */
export default async function Page() {
  const user = await getUser();
  if (user && !user.banned_at) redirect("/");
  const [row] = user
    ? await sql<{ ban_reason: string | null }[]>`select ban_reason from users where id = ${user.id}`
    : [];
  const reason = row?.ban_reason?.trim() || null;

  return (
    <StandaloneShell motif={{ label: "Regal ausgeblendet", gap: 5 }}>
      <p className="eyebrow anim-rise">Konto</p>
      <h1 className="display text-[52px] md:text-[84px] mt-4 anim-rise" style={{ animationDelay: "40ms" }}>Dein Konto ist <em>gesperrt.</em></h1>
      {reason && (
        <div className="mt-8 rounded-[8px] bg-late/[0.06] border-l-[3px] border-late px-5 py-4 anim-rise" style={{ animationDelay: "80ms" }}>
          <p className="eyebrow !text-late">Grund</p>
          <p className="text-[17px] mt-1.5">{reason}</p>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-4 text-[16px] md:text-[17px] leading-relaxed text-ink-2 max-w-prose anim-rise" style={{ animationDelay: "120ms" }}>
        <p>Du kannst keine Bücher leihen, verleihen oder tauschen und keine Nachrichten schreiben. Dein Regal ist für andere nicht mehr sichtbar.</p>
        <p>
          Hältst du die Sperre für falsch, antworte auf die E-Mail, mit der wir sie dir mitgeteilt haben.
          Die Moderation liest jede Antwort und meldet sich bei dir.
        </p>
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-2 anim-rise" style={{ animationDelay: "160ms" }}>
        {user && <LogoutButton />}
        <LinkButton href="/regeln" variant="ghost" size="sm">Regeln</LinkButton>
        <LinkButton href="/nutzungsbedingungen" variant="ghost" size="sm">Nutzungsbedingungen</LinkButton>
        <LinkButton href="/datenschutz" variant="ghost" size="sm">Datenschutz</LinkButton>
      </div>
    </StandaloneShell>
  );
}
