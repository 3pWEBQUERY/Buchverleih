/**
 * Härtung aus der Gesamtanalyse: Konto-Übernahme vor der Bestätigung, Passwortwechsel,
 * Warteliste, Schadenfälle mit Frist, Einspruch im offenen Fall, Funktionsschalter.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/crypto";
import { loginWithPassword, registerWithPassword, setPassword, verifyEmailLink } from "@/lib/auth/flows";
import { joinWaitlist } from "@/lib/account";
import * as svc from "@/lib/loans/service";
import { createToken, redeemToken } from "@/lib/loans/handover";
import { setFlag } from "@/lib/moderation";
import { ageLoan, day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(async () => {
  await reset();
  await sql`delete from login_tokens`;
  await sql`delete from plz_waitlist`;
  await sql`delete from area_openings`;
  await sql`update features set enabled = true`;
});
afterAll(async () => {
  await sql`update features set enabled = true`;
  await sql.end();
});

async function session(userId: string) {
  const [s] = await sql<{ id: string }[]>`
    insert into sessions (user_id, token_hash, kind, expires_at) values (${userId}, ${hashToken(randomToken(16))}, 'api', now() + interval '1 day') returning id`;
  return s.id;
}
async function link(email: string) {
  const token = randomToken(16);
  await sql`insert into login_tokens (email, token_hash, expires_at) values (${email}, ${hashToken(token)}, now() + interval '15 minutes')`;
  return token;
}

describe("Konto-Übernahme vor der Bestätigung", () => {
  it("die erste Bestätigung beendet Sitzungen und Passkeys, die ohne Nachweis entstanden", async () => {
    const { userId } = await registerWithPassword("opfer@test.ch", "angreifer-pw");
    await session(userId);
    await sql`insert into passkeys (id, user_id, public_key) values ('fremd', ${userId}, '\\x00')`;
    await verifyEmailLink(await link("opfer@test.ch"));
    const [n] = await sql<{ s: number; p: number; pw: string | null }[]>`
      select (select count(*)::int from sessions where user_id = ${userId}) as s,
             (select count(*)::int from passkeys where user_id = ${userId}) as p,
             (select password_hash from users where id = ${userId}) as pw`;
    expect(n).toEqual({ s: 0, p: 0, pw: null });
    await expect(loginWithPassword("opfer@test.ch", "angreifer-pw")).rejects.toMatchObject({ status: 422 });
  });

  it("eine spätere Bestätigung lässt bestehende Sitzungen in Ruhe", async () => {
    const u = await makeUser("Bestätigt");
    const sid = await session(u.id);
    await verifyEmailLink(await link(u.email));
    const [s] = await sql`select id from sessions where id = ${sid}`;
    expect(s).toBeTruthy();
  });
});

describe("Passwortwechsel", () => {
  it("verlangt das bisherige Passwort und beendet die anderen Sitzungen", async () => {
    const { userId } = await registerWithPassword("pw@test.ch", "erstes-passwort");
    const keep = await session(userId);
    const other = await session(userId);
    await expect(setPassword(userId, "zweites-passwort", "falsch", keep)).rejects.toMatchObject({ status: 422 });
    await setPassword(userId, "zweites-passwort", "erstes-passwort", keep);
    const rows = await sql<{ id: string }[]>`select id from sessions where user_id = ${userId}`;
    expect(rows.map((r) => r.id)).toEqual([keep]);
    expect(rows.some((r) => r.id === other)).toBe(false);
    await expect(loginWithPassword("pw@test.ch", "zweites-passwort", "1.2.3.4")).resolves.toMatchObject({ userId });
  });
});

describe("Warteliste", () => {
  it("offene Postleitzahl: kein Eintrag, also keine E-Mail", async () => {
    await sql`insert into area_openings (level, code, enabled) values ('commune', '53', true)`;
    await joinWaitlist("x@test.ch", "8180");
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from plz_waitlist`;
    expect(n.n).toBe(0);
  });

  it("ein erneuter Eintrag setzt den Versand nicht zurück", async () => {
    await joinWaitlist("x@test.ch", "8180");
    await sql`update plz_waitlist set notified_at = now()`;
    await joinWaitlist("x@test.ch", "8180", "fr");
    const [w] = await sql<{ notified_at: Date | null; locale: string }[]>`select notified_at, locale from plz_waitlist`;
    expect(w.notified_at).not.toBeNull();
    expect(w.locale).toBe("fr");
  });
});

describe("Streitfälle", () => {
  async function lent() {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Faust");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, l.id, {});
    await redeemToken(lea, (await createToken(marc, l.id)).token);
    return { marc, lea, l };
  }

  it("Einspruch gegen die Rückgabemeldung im offenen Fall führt zurück in den Fall", async () => {
    const { marc, lea, l } = await lent();
    await ageLoan(l.id, 24 * 22);
    await svc.openCase(marc, l.id);
    await svc.reportReturn(lea, l.id);
    expect(await status(l.id)).toBe("return_reported");
    await svc.objectReturn(marc, l.id);
    expect(await status(l.id)).toBe("disputed");
  });

  it("ohne offenen Fall bleibt es beim Wechsel auf «aktiv»", async () => {
    const { marc, lea, l } = await lent();
    await svc.reportReturn(lea, l.id);
    await svc.objectReturn(marc, l.id);
    expect(await status(l.id)).toBe("active");
  });

  it("Schadenfall ohne Antwort: Erinnerung nach 7 Tagen, nach 14 Tagen entscheidet die Moderation", async () => {
    const { runDeadlines } = await import("@/worker/deadlines");
    const { queue } = await import("@/lib/moderation");
    const { marc, lea, l } = await lent();
    await redeemToken(marc, (await createToken(lea, l.id)).token);
    const { caseId } = await svc.reportDamage(marc, l.id, { description: "Wasserschaden", photoKeys: [] });
    await sql`update cases set opened_at = now() - interval '8 days' where id = ${caseId}`;
    await runDeadlines();
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where loan_id = ${l.id} and type = 'damage_reminder' and channel = 'app'`;
    expect(r.n).toBe(1);
    expect((await queue()).cases.find((c) => c.id === caseId)?.needs_decision).toBe(false);
    await sql`update cases set opened_at = now() - interval '15 days' where id = ${caseId}`;
    await runDeadlines();
    expect((await queue()).cases.find((c) => c.id === caseId)?.needs_decision).toBe(true);
  });
});

describe("Funktionsschalter", () => {
  it("abgeschaltetes Tauschen wird auch über die API abgelehnt", async () => {
    const admin = { ...(await makeUser("Admin")), role: "admin" as const };
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Tauschbuch", { offers: ["lend", "swap"] });
    await setFlag(admin, "swap", false);
    await expect(svc.requestLoan(lea, { copyId: copy, kind: "swap", swapCopyIds: [] } as never)).rejects.toMatchObject({ status: 403 });
    // Leihen geht weiter
    await expect(svc.requestLoan(lea, { copyId: copy, kind: "lend" })).resolves.toBeTruthy();
  });

  it("nur Admins schalten", async () => {
    const mod = { ...(await makeUser("Mod")), role: "moderator" as const };
    await expect(setFlag(mod, "map", false)).rejects.toMatchObject({ status: 403 });
  });
});
