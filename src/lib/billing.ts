/**
 * Bezahlung über Stripe (PRD 11, Phase 3): Fördermitgliedschaft (Konto) und Kreise für Organisationen.
 * Die Leihe selbst bleibt kostenlos. Ohne STRIPE_SECRET_KEY ist alles abgeschaltet und die Oberfläche
 * zeigt die Angebote als «bald verfügbar».
 *
 * Ablauf: Checkout-Sitzung (Abo) → Stripe ruft den Webhook → Abo wird gespeichert → Plan des Kontos
 * oder Kreises wird gesetzt. Kündigen und Zahlungsmittel ändern laufen über das Kundenportal von Stripe.
 */
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
export const billingEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

export type PriceKey = "supporter_month" | "supporter_year" | "org_month" | "shipping_fee";
export async function prices(): Promise<Record<PriceKey, number>> {
  const rows = await sql<{ key: PriceKey; amount: number }[]>`select key, amount from prices`;
  return Object.fromEntries(rows.map((r) => [r.key, r.amount])) as Record<PriceKey, number>;
}

export async function setPrice(admin: SessionUser, key: PriceKey, amount: number) {
  if (admin.role !== "admin") throw err.forbidden("Preise ändern nur Admins.");
  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000) throw err.invalid("Der Betrag ist ungültig.");
  await sql`update prices set amount = ${amount}, updated_at = now() where key = ${key}`;
  await sql`insert into moderation_log (moderator_id, action, target_type, target_id, note)
            values (${admin.id}, 'price_changed', 'price', ${key}, ${String(amount)})`;
}

const ACTIVE = ["active", "trialing", "past_due"];

async function customerFor(s: Stripe, user: SessionUser) {
  const [u] = await sql<{ stripe_customer_id: string | null }[]>`select stripe_customer_id from users where id = ${user.id}`;
  if (u?.stripe_customer_id) return u.stripe_customer_id;
  const c = await s.customers.create({ email: user.email, name: user.first_name ?? undefined, metadata: { user_id: user.id } });
  await sql`update users set stripe_customer_id = ${c.id} where id = ${user.id}`;
  return c.id;
}

export type CheckoutInput = { kind: "supporter"; interval: "month" | "year" } | { kind: "organization"; circleId: string };

/** Checkout-Sitzung für ein Abo; liefert die URL der Bezahlseite von Stripe */
export async function startCheckout(user: SessionUser, input: CheckoutInput, locale = "de") {
  const s = stripe();
  if (!s) throw err.conflict("billing_off", "Bezahlen ist noch nicht eingerichtet.");
  const p = await prices();
  let name: string;
  let amount: number;
  let interval: "month" | "year";
  let back: string;
  const metadata: Record<string, string> = { user_id: user.id, kind: input.kind };
  if (input.kind === "supporter") {
    const [active] = await sql`select 1 from subscriptions where user_id = ${user.id} and kind = 'supporter' and status = any(${ACTIVE})`;
    if (active) throw err.conflict("already_supporter", "Du bist schon Fördermitglied. Danke!");
    interval = input.interval;
    amount = interval === "year" ? p.supporter_year : p.supporter_month;
    name = "Leihregal Fördermitgliedschaft";
    back = "/einstellungen#foerdern";
  } else {
    const [c] = await sql<{ name: string }[]>`
      select ci.name from circles ci join circle_members m on m.circle_id = ci.id
       where ci.id = ${input.circleId} and m.user_id = ${user.id} and m.role = 'admin' and m.status = 'active'`;
    if (!c) throw err.forbidden("Nur Admins des Kreises können ihn als Organisation führen.");
    const [active] = await sql`select 1 from subscriptions where circle_id = ${input.circleId} and kind = 'organization' and status = any(${ACTIVE})`;
    if (active) throw err.conflict("already_org", "Dieser Kreis ist schon als Organisation eingerichtet.");
    interval = "month";
    amount = p.org_month;
    name = `Leihregal für Organisationen: ${c.name}`;
    metadata.circle_id = input.circleId;
    back = `/kreise/${input.circleId}#organisation`;
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(s, user),
    line_items: [{ quantity: 1, price_data: { currency: "chf", unit_amount: amount, recurring: { interval }, product_data: { name } } }],
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: true,
    locale: (["de", "fr", "it", "en"].includes(locale) ? locale : "de") as Stripe.Checkout.SessionCreateParams.Locale,
    success_url: `${env.appUrl}${back.split("#")[0]}?bezahlt=1#${back.split("#")[1] ?? ""}`,
    cancel_url: `${env.appUrl}${back}`,
  });
  if (!session.url) throw err.conflict("billing_failed", "Die Bezahlseite konnte nicht geöffnet werden.");
  return session.url;
}

