/** Versand ohne Etikett-API: Adresse, Sendungsnummer, Empfang, Rücksendung mit 7 Tagen Postweg. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(async () => { await reset(); await sql`update features set enabled = true`; });
afterAll(() => sql.end());

const ADDR = "Lea Muster\nBahnhofstrasse 1\n8180 Bülach";

describe("Versand", () => {
  it("läuft von der Anfrage bis zur Rücksendung", async () => {
    const { runDeadlines } = await import("@/worker/deadlines");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const noShip = await makeCopy(marc, "Momo");
    await expect(svc.requestLoan(lea, { copyId: noShip, kind: "lend", delivery: "shipping", shipTo: ADDR })).rejects.toMatchObject({ status: 422 });

    const copy = await makeCopy(marc, "Faust", { shipping_allowed: true });
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14), delivery: "shipping", shipTo: ADDR });
    await expect(svc.accept(marc, l.id, {})).rejects.toMatchObject({ status: 422 });
    await svc.accept(marc, l.id, { returnTo: "Marc Beispiel\nDorfstrasse 2\n8180 Bülach" });
    const [a] = await sql<{ handover_by: Date; wanted_start: string }[]>`select handover_by, lower(wanted)::text as wanted_start from loans where id = ${l.id}`;
    // 5 Tage mehr Zeit für den Postweg (8 + 5 Tage nach Beginn)
    expect(Math.round((a.handover_by.getTime() - new Date(a.wanted_start).getTime()) / 86400_000)).toBeGreaterThanOrEqual(12);

    await expect(svc.reportHandover(marc, l.id, {})).rejects.toMatchObject({ status: 422 });
    await svc.reportHandover(marc, l.id, { tracking: "99.00.123456.12345678" });
    const [h] = await sql<{ handover_method: string; tracking_out: string }[]>`select handover_method, tracking_out from loans where id = ${l.id}`;
    expect(h).toEqual({ handover_method: "shipping", tracking_out: "99.00.123456.12345678" });
    await svc.confirmHandover(lea, l.id);
    expect(await status(l.id)).toBe("active");

    await svc.reportReturn(lea, l.id, { tracking: "99.00.123456.87654321" });
    // Nach 3 Tagen ist die Rücksendung noch unterwegs, nach 8 Tagen gilt sie
    await sql`update loans set return_reported_at = now() - interval '3 days' where id = ${l.id}`;
    await runDeadlines();
    expect(await status(l.id)).toBe("return_reported");
    await sql`update loans set return_reported_at = now() - interval '8 days' where id = ${l.id}`;
    await runDeadlines();
    expect(["returned", "completed"]).toContain(await status(l.id));
  });
});
