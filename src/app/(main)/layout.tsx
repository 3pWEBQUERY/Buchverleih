import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { AppShell, PublicShell } from "@/components/shell";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user || !user.onboarded_at) return <PublicShell>{children}</PublicShell>;
  const [n] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where user_id = ${user.id} and channel = 'app' and read_at is null`;
  return <AppShell user={user} unread={n.n}>{children}</AppShell>;
}
