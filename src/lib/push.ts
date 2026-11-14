import { apnsToUser } from "@/lib/apns";
import webpush from "web-push";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Web-Push (PRD 7.6). Die VAPID-Schlüssel erzeugt der Server beim ersten Bedarf selbst und
 * legt sie in der Datenbank ab; mit VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY lassen sie sich vorgeben.
 */
let cached: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys() {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return (cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY });
  }
  const fresh = webpush.generateVAPIDKeys();
  // Bei gleichzeitigem Erzeugen gewinnt der erste Eintrag
  await sql`insert into app_keys (name, public, private) values ('vapid', ${fresh.publicKey}, ${fresh.privateKey}) on conflict (name) do nothing`;
  const [k] = await sql<{ public: string; private: string }[]>`select public, private from app_keys where name = 'vapid'`;
  return (cached = { publicKey: k.public, privateKey: k.private });
}

/**
 * Nur bekannte Push-Dienste der Browser (Chrome/Edge über FCM, Firefox, Safari, Windows).
 * Sonst könnte ein Konto den Server beliebige Adressen anfragen lassen (SSRF) oder den Worker mit
 * absichtlich langsamen Servern aufhalten.
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com", "web.push.apple.com"];
const PUSH_SUFFIXES = [".push.apple.com", ".notify.windows.com", ".push.services.mozilla.com"];

export function isAllowedPushEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_SUFFIXES.some((x) => host.endsWith(x));
}

export async function subscribe(u: SessionUser, s: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  if (!isAllowedPushEndpoint(s.endpoint)) throw err.invalid("Ungültiger Push-Endpunkt.");
  // Ein Endpunkt wechselt das Konto nur, wenn dasselbe Gerät ihn meldet (gleiche Schlüssel).
  // Abmelden löscht die Sitzung und damit das Abo; danach ist der Endpunkt ohnehin frei.
  const rows = await sql`
    insert into push_subscriptions (user_id, session_id, endpoint, p256dh, auth, user_agent)
    values (${u.id}, ${u.session_id}, ${s.endpoint}, ${s.p256dh}, ${s.auth}, ${userAgent?.slice(0, 200) ?? null})
    on conflict (endpoint) do update set user_id = excluded.user_id, session_id = excluded.session_id,
      p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, failures = 0
     where push_subscriptions.user_id = excluded.user_id
        or (push_subscriptions.p256dh = excluded.p256dh and push_subscriptions.auth = excluded.auth)
    returning id`;
  if (!rows.length) throw err.conflict("push_taken", "Dieses Gerät ist noch mit einem anderen Konto verbunden. Melde es dort zuerst ab.");
  // Höchstens 10 Geräte pro Konto; die ältesten fallen weg
  await sql`delete from push_subscriptions where user_id = ${u.id} and id not in (
              select id from push_subscriptions where user_id = ${u.id} order by created_at desc limit 10)`;
}

export async function unsubscribe(u: SessionUser, endpoint: string) {
  await sql`delete from push_subscriptions where user_id = ${u.id} and endpoint = ${endpoint}`;
}

export async function deviceCount(userId: string) {
  const [r] = await sql<{ n: number }[]>`
    select (select count(*)::int from push_subscriptions where user_id = ${userId})
         + (select count(*)::int from apns_devices where user_id = ${userId}) as n`;
  return r.n;
}

export type PushMessage = { title: string; body: string; href: string; tag?: string };

/** Harte Obergrenze pro Gerät, unabhängig davon, ob der Server tröpfchenweise antwortet */
const SEND_DEADLINE_MS = 5_000;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`Zeitlimit ${ms} ms`), { statusCode: undefined })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** Schickt eine Nachricht an alle Geräte eines Kontos, parallel. Abgelaufene Abos werden entfernt. */
export async function pushToUser(userId: string, msg: PushMessage) {
  // iOS-App (APNs) und Web-Push parallel
  const [ios, web] = await Promise.all([apnsToUser(userId, msg), webPushToUser(userId, msg)]);
  return { sent: ios.sent + web.sent };
}

async function webPushToUser(userId: string, msg: PushMessage) {
  const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`;
  if (!subs.length) return { sent: 0 };
  const keys = await vapidKeys();
  const subject = env.appUrl.startsWith("https://") ? env.appUrl : "https://leihregal.ch";
  const payload = JSON.stringify(msg);
  const results = await Promise.allSettled(subs.map(async (s) => {
    // Alte Abos von vor der Liste nicht mehr anfragen
    if (!isAllowedPushEndpoint(s.endpoint)) {
      await sql`delete from push_subscriptions where id = ${s.id}`;
      return false;
    }
    try {
      await withDeadline(webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 60 * 60 * 24,
        urgency: "normal",
        topic: msg.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
        timeout: SEND_DEADLINE_MS,
      }), SEND_DEADLINE_MS + 500);
      await sql`update push_subscriptions set failures = 0, last_ok_at = now() where id = ${s.id}`;
      return true;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await sql`delete from push_subscriptions where id = ${s.id}`;
      } else {
        console.error("[push]", status ?? "", (e as Error).message);
        await sql`update push_subscriptions set failures = failures + 1 where id = ${s.id}`;
        await sql`delete from push_subscriptions where id = ${s.id} and failures >= 8`;
      }
      return false;
    }
  }));
  return { sent: results.filter((r) => r.status === "fulfilled" && r.value).length };
}
