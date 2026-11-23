import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { entitlements } from "@/lib/trust";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { shelfCsv } from "@/lib/stats";

/** GET /api/v1/copies/export – eigenes Regal als CSV (Fördermitglieder und Organisationen) */
export const GET = route(async () => {
  const u = await requireUser();
  if (!(await entitlements(sql, u.plan_id)).csv_export) throw err.forbidden("Der CSV-Export gehört zur Fördermitgliedschaft.");
  return new Response(await shelfCsv(u.id), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leihregal-regal.csv"` },
  });
});
