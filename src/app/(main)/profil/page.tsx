import { redirect } from "next/navigation";
import { pageUser } from "@/lib/page";

/** /profil führt auf das eigene Profil */
export default async function ProfilRedirect() {
  const user = await pageUser("/profil");
  redirect(`/profil/${user.id}`);
}
