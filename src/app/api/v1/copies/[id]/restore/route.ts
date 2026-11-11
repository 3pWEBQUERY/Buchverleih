import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { restoreCopy } from "@/lib/copies";

export const POST = route<{ id: string }>(async (_req, p) => {
  await restoreCopy((await requireUser()).id, p.id);
  return { ok: true };
});
