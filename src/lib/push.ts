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

export async function subscribe(u: SessionUser, s: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  const url = new URL(s.endpoint);
  if (url.protocol !== "https:") throw err.invalid("Ungültiger Push-Endpunkt.");
  // Ein Endpunkt gehört immer dem zuletzt angemeldeten Konto auf diesem Gerät
  await sql`
    insert into push_subscriptions (user_id, session_id, endpoint, p256dh, auth, user_agent)
    values (${u.id}, ${u.session_id}, ${s.endpoint}, ${s.p256dh}, ${s.auth}, ${userAgent?.slice(0, 200) ?? null})
    on conflict (endpoint) do update set user_id = excluded.user_id, session_id = excluded.session_id,
      p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, failures = 0`;
  // Höchstens 10 Geräte pro Konto; die ältesten fallen weg
  await sql`delete from push_subscriptions where user_id = ${u.id} and id not in (
              select id from push_subscriptions where user_id = ${u.id} order by created_at desc limit 10)`;
}

export async function unsubscribe(u: SessionUser, endpoint: string) {
  await sql`delete from push_subscriptions where user_id = ${u.id} and endpoint = ${endpoint}`;
}

export async function deviceCount(userId: string) {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from push_subscriptions where user_id = ${userId}`;
  return r.n;
}

export type PushMessage = { title: string; body: string; href: string; tag?: string };

/** Schickt eine Nachricht an alle Geräte eines Kontos. Abgelaufene Abos werden entfernt. */
export async function pushToUser(userId: string, msg: PushMessage) {
  const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`;
  if (!subs.length) return { sent: 0 };
  const keys = await vapidKeys();
  const subject = env.appUrl.startsWith("https://") ? env.appUrl : "https://leihregal.ch";
  const payload = JSON.stringify(msg);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 60 * 60 * 24,
        urgency: "normal",
        topic: msg.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
        timeout: 10_000,
      });
      sent++;
      await sql`update push_subscriptions set failures = 0, last_ok_at = now() where id = ${s.id}`;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await sql`delete from push_subscriptions where id = ${s.id}`;
      } else {
        console.error("[push]", status ?? "", (e as Error).message);
        await sql`update push_subscriptions set failures = failures + 1 where id = ${s.id}`;
        await sql`delete from push_subscriptions where id = ${s.id} and failures >= 8`;
      }
    }
  }
  return { sent };
}
