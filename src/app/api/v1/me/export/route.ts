import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { exportData } from "@/lib/account";

/** GET /api/v1/me/export – Datenexport als JSON-Datei */
export const GET = route(async () => {
  const u = await requireUser();
  const data = await exportData(u.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="leihregal-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
