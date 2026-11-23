/** Bezahlung: Abos aus Stripe-Ereignissen setzen die Pläne von Konto und Kreis; jedes Ereignis nur einmal. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { handleEvent, prices, setPrice, syncSubscription } from "@/lib/billing";
import { createCircle } from "@/lib/circles";
import { makeUser, reset } from "./helpers";

beforeEach(async () => { await reset(); await sql`delete from subscriptions`; await sql`delete from billing_events`; });
afterAll(() => sql.end());

const sub = (id: string, status: string, metadata: Record<string, string>, interval = "month", amount = 300) => ({
  id, status, metadata, cancel_at_period_end: false,
  items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { unit_amount: amount, recurring: { interval } } }] },
}) as unknown as Stripe.Subscription;

describe("Bezahlung", () => {
  it("Fördermitgliedschaft setzt den Plan und nimmt ihn bei Kündigung wieder weg", async () => {
    const u = await makeUser("Lea");
    await syncSubscription(sub("sub_1", "active", { user_id: u.id, kind: "supporter" }));
    let [r] = await sql<{ plan_id: string }[]>`select plan_id from users where id = ${u.id}`;
    expect(r.plan_id).toBe("supporter");
    await syncSubscription(sub("sub_1", "canceled", { user_id: u.id, kind: "supporter" }));
    [r] = await sql<{ plan_id: string }[]>`select plan_id from users where id = ${u.id}`;
    expect(r.plan_id).toBe("standard");
  });

  it("Organisation gilt für den Kreis; Ereignisse werden nur einmal verarbeitet", async () => {
    const u = await makeUser("Anna");
    const circleId = await createCircle(u.id, { name: "Schulbibliothek" });
    const ev = { id: "evt_1", type: "customer.subscription.created", data: { object: sub("sub_2", "active", { user_id: u.id, kind: "organization", circle_id: circleId }, "month", 1500) } } as unknown as Stripe.Event;
    await handleEvent(ev);
    await handleEvent(ev);
    const [c] = await sql<{ plan_id: string }[]>`select plan_id from circles where id = ${circleId}`;
    expect(c.plan_id).toBe("organization");
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from subscriptions`;
    expect(n.n).toBe(1);
  });

  it("Preise ändern nur Admins", async () => {
    const mod = await makeUser("Mod");
    await expect(setPrice({ ...mod, role: "moderator" }, "supporter_month", 500)).rejects.toMatchObject({ status: 403 });
    await setPrice({ ...mod, role: "admin" }, "supporter_month", 500);
    expect((await prices()).supporter_month).toBe(500);
    await setPrice({ ...mod, role: "admin" }, "supporter_month", 300);
  });
});
