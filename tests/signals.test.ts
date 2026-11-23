/** Hinweise auf Mehrfachkonten: nur Hashes, gleiche Geräte und IPs werden gefunden. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { recordSignals, relatedAccounts } from "@/lib/signals";
import { makeUser, reset } from "./helpers";

beforeEach(async () => { await reset(); await sql`delete from account_signals`; });
afterAll(() => sql.end());

describe("Mehrfachkonten", () => {
  it("findet Konten mit gleichem Gerät oder gleicher IP und speichert nichts im Klartext", async () => {
    const a = await makeUser("Anna");
    const b = await makeUser("Ben");
    const c = await makeUser("Cara");
    await recordSignals(a.id, { ip: "203.0.113.5", device: "geraet-aaaaaaaaaaaaaaaa" });
    await recordSignals(b.id, { ip: "198.51.100.7", device: "geraet-aaaaaaaaaaaaaaaa" });
    await recordSignals(c.id, { ip: "203.0.113.5", device: "geraet-cccccccccccccccc" });
    const rel = await relatedAccounts(a.id);
    expect(rel.map((r) => [r.first_name, r.device, r.ip])).toEqual([["Ben", true, false], ["Cara", false, true]]);
    const raw = await sql<{ hash: string }[]>`select hash from account_signals`;
    expect(raw.every((r) => /^[0-9a-f]{64}$/.test(r.hash) && !r.hash.includes("203"))).toBe(true);
  });
});
