/**
 * Anmeldung mit Passwort gegen echtes Postgres: Registrieren, Anmelden, Übernahme per Link.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { loginWithPassword, registerWithPassword, setPassword, verifyEmailLink } from "@/lib/auth/flows";
import { hashToken } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("Passwort-Hash", () => {
  it("speichert nie Klartext und prüft korrekt", async () => {
    const h = await hashPassword("geheim-123");
    expect(h).toMatch(/^scrypt\$\d+\$\d+\$\d+\$/);
    expect(h).not.toContain("geheim-123");
    expect(await verifyPassword("geheim-123", h)).toBe(true);
    expect(await verifyPassword("geheim-124", h)).toBe(false);
    expect(await verifyPassword("geheim-123", null)).toBe(false);
    expect(await verifyPassword("geheim-123", "kaputt")).toBe(false);
  });
});

describe("Registrieren und Anmelden mit Passwort", () => {
  it("legt ein Konto an, das bis zum Link unbestätigt bleibt", async () => {
    const r = await registerWithPassword("  Mira@Example.org ", "lesen-ist-toll");
    expect(r.created).toBe(true);
    const [u] = await sql<{ email: string; email_verified_at: Date | null; password_hash: string }[]>`
      select email, email_verified_at, password_hash from users where id = ${r.userId}`;
    expect(u.email).toBe("mira@example.org");
    expect(u.email_verified_at).toBeNull();
    expect(u.password_hash).toMatch(/^scrypt\$/);

    const login = await loginWithPassword("MIRA@example.org", "lesen-ist-toll");
    expect(login.userId).toBe(r.userId);
  });

  it("lehnt zu kurze Passwörter, doppelte Adressen und falsche Angaben ab", async () => {
    await expect(registerWithPassword("a@example.org", "kurz")).rejects.toThrow(/mindestens 8/);
    await expect(registerWithPassword("keine-adresse", "lang-genug-1")).rejects.toThrow(/unvollständig/);
    await registerWithPassword("a@example.org", "lang-genug-1");
    await expect(registerWithPassword("A@example.org", "lang-genug-2")).rejects.toThrow(/schon ein Konto/);
    // Gleiche Meldung für falsches Passwort und unbekannte Adresse
    await expect(loginWithPassword("a@example.org", "falsch-falsch")).rejects.toThrow(/stimmt nicht/);
    await expect(loginWithPassword("niemand@example.org", "egal-egal")).rejects.toThrow(/stimmt nicht/);
  });

  it("Konten ohne Passwort (nur Link) lassen sich nicht per Passwort öffnen", async () => {
    const [u] = await sql<{ id: string }[]>`insert into users (email, email_verified_at) values ('link@example.org', now()) returning id`;
    await expect(loginWithPassword("link@example.org", "irgendwas-1")).rejects.toThrow(/stimmt nicht/);
    await setPassword(u.id, "jetzt-mit-passwort");
    expect((await loginWithPassword("link@example.org", "jetzt-mit-passwort")).userId).toBe(u.id);
  });

  it("wer die Adresse per Link bestätigt, übernimmt das Konto; ein fremdes Passwort verfällt", async () => {
    const r = await registerWithPassword("besetzt@example.org", "fremdes-passwort");
    // Anmeldelink wie aus der Mail (gespeichert wird nur der Hash)
    const token = "t".repeat(43);
    await sql`insert into login_tokens (email, token_hash, expires_at) values ('besetzt@example.org', ${hashToken(token)}, now() + interval '20 minutes')`;
    const v = await verifyEmailLink(token);
    expect(v.userId).toBe(r.userId);
    const [u] = await sql<{ email_verified_at: Date | null; password_hash: string | null }[]>`
      select email_verified_at, password_hash from users where id = ${r.userId}`;
    expect(u.email_verified_at).not.toBeNull();
    expect(u.password_hash).toBeNull();
    await expect(loginWithPassword("besetzt@example.org", "fremdes-passwort")).rejects.toThrow(/stimmt nicht/);
  });
});

describe("Einmal-Passwort durch Admins", () => {
  it("nur Admins erzeugen es; danach klappt die Anmeldung damit", async () => {
    const { makeUser } = await import("./helpers");
    const { temporaryPassword } = await import("@/lib/moderation");
    const admin = await makeUser("Ada");
    const moderator = await makeUser("Mo");
    const alt = await makeUser("Alt");
    await sql`update users set role = 'admin' where id = ${admin.id}`;
    await sql`update users set role = 'moderator' where id = ${moderator.id}`;
    const [{ email }] = await sql<{ email: string }[]>`select email from users where id = ${alt.id}`;

    await expect(temporaryPassword({ ...moderator, role: "moderator" }, alt.id)).rejects.toThrow(/nur Admins/);
    const pw = await temporaryPassword({ ...admin, role: "admin" }, alt.id);
    expect(pw).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect((await loginWithPassword(email, pw)).userId).toBe(alt.id);
    const [l] = await sql<{ n: number }[]>`select count(*)::int as n from moderation_log where action = 'temp_password' and target_id = ${alt.id}`;
    expect(l.n).toBe(1);
  });
});
