import { registerApns, unregisterApns } from "@/lib/apns";
import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { rateLimit } from "@/lib/ratelimit";
import { deviceCount, subscribe, unsubscribe, vapidKeys } from "@/lib/push";

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** GET /api/v1/push?endpoint= – öffentlicher Schlüssel, Zahl der Geräte und ob dieses Gerät angemeldet ist */
export const GET = route(async (req) => {
  const u = await requireUser();
  const q = query(req, z.object({ endpoint: z.string().url().max(1000).optional() }));
  const { publicKey } = await vapidKeys();
  const [mine] = q.endpoint
    ? await sql<{ ok: boolean }[]>`select true as ok from push_subscriptions where user_id = ${u.id} and endpoint = ${q.endpoint}`
    : [];
  return { publicKey, devices: await deviceCount(u.id), thisDevice: !!mine };
});

const apns = z.object({ apnsToken: z.string().regex(/^[0-9a-fA-F]{64,200}$/), environment: z.enum(["sandbox", "production"]).default("production") });

/**
 * POST /api/v1/push – Gerät anmelden: Web ({ endpoint, keys }) oder iOS-App ({ apnsToken, environment }),
 * oder Test senden ({ test: true })
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.union([sub, apns, z.object({ test: z.literal(true) })]));
  if ("apnsToken" in b) {
    await rateLimit(`pushsub:${u.id}`, 30, 3600);
    await registerApns(u.id, u.session_id, b.apnsToken.toLowerCase(), b.environment);
    return { devices: await deviceCount(u.id) };
  }
  if ("test" in b) {
    await rateLimit(`pushtest:${u.id}`, 5, 600);
    await enqueue(sql, "send_push_test", { userId: u.id });
    return { queued: true };
  }
  await rateLimit(`pushsub:${u.id}`, 30, 3600);
  await subscribe(u, { endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth }, req.headers.get("user-agent"));
  return { devices: await deviceCount(u.id) };
});

/** DELETE /api/v1/push – Gerät abmelden ({ endpoint } oder { apnsToken }) */
export const DELETE = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.union([z.object({ endpoint: z.string().url().max(1000) }), z.object({ apnsToken: z.string().regex(/^[0-9a-fA-F]{64,200}$/) })]));
  if ("apnsToken" in b) await unregisterApns(u.id, b.apnsToken.toLowerCase());
  else await unsubscribe(u, b.endpoint);
  return { devices: await deviceCount(u.id) };
});
