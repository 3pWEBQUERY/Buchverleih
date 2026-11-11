import { z } from "zod";
import { body, isoDay, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { requestLoan } from "@/lib/loans/service";
import { myLoans } from "@/lib/loans/queries";

/** GET /api/v1/loans – meine Vorgänge, sortiert nach Handlungsbedarf */
export const GET = route(async () => ({ loans: await myLoans((await requireUser()).id) }));

/** POST /api/v1/loans – Anfrage stellen (Leihe für einen Zeitraum, Tausch oder Geschenk) */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(
    req,
    z.object({
      copyId: z.string().uuid(),
      kind: z.enum(["lend", "swap", "gift"]).default("lend"),
      start: isoDay.optional(),
      end: isoDay.optional(),
      message: z.string().max(500).optional(),
      swapOfferedCopyIds: z.array(z.string().uuid()).max(5).optional(),
    }),
  );
  const loan = await requestLoan(u, b);
  return { id: loan.id, status: loan.status };
});
