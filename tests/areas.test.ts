/** Freigabe nach Gebiet: die genaueste Regel gilt (Gemeinde vor Bezirk vor Kanton), ohne Regel geschlossen. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { areasOverview, setAreaRule } from "@/lib/areas";
import { plzInfo } from "@/lib/account";
import { makeUser, reset } from "./helpers";

const open = async (plz: string) => (await plzInfo(plz))?.enabled ?? false;

afterAll(async () => { await sql.end(); });

describe("Freigabe nach Gebiet", () => {
  beforeEach(async () => { await reset(); await sql`delete from area_openings`; });

  it("kennt alle Kantone, Bezirke, Gemeinden und Postleitzahlen", async () => {
    const [n] = await sql<{ k: number; d: number; c: number; p: number }[]>`
      select (select count(*)::int from geo_cantons) as k, (select count(*)::int from geo_districts) as d,
             (select count(*)::int from geo_communes) as c, (select count(*)::int from postal_codes where bfs_nr is not null) as p`;
    expect(n.k).toBe(27); // 26 Kantone und Liechtenstein
    expect(n.d).toBeGreaterThan(100);
    expect(n.c).toBeGreaterThan(2000);
    expect(n.p).toBeGreaterThan(3000);
    const p = await plzInfo("8180");
    expect(p?.municipality).toBe("Bülach");
  });

  it("Gemeinde vor Bezirk vor Kanton; ohne Regel geschlossen", async () => {
    const admin = await makeUser("Admin");
    await sql`update users set role = 'admin' where id = ${admin.id}`;
    const a = { ...admin, role: "admin" as const };
    expect(await open("8180")).toBe(false);
    await setAreaRule(a, "canton", "ZH", true);
    expect(await open("8180")).toBe(true);
    expect(await open("8001")).toBe(true);
    // Bezirk Bülach zu, Gemeinde Bülach (BFS 53) wieder offen
    const [d] = await sql<{ district_id: number }[]>`select district_id from geo_communes where bfs = 53`;
    await setAreaRule(a, "district", String(d.district_id), false);
    expect(await open("8180")).toBe(false);
    expect(await open("8001")).toBe(true);
    await setAreaRule(a, "commune", "53", true);
    expect(await open("8180")).toBe(true);
    // Ausnahmen im Kanton entfernen: alles folgt wieder dem Kanton
    await setAreaRule(a, "canton", "ZH", false, true);
    expect(await open("8180")).toBe(false);
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from area_openings`;
    expect(r.n).toBe(1);
  });

  it("nur Admins schalten, unbekannte Gebiete werden abgelehnt", async () => {
    const mod = await makeUser("Mod");
    await expect(setAreaRule({ ...mod, role: "moderator" }, "canton", "BE", true)).rejects.toMatchObject({ status: 403 });
    await expect(setAreaRule({ ...mod, role: "admin" }, "canton", "XX", true)).rejects.toMatchObject({ status: 404 });
  });

  it("die Übersicht zählt offene Gemeinden pro Kanton", async () => {
    const admin = await makeUser("Admin");
    await setAreaRule({ ...admin, role: "admin" }, "commune", "53", true);
    const o = await areasOverview();
    const zh = o.cantons.find((k) => k.code === "ZH")!;
    expect(zh.open).toBe(1);
    expect(zh.communes.find((c) => c.bfs === 53)?.open).toBe(true);
    expect(o.totals.communesOpen).toBe(1);
  });
});

describe("Warteliste", () => {
  beforeEach(async () => { await reset(); await sql`delete from area_openings`; await sql`delete from plz_waitlist`; });

  it("geschlossene PLZ: Profil scheitert, Person steht automatisch auf der Warteliste", async () => {
    const { completeProfile } = await import("@/lib/account");
    const u = await makeUser("Basel");
    await sql`update users set onboarded_at = null, locale = 'fr' where id = ${u.id}`;
    await expect(completeProfile(u.id, { firstName: "Bea", plz: "4051", birthDate: "1990-01-01" })).rejects.toMatchObject({ code: "region_closed" });
    const [w] = await sql<{ plz: string; locale: string }[]>`select plz, locale from plz_waitlist where email = ${u.email}`;
    expect(w).toEqual({ plz: "4051", locale: "fr" });
  });

  it("nach der Öffnung genau eine Nachricht, erst wenn die Freigabe steht; fertige Konten bekommen keine", async () => {
    const admin = { ...(await makeUser("Admin")), role: "admin" as const };
    const { joinWaitlist } = await import("@/lib/account");
    const { notifyOpenedWaitlist } = await import("@/lib/areas");
    await joinWaitlist("warte@test.ch", "4051", "de");
    await joinWaitlist("warte@test.ch", "4052", "de");
    expect((await notifyOpenedWaitlist()).handled).toBe(0); // noch geschlossen
    await setAreaRule(admin, "canton", "BS", true);
    expect((await notifyOpenedWaitlist()).handled).toBe(0); // eben erst geöffnet: Schonfrist für «Rückgängig»
    await sql`update area_openings set updated_at = now() - interval '11 minutes'`;
    const r = await notifyOpenedWaitlist();
    expect(r).toEqual({ sent: 1, handled: 1 }); // zwei PLZ derselben Gemeinde: eine E-Mail
    expect((await notifyOpenedWaitlist()).handled).toBe(0); // nicht nochmals
  });
});
