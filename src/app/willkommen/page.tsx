import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { Onboarding } from "./onboarding";
import { env } from "@/lib/env";
import { requirePhone } from "@/lib/trust";

export const metadata = { title: "Willkommen" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const u = await getUser();
  if (!u) redirect("/anmelden");
  const step = !u.onboarded_at ? "profile" : requirePhone() && !u.phone_verified_at ? "phone" : "done";
  if (step === "done") redirect(next && next.startsWith("/") ? next : "/");
  return (
    <div className="max-w-lg md:ml-[8.33%] pt-4 md:pt-8">
      <Onboarding initialStep={step} next={next ?? "/"} firstName={u.first_name} devCodes={env.showCodes} />
    </div>
  );
}