/** Kundenportal: Abo kündigen, Zahlungsmittel und Rechnungsadresse ändern, Belege */
export async function portalUrl(user: SessionUser, returnPath: string) {
  const s = stripe();
  if (!s) throw err.conflict("billing_off", "Bezahlen ist noch nicht eingerichtet.");
  const [u] = await sql<{ stripe_customer_id: string | null }[]>`select stripe_customer_id from users where id = ${user.id}`;
  if (!u?.stripe_customer_id) throw err.notFound("Es gibt noch kein Abo zu diesem Konto.");
  const p = await s.billingPortal.sessions.create({ customer: u.stripe_customer_id, return_url: `${env.appUrl}${returnPath}` });
  return p.url;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Neuere API-Versionen führen das Periodenende pro Abo-Position
  const raw = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return raw ? new Date(raw * 1000) : null;
}

/** Abo aus Stripe speichern und die Pläne von Konto und Kreis neu setzen */
export async function syncSubscription(sub: Stripe.Subscription) {
  const md = sub.metadata ?? {};
  const kind = md.kind === "organization" ? "organization" : md.kind === "supporter" ? "supporter" : null;
  const userId = md.user_id;
  if (!kind || !userId) return;
  const item = sub.items?.data?.[0];
  await sql`
    insert into subscriptions (kind, user_id, circle_id, stripe_subscription_id, status, amount, interval, current_period_end, cancel_at_period_end)
    values (${kind}, ${userId}, ${md.circle_id ?? null}, ${sub.id}, ${sub.status}, ${item?.price?.unit_amount ?? null},
            ${item?.price?.recurring?.interval ?? null}, ${periodEnd(sub)}, ${Boolean(sub.cancel_at_period_end)})
    on conflict (stripe_subscription_id) do update set
      status = excluded.status, amount = excluded.amount, interval = excluded.interval,
      current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now()`;
  await applyPlans(userId, md.circle_id ?? null);
}

export async function applyPlans(userId: string, circleId: string | null) {
  await sql`
    update users set plan_id = case when exists (
      select 1 from subscriptions where user_id = ${userId} and kind = 'supporter' and status = any(${ACTIVE})) then 'supporter' else 'standard' end
     where id = ${userId}`;
  if (circleId) {
    await sql`
      update circles set plan_id = case when exists (
        select 1 from subscriptions where circle_id = ${circleId} and kind = 'organization' and status = any(${ACTIVE})) then 'organization' else 'standard' end
       where id = ${circleId}`;
  }
}

/** Webhook-Ereignis verarbeiten (Signatur ist schon geprüft). Jedes Ereignis nur einmal. */
export async function handleEvent(event: Stripe.Event) {
  const fresh = await sql`insert into billing_events (id, type) values (${event.id}, ${event.type}) on conflict do nothing returning id`;
  if (!fresh.length) return;
  const s = stripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      if (cs.mode === "subscription" && cs.subscription && s) {
        const id = typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id;
        await syncSubscription(await s.subscriptions.retrieve(id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
  }
}

/** Abo-Stand eines Kontos für die Einstellungen */
export async function supporterStatus(userId: string) {
  const [s] = await sql<{ status: string; amount: number | null; interval: string | null; current_period_end: Date | null; cancel_at_period_end: boolean }[]>`
    select status, amount, interval, current_period_end, cancel_at_period_end from subscriptions
     where user_id = ${userId} and kind = 'supporter' order by (status = any(${ACTIVE})) desc, updated_at desc limit 1`;
  return s && ACTIVE.includes(s.status) ? s : null;
}

export async function organizationStatus(circleId: string) {
  const [s] = await sql<{ status: string; user_id: string; current_period_end: Date | null; cancel_at_period_end: boolean }[]>`
    select status, user_id, current_period_end, cancel_at_period_end from subscriptions
     where circle_id = ${circleId} and kind = 'organization' and status = any(${ACTIVE}) order by updated_at desc limit 1`;
  return s ?? null;
}

/** Kennzahlen für die Moderation: aktive Abos und wiederkehrender Umsatz pro Monat (Rappen) */
export async function billingStats() {
  const [r] = await sql<{ supporters: number; orgs: number; mrr: number }[]>`
    select count(*) filter (where kind = 'supporter')::int as supporters,
           count(*) filter (where kind = 'organization')::int as orgs,
           coalesce(sum(case when interval = 'year' then amount / 12.0 else amount end), 0)::int as mrr
      from subscriptions where status = any(${ACTIVE})`;
  return r;
}
