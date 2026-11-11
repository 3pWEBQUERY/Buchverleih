import { route } from "@/lib/api";
import { requireModerator } from "@/lib/auth/session";
import { userDossier } from "@/lib/moderation";

export const GET = route<{ id: string }>(async (_req, p) => {
  await requireModerator();
  return userDossier(p.id);
});
