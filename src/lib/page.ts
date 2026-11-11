import { redirect } from "next/navigation";
import { getUser, type SessionUser } from "@/lib/auth/session";

/** Für Seiten, die eine Anmeldung brauchen. Leitet sonst zur Anmeldung bzw. zum Profil. */
export async function pageUser(next: string): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect(`/anmelden?next=${encodeURIComponent(next)}`);
  if (u.banned_at) redirect("/gesperrt");
  if (!u.onboarded_at) redirect(`/willkommen?next=${encodeURIComponent(next)}`);
  return u;
}

export function origin(u: SessionUser | null) {
  return u?.home_lat != null && u.home_lng != null ? { lat: u.home_lat, lng: u.home_lng } : null;
}
