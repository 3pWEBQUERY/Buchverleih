/**
 * Analyse November 2026, Paket «Sicherheit und Leistung»: Kreis-Beitritte, SMS nur CH/LI,
 * IP aus dem Proxy, gebündelter Verleihkalender.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { smsAllowed } from "@/lib/auth/phone";
import { requestPhoneCode } from "@/lib/auth/flows";
import { createCircle, joinCircle } from "@/lib/circles";
import { getCalendar } from "@/lib/loans/calendar";
import { getCalendars } from "@/lib/calendar-batch";
import { makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("IP hinter dem Proxy", () => {
  const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });
  it("nimmt den letzten Eintrag von X-Forwarded-For (vom Proxy angehängt)", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIp(req({}))).toBe("unbekannt");
  });
});

describe("SMS nur Schweiz und Liechtenstein", () => {
  it("erlaubt CH- und LI-Mobilnummern, sonst nichts", () => {
    expect(smsAllowed("+41791234567")).toBe(true);
    expect(smsAllowed("+4237912345")).toBe(true);
    expect(smsAllowed("+491701234567")).toBe(false);
    expect(smsAllowed("+882123456789")).toBe(false);
  });
  it("lehnt ausländische Nummern mit klarer Meldung ab", async () => {
    const lea = await makeUser("Lea");
    await expect(requestPhoneCode(lea, "+49 170 1234567")).rejects.toThrow(/Schweiz und Liechtenstein/);
  });
});

describe("Kreis-Beitritt", () => {
  it("benachrichtigt die Admins nur bei der ersten Anfrage", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const id = await createCircle(marc.id, { name: "Lesekreis", joinMode: "approval" });
    const [c] = await sql<{ invite_code: string }[]>`select invite_code from circles where id = ${id}`;
    for (let i = 0; i < 3; i++) await joinCircle(lea.id, c.invite_code);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where user_id = ${marc.id} and type = 'circle_join_request' and channel = 'app'`;
    expect(n.n).toBe(1);
  });
});

describe("Verleihkalender gebündelt", () => {
  it("liefert dasselbe wie getCalendar je Exemplar", async () => {
    const marc = await makeUser("Marc");
    const ids = [await makeCopy(marc, "Stiller"), await makeCopy(marc, "Homo faber")];
    await sql`insert into copy_bookings (copy_id, period, buffer_days, note) values (${ids[0]}, daterange(current_date + 3, current_date + 10), 1, 'Ferien')`;
    const batch = await getCalendars(sql, ids, marc.id);
    for (const id of ids) expect(batch.get(id)).toEqual(await getCalendar(sql, id, marc.id));
  });
});
