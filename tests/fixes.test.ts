/**
 * Regressionen aus der Analyse: Codes, Tausch-Besitz, Weitergabe-Kette, Verlängerung, Limiten, Löschung, Demo.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemCode, redeemToken } from "@/lib/loans/handover";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/auth/flows";
import { deleteAccount } from "@/lib/account";
import { addSpot } from "@/lib/copies";
import { safeNext } from "@/lib/safe-next";
import { ageLoan, day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("Codes", () => {
  it("SMS-Code: Fehlversuche bleiben gezählt, nach 5 ist Schluss", async () => {
    const lea = await makeUser("Lea");
    await requestPhoneCode(lea, "+41791112233");
    for (let i = 0; i < 5; i++) await expect(verifyPhoneCode(lea, "000001")).rejects.toThrow(/stimmt nicht/);
    await expect(verifyPhoneCode(lea, "000001")).rejects.toThrow(/Zu viele/);
    const [v] = await sql<{ attempts: number }[]>`select attempts from phone_verifications where user_id = ${lea.id}`;
    expect(v.attempts).toBe(5);
  });

  it("Übergabe-Code: Fehlversuche bleiben gezählt", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Stiller"), kind: "lend" });
    await svc.accept(marc, loan.id, {});
    const t = await createToken(marc, loan.id);
    const wrong = t.code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) await expect(redeemCode(lea, loan.id, wrong)).rejects.toThrow(/Ziffern/);
    // auch der richtige Code gilt nach 5 Fehlversuchen nicht mehr
    await expect(redeemCode(lea, loan.id, t.code)).rejects.toThrow();
    const [h] = await sql<{ attempts: number; redeemed_at: Date | null }[]>`select attempts, redeemed_at from handover_tokens where loan_id = ${loan.id}`;
    expect(h.attempts).toBeGreaterThanOrEqual(5);
    expect(h.redeemed_at).toBeNull();
  });

  it("Rücksprungziel: nur eigene Pfade", () => {
    expect(safeNext("/regal")).toBe("/regal");
    expect(safeNext("//evil.com")).toBe("");
    expect(safeNext("/\\evil.com")).toBe("");
    expect(safeNext("https://evil.com")).toBe("");
  });
});

describe("Tausch und Weitergabe", () => {
  it("Tausch scheitert, wenn das Gegenstück inzwischen verschenkt wurde", async () => {
    const jonas = await makeUser("Jonas");
    const lea = await makeUser("Lea");
    const anna = await makeUser("Anna");
    const his = await makeCopy(jonas, "Steppenwolf", { offers: "{swap}" });
    const hers = await makeCopy(lea, "Effi Briest", { offers: "{swap,gift}" });
    const swap = await svc.requestLoan(lea, { copyId: his, kind: "swap", swapOfferedCopyIds: [hers] });
    // Lea verschenkt das angebotene Buch an Anna
    const gift = await svc.requestLoan(anna, { copyId: hers, kind: "gift" });
    await svc.accept(lea, gift.id, {});
    const tg = await createToken(lea, gift.id);
    await redeemToken(anna, tg.token);
    const [o] = await sql<{ owner_id: string }[]>`select owner_id from copies where id = ${hers}`;
    expect(o.owner_id).toBe(anna.id);
    // Jonas kann den Tausch nicht mehr mit diesem Buch annehmen
    await expect(svc.accept(jonas, swap.id, { swapCopyId: hers })).rejects.toThrow(/nicht mehr verfügbar/);
  });

  it("Normale Rückgabe löst eine vereinbarte direkte Weitergabe", async () => {
    const marc = await makeUser("Marc", { trust: 2 });
    const lea = await makeUser("Lea", { trust: 2 });
    const jonas = await makeUser("Jonas", { trust: 2 });
    const copy = await makeCopy(marc, "Momo", { pass_on: "always", buffer_days: 0, loan_days: 14 });
    const first = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, first.id, {});
    await redeemToken(lea, (await createToken(marc, first.id)).token);
    const second = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(14), end: day(28) });
    await svc.accept(marc, second.id, {});
    await sql`update loans set received_from_loan_id = ${first.id} where id = ${second.id}`;
    // Lea bringt das Buch zu Marc statt zu Jonas
    await redeemCode(marc, first.id, (await createToken(lea, first.id)).code);
    expect(await status(first.id)).toBe("returned");
    const [n] = await sql<{ received_from_loan_id: string | null }[]>`select received_from_loan_id from loans where id = ${second.id}`;
    expect(n.received_from_loan_id).toBeNull();
  });
});

describe("Verlängerung, Limiten, Vertrauen", () => {
  it("überfällige Leihe lässt sich nicht mehr verlängern", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Homo faber", { auto_extend: true });
    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await svc.accept(marc, loan.id, {});
    await redeemToken(lea, (await createToken(marc, loan.id)).token);
    await ageLoan(loan.id, 24 * 40);
    await expect(svc.extend(lea, loan.id)).rejects.toThrow(/abgelaufen/);
  });

  it("Annahme prüft das Limit gleichzeitiger Leihen erneut", async () => {
    const lea = await makeUser("Lea"); // Stufe 0: 2 gleichzeitig
    const owners = await Promise.all(["A", "B", "C"].map((n) => makeUser(n)));
    const loans = [];
    for (const o of owners) loans.push({ o, l: await svc.requestLoan(lea, { copyId: await makeCopy(o, `Buch ${o.first_name}`), kind: "lend" }) });
    await svc.accept(loans[0].o, loans[0].l.id, {});
    await svc.accept(loans[1].o, loans[1].l.id, {});
    await expect(svc.accept(loans[2].o, loans[2].l.id, {})).rejects.toMatchObject({ code: "limit_concurrent" });
  });
});

describe("Konto und Demo", () => {
  it("Konto lässt sich löschen, auch wenn ein Übergabeort benutzt wurde", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const spot = await addSpot(marc.id, { label: "Bahnhof" });
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Heidi"), kind: "lend" });
    await svc.accept(marc, loan.id, { pickupSpotId: spot });
    await svc.cancel(lea, loan.id);
    await deleteAccount(marc.id);
    const [u] = await sql<{ deleted_at: Date | null; plz: string | null }[]>`select deleted_at, plz from users where id = ${marc.id}`;
    expect(u.deleted_at).not.toBeNull();
    expect(u.plz).toBeNull();
  });

  it("Demo-Bücher lassen sich nicht anfragen", async () => {
    const demo = await makeUser("Demo");
    await sql`update users set email = 'demo1@demo.leihregal.invalid' where id = ${demo.id}`;
    const lea = await makeUser("Lea");
    await expect(svc.requestLoan(lea, { copyId: await makeCopy(demo, "Faust"), kind: "lend" })).rejects.toMatchObject({ code: "demo_copy" });
  });
});

describe("Rollen", () => {
  it("nur Admins ernennen Moderation, nie sich selbst oder andere Admins", async () => {
    const { setRole } = await import("@/lib/moderation");
    const admin = await makeUser("Admin");
    await sql`update users set role = 'admin' where id = ${admin.id}`;
    const adm = { ...admin, role: "admin" as const };
    const lea = await makeUser("Lea");
    await setRole(adm, lea.id, "moderator");
    const [r] = await sql<{ role: string }[]>`select role::text as role from users where id = ${lea.id}`;
    expect(r.role).toBe("moderator");
    const modLea = { ...lea, role: "moderator" as const };
    const jonas = await makeUser("Jonas");
    await expect(setRole(modLea, jonas.id, "moderator")).rejects.toThrow(/nur Admins/);
    await expect(setRole(adm, adm.id, "member")).rejects.toThrow(/eigene Rolle/);
    await setRole(adm, lea.id, "member");
    const [r2] = await sql<{ role: string }[]>`select role::text as role from users where id = ${lea.id}`;
    expect(r2.role).toBe("member");
  });
});
