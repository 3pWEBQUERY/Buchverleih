/** Regalstatistik, CSV-Export und Erscheinungsbild für Organisationen. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemToken } from "@/lib/loans/handover";
import { shelfCsv, shelfStats } from "@/lib/stats";
import { createCircle, updateCircle } from "@/lib/circles";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("Auswertungen", () => {
  it("zählt übergebene Leihen pro Buch und Monat", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "=HYPERLINK(\"x\")");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, l.id, {});
    await redeemToken(lea, (await createToken(marc, l.id)).token);
    const s = await shelfStats(marc.id);
    expect(s.totals).toMatchObject({ loans: 1, lent_now: 1, borrowers: 1 });
    expect(s.byMonth).toHaveLength(12);
    expect(s.byMonth.at(-1)!.n).toBe(1);
    expect(s.books[0].loans).toBe(1);
    // CSV: Formeln werden entschärft, Excel-tauglich mit BOM und Semikolon
    const csv = await shelfCsv(marc.id);
    expect(csv.startsWith("﻿\"Titel\";")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("Farbe und Logo nur für Organisationen", async () => {
    const anna = await makeUser("Anna");
    const id = await createCircle(anna.id, { name: "Verein" });
    await expect(updateCircle(anna.id, id, { brandColor: "#22324a" })).rejects.toMatchObject({ status: 403 });
    await sql`update circles set plan_id = 'organization' where id = ${id}`;
    await updateCircle(anna.id, id, { brandColor: "#22324a" });
    await expect(updateCircle(anna.id, id, { brandColor: "#ff00ff" })).rejects.toMatchObject({ status: 422 });
    const [c] = await sql<{ brand_color: string }[]>`select brand_color from circles where id = ${id}`;
    expect(c.brand_color).toBe("#22324a");
  });
});
