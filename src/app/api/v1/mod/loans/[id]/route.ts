import { route } from "@/lib/api";
import { requireModerator } from "@/lib/auth/session";
import { loanDossier } from "@/lib/moderation";

export const GET = route<{ id: string }>(async (_req, p) => loanDossier(await requireModerator(), p.id));
