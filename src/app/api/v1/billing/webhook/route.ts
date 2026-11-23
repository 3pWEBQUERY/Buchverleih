import { NextResponse } from "next/server";
import { handleEvent, stripe } from "@/lib/billing";

/**
 * POST /api/v1/billing/webhook – Ereignisse von Stripe. Nicht über route(): kommt von Stripe, nicht aus
 * dem Browser. Die Signatur (STRIPE_WEBHOOK_SECRET) ist Pflicht; ohne gültige Signatur wird nichts verarbeitet.
 */
export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "billing_off" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const payload = await req.text();
  if (!sig || payload.length > 1_000_000) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let event;
  try {
    event = await s.webhooks.constructEventAsync(payload, sig, secret);
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }
  try {
    await handleEvent(event);
  } catch (e) {
    console.error("[billing] webhook", event.type, (e as Error).message);
    // 500: Stripe versucht es später erneut; das Ereignis ist noch nicht als verarbeitet markiert
    const { sql } = await import("@/lib/db");
    await sql`delete from billing_events where id = ${event.id}`.catch(() => {});
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
export const dynamic = "force-dynamic";
