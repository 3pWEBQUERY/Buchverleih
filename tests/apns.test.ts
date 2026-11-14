/**
 * Push für die iOS-App: Signatur des Anbieter-Tokens (ES256) und Geräteverwaltung gegen echtes Postgres.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { sql } from "@/lib/db";
import { apnsConfigured, apnsToUser, providerToken, registerApns, unregisterApns } from "@/lib/apns";
import { deviceCount } from "@/lib/push";
import { makeUser, reset } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("APNs", () => {
  it("signiert das Anbieter-Token gültig mit ES256", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    process.env.APNS_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    process.env.APNS_KEY_ID = "ABC123DEFG";
    process.env.APNS_TEAM_ID = "CY2659G6Q3";
    expect(apnsConfigured()).toBe(true);
    const [h, c, s] = providerToken().split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "ABC123DEFG" });
    expect(JSON.parse(Buffer.from(c, "base64url").toString()).iss).toBe("CY2659G6Q3");
    const ok = verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
    delete process.env.APNS_KEY; delete process.env.APNS_KEY_ID; delete process.env.APNS_TEAM_ID;
  });

  it("meldet Geräte an und ab; ohne Schlüssel wird nichts gesendet", async () => {
    const u = await makeUser("Ivo");
    const token = "a".repeat(64);
    await registerApns(u.id, null, token, "sandbox");
    await registerApns(u.id, null, token, "production"); // gleiches Gerät: aktualisiert statt doppelt
    expect(await deviceCount(u.id)).toBe(1);
    expect((await apnsToUser(u.id, { title: "T", body: "B", href: "/" })).sent).toBe(0);
    await unregisterApns(u.id, token);
    expect(await deviceCount(u.id)).toBe(0);
  });
});
