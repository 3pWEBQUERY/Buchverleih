/**
 * Apple Push Notification service (APNs) für die iOS-App – HTTP/2 mit tokenbasierter Anmeldung (JWT, ES256).
 *
 * Variablen (nur auf Railway setzen, nie im Code):
 *   APNS_KEY     Inhalt der .p8-Datei aus dem Apple-Developer-Konto («Keys» → Apple Push Notifications service)
 *   APNS_KEY_ID  Schlüssel-ID (10 Zeichen)
 *   APNS_TEAM_ID Team-ID (10 Zeichen)
 *   APNS_TOPIC   Bundle-ID der App (Standard ch.leihregal.app)
 * Ohne diese Variablen ist APNs aus; Web-Push läuft unverändert weiter.
 */
import { connect, constants, type ClientHttp2Session } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";
import { sql } from "@/lib/db";

const HOSTS = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;
type Env = keyof typeof HOSTS;

export function apnsConfigured() {
  return Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
}

function topic() {
  return process.env.APNS_TOPIC || "ch.leihregal.app";
}

/** JWT gilt bei Apple höchstens 60 Minuten; wir erneuern nach 50 */
let cachedJwt: { token: string; at: number } | null = null;
export function providerToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.at < 50 * 60) return cachedJwt.token;
  const pem = (process.env.APNS_KEY ?? "").replace(/\\n/g, "\n");
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: process.env.APNS_KEY_ID });
  const claims = b64({ iss: process.env.APNS_TEAM_ID, iat: now });
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" }).toString("base64url");
  cachedJwt = { token: `${head}.${claims}.${sig}`, at: now };
  return cachedJwt.token;
}

const sessions: Partial<Record<Env, ClientHttp2Session>> = {};
function session(env: Env) {
  const s = sessions[env];
  if (s && !s.closed && !s.destroyed) return s;
  const n = connect(HOSTS[env]);
  n.on("error", () => { delete sessions[env]; });
  n.on("close", () => { delete sessions[env]; });
  n.setTimeout(60_000, () => n.close());
  sessions[env] = n;
  return n;
}

function post(env: Env, token: string, headers: Record<string, string>, body: string): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve) => {
    const req = session(env).request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
      authorization: `bearer ${providerToken()}`,
      "apns-topic": topic(),
      "apns-push-type": "alert",
      "apns-priority": "10",
      ...headers,
    });
    let status = 0;
    let data = "";
    const timer = setTimeout(() => { req.close(); resolve({ status: 0, reason: "Timeout" }); }, 8_000);
    req.on("response", (h) => { status = Number(h[":status"] ?? 0); });
    req.setEncoding("utf8");
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      clearTimeout(timer);
      let reason: string | undefined;
      try { reason = data ? (JSON.parse(data) as { reason?: string }).reason : undefined; } catch {}
      resolve({ status, reason });
    });
    req.on("error", () => { clearTimeout(timer); resolve({ status: 0, reason: "Verbindung" }); });
    req.end(body);
  });
}

export type ApnsMessage = { title: string; body: string; href: string; tag?: string };

/** An alle iOS-Geräte eines Kontos. Ungültige Geräte werden entfernt. */
export async function apnsToUser(userId: string, msg: ApnsMessage) {
  if (!apnsConfigured()) return { sent: 0 };
  const devices = await sql<{ id: string; token: string; environment: Env }[]>`
    select id, token, environment from apns_devices where user_id = ${userId}`;
  if (!devices.length) return { sent: 0 };
  const [u] = await sql<{ n: number }[]>`
    select count(*)::int as n from notifications where user_id = ${userId} and channel = 'app' and read_at is null`;
  const loanId = msg.href.match(/^\/vorgaenge\/([0-9a-f-]{36})/)?.[1];
  const payload = JSON.stringify({
    aps: { alert: { title: msg.title, body: msg.body }, sound: "default", badge: u?.n ?? 0, "thread-id": msg.tag ?? "leihregal" },
    href: msg.href,
    ...(loanId ? { loanId } : {}),
  });
  const headers: Record<string, string> = msg.tag ? { "apns-collapse-id": msg.tag.slice(0, 64) } : {};
  let sent = 0;
  await Promise.all(devices.map(async (d) => {
    const r = await post(d.environment, d.token, headers, payload);
    if (r.status === 200) {
      sent++;
      await sql`update apns_devices set failures = 0, last_ok_at = now() where id = ${d.id}`;
    } else if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered" || r.reason === "DeviceTokenNotForTopic") {
      await sql`delete from apns_devices where id = ${d.id}`;
    } else {
      console.error("[apns]", r.status, r.reason ?? "");
      await sql`update apns_devices set failures = failures + 1 where id = ${d.id}`;
      await sql`delete from apns_devices where id = ${d.id} and failures >= 8`;
    }
  }));
  return { sent };
}

export async function registerApns(userId: string, sessionId: string | null, token: string, environment: Env) {
  await sql`
    insert into apns_devices (user_id, session_id, token, environment) values (${userId}, ${sessionId}, ${token}, ${environment})
    on conflict (token) do update set user_id = excluded.user_id, session_id = excluded.session_id,
      environment = excluded.environment, failures = 0`;
}

export async function unregisterApns(userId: string, token: string) {
  await sql`delete from apns_devices where user_id = ${userId} and token = ${token}`;
}
