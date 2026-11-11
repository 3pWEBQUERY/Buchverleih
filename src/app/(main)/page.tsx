import { getUser } from "@/lib/auth/session";
import { Landing } from "./landing";
import { Home } from "./home";

export default async function Page() {
  const user = await getUser();
  if (!user || !user.onboarded_at) return <Landing />;
  return <Home user={user} />;
}
