/**
 * Niedrige Befunde (Logik und Betrieb): Übergabeort bei offenem Vorgang, Fälligkeit nach geplatzter
 * Weitergabe in Kalendertagen, Aufräumen verwaister Uploads und alter Daten.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemToken } from "@/lib/loans/handover";
import { getLoan } from "@/lib/loans/core";
import { onPassOnBroken } from "@/lib/loans/passon";
import { addSpot, removeSpot } from "@/lib/copies";
import { runRetention } from "@/worker/deadlines";
import { day, makeCopy, makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("Übergabeorte", () => {
  it("lassen sich nicht löschen, solange ein offener Vorgang sie nutzt", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const spot = await addSpot(marc.id, { label: "Bahnhof" });
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Heidi"), kind: "lend" });
    await svc.accept(marc, loan.id, { pickupSpotId: spot });
    await expect(removeSpot(marc.id, spot)).rejects.toMatchObject({ code: "spot_in_use" });
    await svc.cancel(lea, loan.id);
    await removeSpot(marc.id, spot);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from pickup_spots where id = ${spot}`;
    expect(n.n).toBe(0);
  });
});

describe("Geplatzte Weitergabe", () => {
  it("verlängert die Fälligkeit um drei Kalendertage, abgeleitet aus der Buchung", async () => {
    const marc = await makeUser("Marc", { trust: 2 });
    const lea = await makeUser("Lea", { trust: 2 });
    const jonas = await makeUser("Jonas", { trust: 2 });
    const copy = await makeCopy(marc, "Momo", { pass_on: "always", buffer_days: 0, loan_days: 14 });
    const first = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, first.id, {});
    await redeemToken(lea, (await createToken(marc, first.id)).token);
    const second = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(20), end: day(34) });
    await svc.accept(marc, second.id, {});
    await sql`update loans set received_from_loan_id = ${first.id} where id = ${second.id}`;

    await sql.begin(async (tx) => {
      const next = await getLoan(tx, second.id);
      await onPassOnBroken(tx, next!);
    });
    const [r] = await sql<{ ok: boolean }[]>`
      select l.due_at = day_start_ch(upper(b.period)) as ok
        from loans l join copy_bookings b on b.loan_id = l.id where l.id = ${first.id}`;
    expect(r.ok).toBe(true);
  });
});

describe("Aufbewahrung", () => {
  it("räumt verwaiste Uploads, nie versandte Mails und alte Signale auf, behält Verwendetes", async () => {
    const lea = await makeUser("Lea");
    const ins = (key: string | null, status: string, ageHours: number) => sql`
      insert into uploads (user_id, purpose, raw_key, key, content_type, max_bytes, status, created_at, processed_at)
      values (${lea.id}, 'copy_photo', ${`raw/${lea.id}/${Math.random()}`}, ${key}, 'image/jpeg', 1000, ${status},
              now() - make_interval(hours => ${ageHours}), ${status === "processed" ? sql`now() - make_interval(hours => ${ageHours})` : null})
      returning id`;
    const [stale] = await ins(null, "pending", 30);
    const [fresh] = await ins(null, "pending", 2);
    const [unused] = await ins(`u/${lea.id}/unbenutzt`, "processed", 24 * 8);
    const [used] = await ins(`u/${lea.id}/avatar`, "processed", 24 * 8);
    await sql`update users set avatar_key = ${`u/${lea.id}/avatar`} where id = ${lea.id}`;
    await sql`insert into notifications (user_id, type, channel, payload, created_at) values (${lea.id}, 'message', 'email', '{}', now() - interval '40 days')`;
    await sql`insert into interest_signals (key, user_id, created_at) values ('test', ${lea.id}, now() - interval '13 months')`;

    const r = await runRetention();
    expect(r.uploadsStale).toBeGreaterThanOrEqual(1);
    expect(r.uploadsUnused).toBeGreaterThanOrEqual(1);
    const left = new Set((await sql<{ id: string }[]>`select id from uploads where user_id = ${lea.id}`).map((x) => x.id));
    expect(left.has(stale.id)).toBe(false);
    expect(left.has(unused.id)).toBe(false);
    expect(left.has(fresh.id)).toBe(true);
    expect(left.has(used.id)).toBe(true);
    const [m] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where user_id = ${lea.id} and channel = 'email'`;
    expect(m.n).toBe(0);
    const [s] = await sql<{ n: number }[]>`select count(*)::int as n from interest_signals where key = 'test'`;
    expect(s.n).toBe(0);
  });
});
