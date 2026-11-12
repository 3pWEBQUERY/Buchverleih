/**
 * Anmeldung per E-Mail-Link oder Passkey, ohne Passwort (PRD 7.7).
 * Mobilnummer per SMS-Code (PRD 6.1): eine Nummer, ein Konto.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { err } from "@/lib/errors";
import { hashToken, randomToken, sixDigits } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { sendMail } from "@/lib/notify/mail";
import { sendSms } from "@/lib/notify/sms";
import { normalizePhone, smsAllowed } from "./phone";
import { safeNext } from "@/lib/safe-next";
import type { SessionUser } from "./session";
import type { Locale } from "@/lib/i18n/locale";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LOGIN_MAIL: Record<Locale, [string, string, string]> = {
  de: ["Dein Anmeldelink", "Mit diesem Link meldest du dich bei Leihregal an. Er ist 20 Minuten gültig und funktioniert einmal.", "Anmelden"],
  fr: ["Ton lien de connexion", "Ce lien te connecte à Leihregal. Il est valable 20 minutes et ne fonctionne qu’une fois.", "Se connecter"],
  it: ["Il tuo link di accesso", "Con questo link accedi a Leihregal. È valido 20 minuti e funziona una sola volta.", "Accedi"],
};

export async function requestEmailLink(rawEmail: string, next?: string | null, l: Locale = "de") {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw err.invalid("Diese E-Mail-Adresse sieht unvollständig aus.");
  await rateLimit(`login:${email}`, 5, 900);
  const token = randomToken(32);
  await sql`insert into login_tokens (email, token_hash, expires_at) values (${email}, ${hashToken(token)}, now() + interval '20 minutes')`;
  const safe = safeNext(next);
  const link = `${env.appUrl}/anmelden/link?token=${token}${safe ? `&next=${encodeURIComponent(safe)}` : ""}`;
  const [subject, text, label] = LOGIN_MAIL[l] ?? LOGIN_MAIL.de;
  await sendMail(email, subject, text, { href: link, label }, l);
  return { devLink: env.showCodes ? link : undefined };
}

/** Löst den Link ein. Neue Adressen erhalten dabei ein Konto. */
export async function verifyEmailLink(token: string, l: Locale = "de") {
  return sql.begin(async (tx) => {
    const [t] = await tx<{ email: string }[]>`
      update login_tokens set used_at = now()
       where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
       returning email`;
    if (!t) throw err.conflict("link_invalid", "Dieser Link ist abgelaufen oder wurde schon verwendet. Fordere einen neuen an.");
    const [existing] = await tx<{ id: string; banned_at: Date | null }[]>`
      select id, banned_at from users where lower(email) = ${t.email} and deleted_at is null`;
    if (existing) {
      await tx`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${existing.id}`;
      return { userId: existing.id, created: false };
    }
    const [u] = await tx<{ id: string }[]>`insert into users (email, email_verified_at, locale) values (${t.email}, now(), ${l}) returning id`;
    return { userId: u.id, created: true };
  });
}

// ---------------------------------------------------------------------------
// Passkeys
// ---------------------------------------------------------------------------

function rp() {
  const url = new URL(env.appUrl);
  return { rpID: url.hostname, origin: url.origin, rpName: "Leihregal" };
}

export async function passkeyRegisterOptions(user: SessionUser) {
  const existing = await sql<{ id: string; transports: string[] }[]>`select id, transports from passkeys where user_id = ${user.id}`;
  const options = await generateRegistrationOptions({
    rpName: rp().rpName,
    rpID: rp().rpID,
    userName: user.email,
    userDisplayName: user.first_name || user.email,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports as never })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await sql`insert into webauthn_challenges (user_id, challenge, purpose, expires_at)
            values (${user.id}, ${options.challenge}, 'register', now() + interval '5 minutes')`;
  return options;
}

export async function passkeyRegisterVerify(user: SessionUser, response: RegistrationResponseJSON, name?: string) {
  const [ch] = await sql<{ id: string; challenge: string }[]>`
    delete from webauthn_challenges where id = (
      select id from webauthn_challenges where user_id = ${user.id} and purpose = 'register' and expires_at > now()
       order by expires_at desc limit 1) returning id, challenge`;
  if (!ch) throw err.conflict("challenge", "Die Anfrage ist abgelaufen. Versuche es erneut.");
  const v = await verifyRegistrationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: rp().origin,
    expectedRPID: rp().rpID,
  });
  if (!v.verified || !v.registrationInfo) throw err.invalid("Der Passkey konnte nicht bestätigt werden.");
  const cred = v.registrationInfo.credential;
  await sql`insert into passkeys (id, user_id, public_key, counter, transports, name)
            values (${cred.id}, ${user.id}, ${Buffer.from(cred.publicKey)}, ${cred.counter}, ${(cred.transports ?? []) as string[]}::text[], ${name ?? "Passkey"})
            on conflict (id) do nothing`;
}

