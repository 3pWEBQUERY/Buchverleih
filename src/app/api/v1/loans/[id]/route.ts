import { getLocale } from "@/lib/i18n/server";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { loanView } from "@/lib/loans/queries";

/** GET /api/v1/loans/:id – Vorgang mit Status, nächstem Schritt, Fristen und Verlauf */
export const GET = route<{ id: string }>(async (_req, p) => ({ loan: await loanView(p.id, (await requireUser()).id, await getLocale()) }));
