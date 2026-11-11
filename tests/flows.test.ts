/**
 * Leihablauf gegen echtes Postgres: Constraints, Zustandswechsel, Kalender.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemCode, redeemToken } from "@/lib/loans/handover";
import { passOnConsent } from "@/lib/loans/passon";
import { getCalendar } from "@/lib/loans/calendar";
import { ageLoan, day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("Leihe von Anfrage bis Abschluss", () => {
  it("läuft vollständig mit QR-Übergabe und QR-Rückgabe", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Der Prozess");

    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend", message: "Hallo" });
    expect(loan.status).toBe("requested");
    await svc.accept(marc, loan.id, {});
    expect(await status(loan.id)).toBe("accepted");

    // Marc zeigt den Code, Lea scannt
    const t = await createToken(marc, loan.id);
    expect(t.code).toMatch(/^\d{6}$/);
    await expect(redeemToken(marc, t.token)).rejects.toThrow(/andere/);
    const r = await redeemToken(lea, t.token);
    expect(r.status).toBe("active");
    await expect(redeemToken(lea, t.token)).rejects.toThrow(/bereits verwendet/);

    const [l] = await sql<{ due_at: Date; handed_over_at: Date }[]>`select due_at, handed_over_at from loans where id = ${loan.id}`;
    expect(l.due_at.getTime()).toBeGreaterThan(Date.now() + 27 * 86400_000);

    // Rückgabe: Lea zeigt den Code, Marc gibt die sechs Ziffern ein
    const rt = await createToken(lea, loan.id);
    await expect(redeemCode(marc, loan.id, "000000" === rt.code ? "111111" : "000000")).rejects.toThrow(/Ziffern/);
    await redeemCode(marc, loan.id, rt.code);
    expect(await status(loan.id)).toBe("returned");

    await svc.complete(marc, loan.id);
    expect(await status(loan.id)).toBe("completed");

    const events = await sql<{ action: string }[]>`select action from loan_events where loan_id = ${loan.id} order by id`;
    expect(events.map((e) => e.action)).toEqual(["request", "accept", "handover", "return", "complete"]);
    await expect(sql`update loan_events set action = 'x' where loan_id = ${loan.id}`).rejects.toThrow(/anhängend/);

    await svc.rate(lea, loan.id, { verdict: "good", reasons: [] });
    await svc.rate(marc, loan.id, { verdict: "good", reasons: [] });
    const [rv] = await sql<{ n: number }[]>`select count(*)::int as n from ratings where loan_id = ${loan.id} and visible_from <= now()`;
    expect(rv.n).toBe(2);
  });

  it("zwei gleichzeitige Annahmen: nur eine gewinnt", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Stiller");
    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    const results = await Promise.allSettled([svc.accept(marc, loan.id, {}), svc.accept(marc, loan.id, {})]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [b] = await sql<{ n: number }[]>`select count(*)::int as n from copy_bookings where loan_id = ${loan.id}`;
    expect(b.n).toBe(1);
  });

  it("doppelte Anfrage für denselben Starttag scheitert an der Datenbank", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Homo faber");
    await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await expect(svc.requestLoan(lea, { copyId: copy, kind: "lend" })).rejects.toMatchObject({ code: "23505" });
  });
});

describe("Verleihkalender", () => {
  it("überlappende oder zu dicht anschliessende Buchung scheitert (23P01), Puffer zählt", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Die Wand");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(28) });
    await svc.accept(marc, a.id, {});

    // Direkt danach ohne Puffer: abgelehnt bereits bei der Anfrage
    await expect(svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(29), end: day(40) })).rejects.toMatchObject({ code: "calendar_conflict" });
    // Auf Datenbankebene ebenso
    await expect(
      sql`insert into copy_bookings (copy_id, period, buffer_days) values (${copy}, daterange(${day(29)}::date, ${day(35)}::date), 0)`,
    ).rejects.toMatchObject({ code: "23P01" });

    // Nach dem Puffer von 3 Tagen: frei
    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(31), end: day(45) });
    await svc.accept(marc, b.id, {});

    const cal = await getCalendar(sql, copy, jonas.id);
    expect(cal!.bars).toHaveLength(2);
    expect(cal!.bars.find((x) => x.mine)?.start).toBe(day(31));
    expect(cal!.bars.every((x) => x.name === null)).toBe(true);
    const own = await getCalendar(sql, copy, marc.id);
    expect(own!.bars.map((x) => x.name)).toEqual(["Lea", "Jonas"]);
  });

  it("aktiv ohne Übergabezeitpunkt scheitert (23514)", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Momo");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await expect(sql`update loans set status = 'active' where id = ${l.id}`).rejects.toMatchObject({ code: "23514" });
  });

  it("Verlängerung nur bis zum Puffer vor der nächsten Buchung", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Siddhartha");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(20) });
    await svc.accept(marc, a.id, {});
    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(30), end: day(40) });
    await svc.accept(marc, b.id, {});
    const t = await createToken(marc, a.id);
    await redeemToken(lea, t.token);
    await svc.extend(lea, a.id);
    const [bk] = await sql<{ end: string }[]>`select upper(period)::text as end from copy_bookings where loan_id = ${a.id}`;
    expect(bk.end).toBe(day(27)); // 30 minus 3 Tage Puffer, nicht 34
    await expect(svc.extend(lea, a.id)).rejects.toMatchObject({ code: "no_extensions" });
  });
});

describe("Limiten und Vertrauen", () => {
  it("Neue haben höchstens 3 offene Anfragen", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    for (let i = 0; i < 3; i++) await svc.requestLoan(lea, { copyId: await makeCopy(marc, `Buch ${i}`), kind: "lend" });
    await expect(svc.requestLoan(lea, { copyId: await makeCopy(marc, "Buch 4"), kind: "lend" })).rejects.toMatchObject({ code: "limit_requests" });
  });

  it("Sichtbarkeit «ab Bewährt» versteckt das Buch vor Neuen", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const anna = await makeUser("Anna", { trust: 1 });
    const copy = await makeCopy(marc, "Andorra", { visibility: "proven" });
    await expect(svc.requestLoan(lea, { copyId: copy, kind: "lend" })).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.requestLoan(anna, { copyId: copy, kind: "lend" })).resolves.toBeTruthy();
  });
});

describe("Tausch und Geschenk", () => {
  it("Tausch: beide Scans innert 10 Minuten, Exemplare wechseln den Besitzer", async () => {
    const jonas = await makeUser("Jonas");
    const lea = await makeUser("Lea");
    const his = await makeCopy(jonas, "Der Steppenwolf", { offers: "{swap}" });
    const hers1 = await makeCopy(lea, "Effi Briest", { offers: "{swap}" });
    const hers2 = await makeCopy(lea, "Der Vorleser", { offers: "{swap}" });
    const loan = await svc.requestLoan(lea, { copyId: his, kind: "swap", swapOfferedCopyIds: [hers1, hers2] });
    await expect(svc.accept(jonas, loan.id, {})).rejects.toMatchObject({ code: "invalid" });
    await svc.accept(jonas, loan.id, { swapCopyId: hers2 });

    const tj = await createToken(jonas, loan.id);
    const first = await redeemToken(lea, tj.token);
    expect(first.waitingForOther).toBe(true);
    const tl = await createToken(lea, loan.id);
    const second = await redeemToken(jonas, tl.token);
    expect(second.status).toBe("completed");

    const owners = await sql<{ id: string; owner_id: string; offers: string }[]>`select id, owner_id, offers::text from copies where id in (${his}, ${hers2})`;
    expect(owners.find((c) => c.id === his)!.owner_id).toBe(lea.id);
    expect(owners.find((c) => c.id === hers2)!.owner_id).toBe(jonas.id);
    expect(owners.every((c) => c.offers === "{}")).toBe(true);
  });

  it("Geschenk: Besitzwechsel und 30 Tage Sperre für Weitergabe", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Heidi", { offers: "{gift}" });
    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "gift" });
    await svc.accept(marc, loan.id, {});
    const t = await createToken(marc, loan.id);
    await redeemToken(lea, t.token);
    expect(await status(loan.id)).toBe("completed");
    const [c] = await sql<{ owner_id: string; locked: boolean }[]>`select owner_id, transfer_locked_until > now() as locked from copies where id = ${copy}`;
    expect(c.owner_id).toBe(lea.id);
    expect(c.locked).toBe(true);
  });
});

describe("Direkte Weitergabe", () => {
  it("ein Scan beendet die erste und startet die zweite Leihe", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea", { trust: 1 });
    const jonas = await makeUser("Jonas", { trust: 1 });
    const copy = await makeCopy(marc, "Der Zauberberg");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, a.id, {});
    const t = await createToken(marc, a.id);
    await redeemToken(lea, t.token);

    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(17), end: day(30) });
    await svc.accept(marc, b.id, {});
    const [chat] = await sql<{ n: number }[]>`select count(*)::int as n from handover_chats where next_loan_id = ${b.id}`;
    expect(chat.n).toBe(1);

    await passOnConsent(marc, b.id, true);
    await passOnConsent(lea, b.id, true);
    const res = await passOnConsent(jonas, b.id, true);
    expect(res.complete).toBe(true);

    // Falsche Person kann keinen Weitergabecode zeigen
    await expect(createToken(jonas, b.id)).rejects.toThrow();
    const pt = await createToken(lea, b.id);
    expect(pt.direction).toBe("pass_on");
    await redeemToken(jonas, pt.token);
    expect(await status(a.id)).toBe("returned");
    expect(await status(b.id)).toBe("active");
  });
});

describe("Fristen und Streitfall", () => {
  it("Fall frühestens nach 7 Tagen Verzug, Rückgabe schliesst ihn", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Faust");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, l.id, {});
    await redeemToken(lea, (await createToken(marc, l.id)).token);
    await expect(svc.openCase(marc, l.id)).rejects.toMatchObject({ code: "too_early" });
    await ageLoan(l.id, 24 * 22);
    const { caseId } = await svc.openCase(marc, l.id);
    expect(await status(l.id)).toBe("disputed");
    await svc.respondToCase(lea, caseId, { response: "return_date", returnAt: new Date(Date.now() + 86400_000).toISOString() });
    await redeemToken(marc, (await createToken(lea, l.id)).token);
    expect(await status(l.id)).toBe("returned");
    const [c] = await sql<{ outcome: string }[]>`select outcome from cases where id = ${caseId}`;
    expect(c.outcome).toBe("returned");
    const [late] = await sql<{ late: boolean }[]>`select late from loans where id = ${l.id}`;
    expect(late.late).toBe(true);
  });
});

describe("Fristenlauf", () => {
  it("verfällt Anfragen, schliesst Prüfungen ab und erinnert genau einmal", async () => {
    const { runDeadlines } = await import("@/worker/deadlines");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const c1 = await makeCopy(marc, "Unterm Rad");
    const c2 = await makeCopy(marc, "Der Richter und sein Henker");
    const r1 = await svc.requestLoan(lea, { copyId: c1, kind: "lend" });
    await ageLoan(r1.id, 73);

    const r2 = await svc.requestLoan(lea, { copyId: c2, kind: "lend", start: day(0), end: day(6) });
    await svc.accept(marc, r2.id, {});
    await redeemToken(lea, (await createToken(marc, r2.id)).token);

    const out = await runDeadlines();
    expect(out.requests_expired).toBe(1);
    expect(await status(r1.id)).toBe("expired");

    // 5 Tage vor Fälligkeit: genau eine Erinnerung, auch bei mehreren Läufen
    await runDeadlines();
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where loan_id = ${r2.id} and type = 'due_soon' and channel = 'app'`;
    expect(n.n).toBe(1);

    await svc.reportReturn(lea, r2.id);
    await ageLoan(r2.id, 49);
    // Die Rückgabe gilt ab Meldung; die 48 h Prüfung laufen ab dann und sind ebenfalls vorbei
    await runDeadlines();
    expect(await status(r2.id)).toBe("completed");
    const actions = await sql<{ action: string }[]>`select action from loan_events where loan_id = ${r2.id} order by id`;
    expect(actions.map((a) => a.action).slice(-3)).toEqual(["report_return", "return_report_lapse", "complete"]);
  });
});
