/**
 * Analyse November 2026, niedrige Befunde «Sicherheit»: Admin über ADMIN_EMAILS entziehbar,
 * gerundete Distanzen, ICS-Maskierung, sichere Rücksprungpfade, keine Abfrage registrierter Nummern.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; text: string }[] = [];
vi.mock("@/lib/notify/sms", () => ({
  sendSms: async (to: string, text: string) => {
    sent.push({ to, text });
  },
}));

import { sql } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { applyAdminEmails } from "@/lib/auth/session";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/auth/flows";
import { roundDistance } from "@/lib/geo";
import { icsText } from "@/lib/chat";
import { safeNext } from "@/lib/safe-next";
import { makeUser, reset } from "./helpers";

beforeEach(async () => {
  await reset();
  sent.length = 0;
});
afterAll(() => sql.end());

const roleOf = async (id: string) =>
  (await sql<{ role: string; admin_via_env: boolean }[]>`select role::text as role, admin_via_env from users where id = ${id}`)[0];

describe("ADMIN_EMAILS", () => {
  const prev = process.env.ADMIN_EMAILS;
  afterAll(() => {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });

  it("vergibt die Rolle und entzieht sie wieder, wenn die Adresse aus der Liste fällt", async () => {
    const lea = await makeUser("Lea");
    process.env.ADMIN_EMAILS = lea.email;
    const u = await applyAdminEmails({ ...lea });
    expect(u.role).toBe("admin");
    expect(await roleOf(lea.id)).toEqual({ role: "admin", admin_via_env: true });

    process.env.ADMIN_EMAILS = "andere@test.ch";
    expect((await applyAdminEmails({ ...lea, role: "admin", admin_via_env: true })).role).toBe("member");
    expect(await roleOf(lea.id)).toEqual({ role: "member", admin_via_env: false });
  });

  it("leere Liste entzieht, fehlende Variable ändert nichts", async () => {
    const lea = await makeUser("Lea");
    process.env.ADMIN_EMAILS = lea.email;
    await applyAdminEmails({ ...lea });

    delete process.env.ADMIN_EMAILS;
    expect((await applyAdminEmails({ ...lea, role: "admin", admin_via_env: true })).role).toBe("admin");
    expect((await roleOf(lea.id)).role).toBe("admin");

    process.env.ADMIN_EMAILS = "";
    expect((await applyAdminEmails({ ...lea, role: "admin", admin_via_env: true })).role).toBe("member");
  });

  it("Admins, die nicht über die Variable entstanden sind, bleiben", async () => {
    const marc = await makeUser("Marc");
    await sql`update users set role = 'admin' where id = ${marc.id}`;
    process.env.ADMIN_EMAILS = "andere@test.ch";
    expect((await applyAdminEmails({ ...marc, role: "admin", admin_via_env: false })).role).toBe("admin");
    expect(await roleOf(marc.id)).toEqual({ role: "admin", admin_via_env: false });
  });
});

describe("Distanzen", () => {
  it("rundet auf 100 m, mindestens 100 m", () => {
    expect(roundDistance(0)).toBe(100);
    expect(roundDistance(149)).toBe(100);
    expect(roundDistance(151)).toBe(200);
    expect(roundDistance(1234.5)).toBe(1200);
    expect(roundDistance(null)).toBeNull();
  });
});

describe("Kalenderdatei", () => {
  it("maskiert nach RFC 5545 und entfernt Steuerzeichen", () => {
    expect(icsText("Kiosk, Gleis 1; vorne")).toBe("Kiosk\\, Gleis 1\\; vorne");
    expect(icsText("a\\b")).toBe("a\\\\b");
    expect(icsText("Zeile 1\nZeile 2\r\nZeile 3")).toBe("Zeile 1\\nZeile 2\\nZeile 3");
    // ein einzelnes CR darf keine neue Eigenschaft beginnen
    expect(icsText("Ort\rATTENDEE:mailto:x@y.ch")).toBe("Ort\\nATTENDEE:mailto:x@y.ch");
    expect(icsText("A\u0000B\u0007C\u007f")).toBe("ABC");
    expect(icsText("Ort\rX")).not.toMatch(/[\r\n]/);
  });
});

describe("Rücksprungpfade", () => {
  it("nur eigene Pfade", () => {
    expect(safeNext("/vorgaenge/1?x=1#y")).toBe("/vorgaenge/1?x=1#y");
    expect(safeNext("//evil.com")).toBe("");
    expect(safeNext("/\\evil.com")).toBe("");
    expect(safeNext("https://evil.com")).toBe("");
    expect(safeNext("/a\u007fb")).toBe("");
  });
});

describe("Mobilnummer", () => {
  it("verrät nicht, ob eine Nummer schon zu einem anderen Konto gehört", async () => {
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    await sql`update users set phone_e164 = '+41791112233', phone_verified_at = now() where id = ${lea.id}`;
    await sql`update users set phone_e164 = null, phone_verified_at = null where id = ${jonas.id}`;
    const j = { ...jonas, phone_e164: null, phone_verified_at: null };

    // gleiche Antwort wie bei einer freien Nummer, aber keine SMS
    const taken = await requestPhoneCode(j, "079 111 22 33");
    const free = await requestPhoneCode(j, "079 444 55 66");
    expect(Object.keys(taken)).toEqual(Object.keys(free));
    expect(sent.map((s) => s.to)).toEqual(["+41794445566"]);

    // auch der richtige Code für die fremde Nummer gilt als falsch
    await sql`delete from phone_verifications where user_id = ${jonas.id} and phone_e164 = '+41794445566'`;
    await sql`update phone_verifications set code_hash = ${hashToken(`${jonas.id}:123456`)} where user_id = ${jonas.id}`;
    await expect(verifyPhoneCode(j, "123456")).rejects.toThrow(/stimmt nicht/);
    const [u] = await sql<{ phone_verified_at: Date | null }[]>`select phone_verified_at from users where id = ${jonas.id}`;
    expect(u.phone_verified_at).toBeNull();
  });
});
