import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

/** scrypt-Parameter (OWASP-Empfehlung); im Hash gespeichert, damit sie später erhöht werden können */
const N = 32768, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Prüft ein Passwort in konstanter Zeit. Ohne Hash wird trotzdem gerechnet (kein Zeitunterschied). */
export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  const parts = stored?.split("$");
  const ok = parts?.length === 6 && parts[0] === "scrypt";
  const [n, r, p] = ok ? parts!.slice(1, 4).map(Number) : [N, R, P];
  const salt = ok ? Buffer.from(parts![4], "base64url") : randomBytes(16);
  const want = ok ? Buffer.from(parts![5], "base64url") : randomBytes(KEYLEN);
  const got = await scrypt(pw.normalize("NFKC"), salt, want.length, { N: n, r, p, maxmem: 128 * n * r * 2 });
  return ok && got.length === want.length && timingSafeEqual(got, want);
}
