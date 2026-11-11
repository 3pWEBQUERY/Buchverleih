import { route } from "@/lib/api";
import { destroySession, requireUser } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/account";

/** POST /api/v1/me/delete – Konto löschen (nur ohne offene Vorgänge) */
export const POST = route(async () => {
  const u = await requireUser();
  await deleteAccount(u.id);
  await destroySession();
  return { ok: true };
});
