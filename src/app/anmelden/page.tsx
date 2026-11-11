import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const u = await getUser();
  if (u?.onboarded_at) redirect(next && next.startsWith("/") ? next : "/");
  if (u) redirect(`/willkommen${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return (
    <div className="max-w-md mx-auto md:mx-0 md:ml-[8.33%] pt-4 md:pt-10">
      <h1 className="display text-5xl md:text-6xl">Anmelden</h1>
      <p className="text-ink-2 mt-4 mb-10">Ohne Passwort. Wir schicken dir einen Link, oder du nimmst deinen Passkey. Neu hier? Derselbe Weg legt dein Konto an.</p>
      <LoginForm next={next ?? null} />
    </div>
  );
}
