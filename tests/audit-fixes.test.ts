/** Befunde aus der Prüfung vom November 2026: Storno nach Meldung, Weitergabe, Adressen, Rücksendung. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { loanView } from "@/lib/loans/queries";
import { day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(async () => { await reset(); await sql`update features set enabled = true`; });
afterAll(() => sql.end());

const ADDR = "Lea Muster\nBahnhofstrasse 1\n8180 Bülach";

describe("Prüfung November 2026", () => {
  it("lässt nach einer gemeldeten Übergabe kein Storno zu, nach einem Widerspruch wieder", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Faust", { shipping_allowed: true });
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14), delivery: "shipping", shipTo: ADDR });
    await svc.accept(marc, l.id, { returnTo: "Marc Beispiel\nDorfstrasse 2\n8180 Bülach" });
    await svc.reportHandover(marc, l.id, { tracking: "99.00.123456.12345678" });

    await expect(svc.cancel(lea, l.id)).rejects.toMatchObject({ status: 409 });
    await expect(svc.cancel(marc, l.id)).rejects.toMatchObject({ status: 409 });
    expect((await loanView(l.id, lea.id))!.actions).not.toContain("cancel");

    await svc.objectHandover(lea, l.id);
    await svc.cancel(lea, l.id);
    expect(await status(l.id)).toBe("cancelled");
  });

  it("zeigt die Lieferadresse nach einer Ablehnung nicht", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Faust", { shipping_allowed: true });
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14), delivery: "shipping", shipTo: ADDR });
    await svc.decline(marc, l.id);
    expect((await loanView(l.id, marc.id))!.shipping?.shipTo).toBeNull();
    expect((await loanView(l.id, lea.id))!.shipping?.shipTo).toBe(ADDR);
  });

  it("gibt Rücksendungen per Post ohne Sendungsnummer trotzdem 7 Tage Postweg", async () => {
    const { runDeadlines } = await import("@/worker/deadlines");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Faust", { shipping_allowed: true });
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14), delivery: "shipping", shipTo: ADDR });
    await svc.accept(marc, l.id, { returnTo: "Marc Beispiel\nDorfstrasse 2\n8180 Bülach" });
    await svc.reportHandover(marc, l.id, { tracking: "99.00.123456.12345678" });
    await svc.confirmHandover(lea, l.id);
    await svc.reportReturn(lea, l.id, {});
    await sql`update loans set return_reported_at = now() - interval '3 days' where id = ${l.id}`;
    await runDeadlines();
    expect(await status(l.id)).toBe("return_reported");
    await sql`update loans set return_reported_at = now() - interval '8 days' where id = ${l.id}`;
    await runDeadlines();
    expect(await status(l.id)).toBe("returned");
    // Nach Ablauf bleiben 48 h für eine Schadenmeldung
    const [r] = await sql<{ left: number }[]>`select extract(epoch from inspection_until - now())::int as left from loans where id = ${l.id}`;
    expect(r.left).toBeGreaterThan(47 * 3600);
  });

  it("lässt die leihende Person gleich nach der Rückgabe bewerten, sichtbar erst mit beiden", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Momo");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, l.id, {});
    await svc.reportHandover(lea, l.id, {});
    await svc.confirmHandover(marc, l.id);
    await svc.reportReturn(lea, l.id, {});
    await svc.confirmReturn(marc, l.id);
    expect(await status(l.id)).toBe("returned");
    expect((await loanView(l.id, lea.id))!.step?.key).toBe("rate");
    // Die verleihende Person prüft noch und darf erst nach dem Abschluss bewerten
    await expect(svc.rate(marc, l.id, { verdict: "good", reasons: [] })).rejects.toMatchObject({ status: 409 });
    await svc.rate(lea, l.id, { verdict: "good", reasons: [] });
    const [r] = await sql<{ visible: boolean }[]>`select visible_from <= now() as visible from ratings where loan_id = ${l.id}`;
    expect(r.visible).toBe(false);
    await svc.complete(marc, l.id);
    await svc.rate(marc, l.id, { verdict: "good", reasons: [] });
    const rows = await sql<{ visible: boolean }[]>`select visible_from <= now() as visible from ratings where loan_id = ${l.id}`;
    expect(rows.every((x) => x.visible)).toBe(true);
  });
});
