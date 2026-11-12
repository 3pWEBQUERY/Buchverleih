/**
 * Anmeldung per E-Mail-Link, Passkey oder Passwort (PRD 7.7; Passwort, solange kein Mailversand läuft).
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
import { hashPassword, verifyPassword, PASSWORD_MAX, PASSWORD_MIN } from "./password";
import { safeNext } from "@/lib/safe-next";
import type { SessionUser } from "./session";
import type { Locale } from "@/lib/i18n/locale";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LOGIN_MAIL: Record<Locale, [string, string, string]> = {
  de: ["Dein Anmeldelink", "Mit diesem Link meldest du dich bei Leihregal an. Er ist 20 Minuten gültig und funktioniert einmal.", "Anmelden"],
  fr: ["Ton lien de connexion", "Ce lien te connecte à Leihregal. Il est valable 20 minutes et ne fonctionne qu’une fois.", "Se connecter"],
  it: ["Il tuo link di accesso", "Con questo link accedi a Leihregal. È valido 20 minuti e funziona una sola volta.", "Accedi"],
};

/**
 * Fordert einen Anmeldelink an. `app`: angefordert aus der iOS-App – der Link trägt dann `app=1`,
 * und die Linkseite bietet «In der App öffnen» an (leihregal://anmelden/link?token=…).
 */
export async function requestEmailLink(rawEmail: string, next?: string | null, l: Locale = "de", app = false) {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw err.invalid("Diese E-Mail-Adresse sieht unvollständig aus.");
  await rateLimit(`login:${email}`, 5, 900);
  const token = randomToken(32);
  await sql`insert into login_tokens (email, token_hash, expires_at) values (${email}, ${hashToken(token)}, now() + interval '20 minutes')`;
  const safe = safeNext(next);
  const link = `${env.appUrl}/anmelden/link?token=${token}${safe ? `&next=${encodeURIComponent(safe)}` : ""}${app ? "&app=1" : ""}`;
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
      // Erste Bestätigung der Adresse: Ein Passwort, das jemand ohne Nachweis gesetzt hat, gilt nicht mehr
      await tx`update users set password_hash = case when email_verified_at is null then null else password_hash end,
                                email_verified_at = coalesce(email_verified_at, now())
                where id = ${existing.id}`;
      return { userId: existing.id, created: false };
    }
    const [u] = await tx<{ id: string }[]>`insert into users (email, email_verified_at, locale) values (${t.email}, now(), ${l}) returning id`;
    return { userId: u.id, created: true };
  });
}

// ---------------------------------------------------------------------------
// Passwort (ohne Mail- oder SMS-Versand nutzbar)
// ---------------------------------------------------------------------------

function checkPassword(pw: string) {
  if (pw.length < PASSWORD_MIN) throw err.invalid("Das Passwort braucht mindestens 8 Zeichen.");
  if (pw.length > PASSWORD_MAX) throw err.invalid("Das Passwort ist zu lang.");
}

/** Konto mit E-Mail-Adresse und Passwort anlegen. Die Adresse gilt bis zum ersten Link als unbestätigt. */
export async function registerWithPassword(rawEmail: string, password: string, l: Locale = "de") {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw err.invalid("Diese E-Mail-Adresse sieht unvollständig aus.");
  checkPassword(password);
  await rateLimit(`register:${email}`, 5, 3600);
  const hash = await hashPassword(password);
  return sql.begin(async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from users where lower(email) = ${email} and deleted_at is null`;
    if (existing) throw err.conflict("account_exists", "Zu dieser E-Mail-Adresse gibt es schon ein Konto. Melde dich an.");
    const [u] = await tx<{ id: string }[]>`
      insert into users (email, locale, password_hash) values (${email}, ${l}, ${hash}) returning id`;
    return { userId: u.id, created: true };
  });
}

/** Anmelden mit E-Mail-Adresse und Passwort. Gleiche Meldung für unbekannte Adresse und falsches Passwort. */
export async function loginWithPassword(rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  await rateLimit(`pwlogin:${email}`, 10, 900);
  const [u] = await sql<{ id: string; password_hash: string | null }[]>`
    select id, password_hash from users where lower(email) = ${email} and deleted_at is null`;
  const ok = await verifyPassword(password.slice(0, PASSWORD_MAX), u?.password_hash ?? null);
  if (!u || !ok) throw err.invalid("E-Mail-Adresse oder Passwort stimmt nicht.");
  return { userId: u.id, created: false };
}

/** Passwort für ein bestehendes Konto setzen oder ändern (angemeldet) */
export async function setPassword(userId: string, password: string) {
  checkPassword(password);
  await sql`update users set password_hash = ${await hashPassword(password)} where id = ${userId}`;
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
  const code = sixDigits();
  await sql`insert into phone_verifications (user_id, phone_e164, code_hash, expires_at)
            values (${user.id}, ${phone}, ${hashToken(`${user.id}:${code}`)}, now() + interval '10 minutes')`;
  // Gehört die Nummer schon einem anderen Konto, geht keine SMS raus – die Antwort ist aber dieselbe,
  // damit sich nicht abfragen lässt, welche Nummern registriert sind. Die Bestätigung scheitert später.
  if (!(await phoneTaken(phone, user.id))) await sendSms(phone, `Dein Leihregal-Code: ${code}. Gültig 10 Minuten.`);
  return { devCode: env.showCodes ? code : undefined };
}

async function phoneTaken(phone: string, userId: string) {
  const [taken] = await sql<{ n: number }[]>`
    select count(*)::int as n from users where phone_e164 = ${phone} and phone_verified_at is not null and id <> ${userId} and deleted_at is null`;
  return taken.n > 0;
}

const WRONG_CODE = "Der Code stimmt nicht. Prüfe die sechs Ziffern aus der SMS.";

export async function verifyPhoneCode(user: SessionUser, code: string) {
  await rateLimit(`smsverify:${user.id}`, 10, 3600);
  const [v] = await sql<{ id: string; phone_e164: string; code_hash: string; attempts: number }[]>`
    select id, phone_e164, code_hash, attempts from phone_verifications
     where user_id = ${user.id} and verified_at is null and expires_at > now()
     order by created_at desc limit 1`;
  if (!v) throw err.conflict("no_code", "Der Code ist abgelaufen. Fordere einen neuen an.");
  if (v.attempts >= 5) throw err.tooMany("Zu viele Versuche. Fordere einen neuen Code an.");
  // Fremde Nummer: wie ein falscher Code behandeln (verrät nicht, dass sie registriert ist)
  if (v.code_hash !== hashToken(`${user.id}:${code.replace(/\D/g, "")}`) || (await phoneTaken(v.phone_e164, user.id))) {
    // ausserhalb einer Transaktion, damit der Fehlversuch bestehen bleibt
    await sql`update phone_verifications set attempts = attempts + 1 where id = ${v.id}`;
    throw err.invalid(WRONG_CODE);
  }
  try {
    return await sql.begin(async (tx) => {
      const [ok] = await tx<{ id: string }[]>`
        update phone_verifications set verified_at = now()
         where id = ${v.id} and verified_at is null and attempts < 5 returning id`;
      if (!ok) throw err.conflict("no_code", "Der Code ist abgelaufen. Fordere einen neuen an.");
      await tx`update users set phone_e164 = ${v.phone_e164}, phone_verified_at = now() where id = ${user.id}`;
    });
  } catch (e) {
    // Gleichzeitig von einem anderen Konto bestätigt (eindeutiger Index): ebenfalls neutral antworten
    if ((e as { code?: string }).code === "23505") throw err.invalid(WRONG_CODE);
    throw e;
  }
}
