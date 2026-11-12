/**
 * Regressionen aus der zweiten Analyse: späte Übergabe, Fall mit Weitergabe, Tauschangebot,
 * Fristwechsel mit erneuter Prüfung, Meldefenster, Storno ohne verschachtelte Transaktion.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemToken } from "@/lib/loans/handover";
import { ageLoan, day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

/** Leihe annehmen und den gebuchten Zeitraum direkt setzen (simuliert vergangene Tage) */
async function setPeriod(loanId: string, start: string, end: string, buffer = 0) {
  await sql`update copy_bookings set period = daterange(${start}::date, ${end}::date), buffer_days = ${buffer} where loan_id = ${loanId}`;
  await sql`update loans set wanted = daterange(${start}::date, ${end}::date) where id = ${loanId}`;
}

describe("Späte Übergabe einer kurzen Leihe", () => {
  async function setup() {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Stiller");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(1), end: day(4) });
    await svc.accept(marc, a.id, {});
    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(10), end: day(20) });
    await svc.accept(marc, b.id, {});
    // Leas Zeitraum ist schon vorbei, Jonas' Buchung beginnt heute
    await setPeriod(a.id, day(-4), day(-1));
    await setPeriod(b.id, day(0), day(10));
    return { marc, lea, a };
  }

  it("Scan endet mit klarer Meldung statt Serverfehler", async () => {
    const { marc, lea, a } = await setup();
    const t = await createToken(marc, a.id);
    await expect(redeemToken(lea, t.token)).rejects.toMatchObject({ code: "period_over" });
    expect(await status(a.id)).toBe("accepted");
  });

  it("Fristablauf einer Meldung lässt den Vorgang verfallen statt jedes Mal zu scheitern", async () => {
    const { marc, a } = await setup();
    await svc.reportHandover(marc, a.id, {});
    await ageLoan(a.id, 49);
    const { runDeadlines } = await import("@/worker/deadlines");
    await runDeadlines();
    expect(await status(a.id)).toBe("expired");
    const [b] = await sql<{ n: number }[]>`select count(*)::int as n from copy_bookings where loan_id = ${a.id}`;
    expect(b.n).toBe(0);
  });
});

describe("Fall und Weitergabe", () => {
  it("gelöster Fall gibt eine vereinbarte direkte Weitergabe frei", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Homo faber");
    const p = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await svc.accept(marc, p.id, {});
    await redeemToken(lea, (await createToken(marc, p.id)).token);
    const n = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(60), end: day(70) });
    await svc.accept(marc, n.id, {});
    await sql`update loans set received_from_loan_id = ${p.id} where id = ${n.id}`;
    await ageLoan(p.id, 24 * 40);
    const { caseId } = await sql.begin((tx) => svc.openCaseTx(tx, p.id, { role: "owner", id: marc.id }));
    await svc.resolveCase(marc, caseId, "returned");
    const [row] = await sql<{ received_from_loan_id: string | null; status: string }[]>`
      select received_from_loan_id, status from loans where id = ${n.id}`;
    expect(row.status).toBe("accepted");
    expect(row.received_from_loan_id).toBeNull();
  });
});

describe("Tauschangebot", () => {
  it("angebotenes Buch, das inzwischen verliehen ist, wechselt nicht den Besitz", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Momo"), kind: "lend" });
    await svc.accept(marc, loan.id, {});
    await redeemToken(lea, (await createToken(marc, loan.id)).token);
    const mine = await makeCopy(lea, "Heidi");
    await svc.offerSwap(lea, loan.id, mine);
    // Lea verleiht ihr angebotenes Buch danach an Jonas
    const other = await svc.requestLoan(jonas, { copyId: mine, kind: "lend" });
    await svc.accept(lea, other.id, {});
    await expect(svc.acceptSwapOffer(marc, loan.id)).rejects.toMatchObject({ code: "offer_unavailable" });
    const [c] = await sql<{ owner_id: string }[]>`select owner_id from copies where id = ${mine}`;
    expect(c.owner_id).toBe(lea.id);
  });
});

describe("Meldungen und Fristen", () => {
  it("Übergabe lässt sich frühestens 3 Tage vor Beginn melden", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Faust"), kind: "lend", start: day(10), end: day(20) });
    await svc.accept(marc, loan.id, {});
    await expect(svc.reportHandover(marc, loan.id, {})).rejects.toMatchObject({ code: "too_early" });
  });

  it("Einspruch vor dem Fristlauf: Meldung gilt nicht", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Woyzeck"), kind: "lend" });
    await svc.accept(marc, loan.id, {});
    await svc.reportHandover(marc, loan.id, {});
    await svc.objectHandover(lea, loan.id);
    await ageLoan(loan.id, 49);
    const { runDeadlines } = await import("@/worker/deadlines");
    await runDeadlines();
    expect(await status(loan.id)).toBe("accepted");
  });

  it("Storno ohne Nachteil ohne blockierenden Vorgänger storniert normal", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const loan = await svc.requestLoan(lea, { copyId: await makeCopy(marc, "Effi Briest"), kind: "lend" });
    await svc.accept(marc, loan.id, {});
    await svc.cancelWithoutPenalty(lea, loan.id);
    expect(await status(loan.id)).toBe("cancelled");
  });
});
