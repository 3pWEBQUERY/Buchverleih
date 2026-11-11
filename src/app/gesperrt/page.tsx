import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { Wordmark } from "@/components/shell";
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
    <div className="min-h-dvh flex flex-col px-4 md:px-10">
      <header className="h-16 flex items-center border-b border-line -mx-4 px-4 md:-mx-10 md:px-10">
        <Wordmark />
      </header>
      <main id="inhalt" className="flex-1 w-full max-w-xl mx-auto py-16 md:py-24">
        <p className="eyebrow">Konto</p>
        <h1 className="display text-4xl md:text-6xl mt-3">Dein Konto ist gesperrt</h1>
        {reason && (
          <div className="mt-8 border-y border-line py-4">
            <p className="text-sm text-muted">Grund</p>
            <p className="text-[17px] mt-1">{reason}</p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-4 text-[16px] leading-relaxed text-ink-2 max-w-prose">
          <p>Du kannst keine Bücher leihen, verleihen oder tauschen und keine Nachrichten schreiben. Dein Regal ist für andere nicht mehr sichtbar.</p>
          <p>
            Hältst du die Sperre für falsch, antworte auf die E-Mail, mit der wir sie dir mitgeteilt haben.
            Die Moderation liest jede Antwort und meldet sich bei dir.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link href="/regeln" className="underline">Regeln</Link>
          <Link href="/nutzungsbedingungen" className="underline">Nutzungsbedingungen</Link>
          <Link href="/datenschutz" className="underline">Datenschutz</Link>
          {user && <LogoutButton />}
        </div>
      </main>
    </div>
  );
}