export async function passkeyLoginOptions() {
  const options = await generateAuthenticationOptions({ rpID: rp().rpID, userVerification: "preferred" });
  const [c] = await sql<{ id: string }[]>`
    insert into webauthn_challenges (challenge, purpose, expires_at) values (${options.challenge}, 'login', now() + interval '5 minutes') returning id`;
  return { options, challengeId: c.id };
}

export async function passkeyLoginVerify(challengeId: string, response: AuthenticationResponseJSON) {
  await rateLimit(`passkey:${challengeId}`, 5, 300);
  const [ch] = await sql<{ challenge: string }[]>`
    delete from webauthn_challenges where id = ${challengeId} and purpose = 'login' and expires_at > now() returning challenge`;
  if (!ch) throw err.conflict("challenge", "Die Anfrage ist abgelaufen. Versuche es erneut.");
  const [pk] = await sql<{ id: string; user_id: string; public_key: Buffer; counter: string; transports: string[] }[]>`
    select id, user_id, public_key, counter, transports from passkeys where id = ${response.id}`;
  if (!pk) throw err.invalid("Dieser Passkey ist bei Leihregal nicht bekannt. Melde dich per E-Mail-Link an.");
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: rp().origin,
    expectedRPID: rp().rpID,
    credential: { id: pk.id, publicKey: new Uint8Array(pk.public_key), counter: Number(pk.counter), transports: pk.transports as never },
  });
  if (!v.verified) throw err.invalid("Der Passkey konnte nicht bestätigt werden.");
  await sql`update passkeys set counter = ${v.authenticationInfo.newCounter}, last_used_at = now() where id = ${pk.id}`;
  return pk.user_id;
}

// ---------------------------------------------------------------------------
// Mobilnummer
// ---------------------------------------------------------------------------

export async function requestPhoneCode(user: SessionUser, raw: string, ip = "unbekannt") {
  const phone = normalizePhone(raw);
  if (!phone) throw err.invalid("Gib eine Mobilnummer ein, zum Beispiel 079 123 45 67.");
  if (!smsAllowed(phone)) throw err.invalid("Möglich sind Mobilnummern aus der Schweiz und Liechtenstein.");
  await rateLimit(`sms:${user.id}`, 4, 3600);
  // Gegen SMS-Pumping über viele Konten: pro IP und insgesamt pro Tag gedeckelt
  await rateLimit(`smsip:${ip}`, 10, 86400);
  await rateLimit("sms:global", 1000, 86400);
  const [banned] = await sql<{ n: number }[]>`select count(*)::int as n from banned_phones where phone_e164 = ${phone}`;
  if (banned.n) throw err.conflict("phone_banned", "Diese Nummer kann nicht verwendet werden. Melde dich bei der Moderation, wenn du das für einen Fehler hältst.");
  const [taken] = await sql<{ n: number }[]>`
    select count(*)::int as n from users where phone_e164 = ${phone} and phone_verified_at is not null and id <> ${user.id} and deleted_at is null`;
  if (taken.n) throw err.conflict("phone_taken", "Diese Nummer gehört bereits zu einem anderen Konto. Eine Nummer, ein Konto.");
  const code = sixDigits();
  await sql`insert into phone_verifications (user_id, phone_e164, code_hash, expires_at)
            values (${user.id}, ${phone}, ${hashToken(`${user.id}:${code}`)}, now() + interval '10 minutes')`;
  await sendSms(phone, `Dein Leihregal-Code: ${code}. Gültig 10 Minuten.`);
  return { devCode: env.showCodes ? code : undefined };
}

export async function verifyPhoneCode(user: SessionUser, code: string) {
  await rateLimit(`smsverify:${user.id}`, 10, 3600);
  const [v] = await sql<{ id: string; phone_e164: string; code_hash: string; attempts: number }[]>`
    select id, phone_e164, code_hash, attempts from phone_verifications
     where user_id = ${user.id} and verified_at is null and expires_at > now()
     order by created_at desc limit 1`;
  if (!v) throw err.conflict("no_code", "Der Code ist abgelaufen. Fordere einen neuen an.");
  if (v.attempts >= 5) throw err.tooMany("Zu viele Versuche. Fordere einen neuen Code an.");
  if (v.code_hash !== hashToken(`${user.id}:${code.replace(/\D/g, "")}`)) {
    // ausserhalb einer Transaktion, damit der Fehlversuch bestehen bleibt
    await sql`update phone_verifications set attempts = attempts + 1 where id = ${v.id}`;
    throw err.invalid("Der Code stimmt nicht. Prüfe die sechs Ziffern aus der SMS.");
  }
  return sql.begin(async (tx) => {
    const [ok] = await tx<{ id: string }[]>`
      update phone_verifications set verified_at = now()
       where id = ${v.id} and verified_at is null and attempts < 5 returning id`;
    if (!ok) throw err.conflict("no_code", "Der Code ist abgelaufen. Fordere einen neuen an.");
    await tx`update users set phone_e164 = ${v.phone_e164}, phone_verified_at = now() where id = ${user.id}`;
  });
}
