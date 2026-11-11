import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Zufälliges, URL-taugliches Token. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens werden nur als Hash gespeichert (PRD 12). */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sixDigits() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function shortCode(len = 10) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}
