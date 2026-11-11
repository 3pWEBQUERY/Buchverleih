import { route } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

/** POST /api/v1/auth/logout */
export const POST = route(async () => {
  await destroySession();
  return { ok: true };
});
