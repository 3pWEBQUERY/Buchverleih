import { sql } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { addDays, todayCH } from "@/lib/dates";

export async function reset() {
  await sql`truncate loan_events, deadline_marks, handover_tokens, messages, handover_chats, ratings, cases, copy_bookings,
            loans, copy_photos, circle_copies, circle_members, circles, copies, pickup_spots, editions, works, notifications,
            jobs, sessions, rate_limits, wishlist_items, swap_matches, reports, blocks, uploads, banned_phones, users cascade`;
}

let n = 0;
export async function makeUser(name: string, opts: { trust?: number; plz?: string } = {}): Promise<SessionUser> {
  n++;
  const [u] = await sql<SessionUser[]>`
    insert into users (email, email_verified_at, phone_e164, phone_verified_at, first_name, plz, municipality,
                       home_lat, home_lng, display_lat, display_lng, trust_level, onboarded_at, age_confirmed_at)
    values (${`${name.toLowerCase()}${n}@test.ch`}, now(), ${`+4179${String(1000000 + n).slice(-7)}`}, now(), ${name},
            ${opts.plz ?? "8180"}, 'Bülach', 47.522, 8.54, 47.523, 8.541, ${opts.trust ?? 0}, now(), now())
    returning *, gen_random_uuid() as session_id`;
  return u;
}

export async function makeCopy(owner: SessionUser, title: string, extra: Record<string, unknown> = {}) {
  const [w] = await sql<{ id: string }[]>`insert into works (work_key, title, authors) values (${title + Math.random()}, ${title}, '{Autorin}') returning id`;
  const [e] = await sql<{ id: string }[]>`insert into editions (work_id, title, source) values (${w.id}, ${title}, 'manual') returning id`;
  const [c] = await sql<{ id: string }[]>`insert into copies ${sql({ owner_id: owner.id, edition_id: e.id, condition: 2, ...extra })} returning id`;
  return c.id;
}

export const today = () => todayCH();
export const day = (n: number) => addDays(todayCH(), n);

export async function status(loanId: string) {
  const [l] = await sql<{ status: string }[]>`select status from loans where id = ${loanId}`;
  return l.status;
}

/** Verschiebt alle Zeitpunkte eines Vorgangs in die Vergangenheit, um Fristen zu simulieren */
export async function ageLoan(loanId: string, hours: number) {
  await sql`update loans set
    requested_at = requested_at - make_interval(hours => ${hours}),
    respond_by = respond_by - make_interval(hours => ${hours}),
    accepted_at = accepted_at - make_interval(hours => ${hours}),
    handover_by = handover_by - make_interval(hours => ${hours}),
    handover_reported_at = handover_reported_at - make_interval(hours => ${hours}),
    handed_over_at = handed_over_at - make_interval(hours => ${hours}),
    condition_note_until = condition_note_until - make_interval(hours => ${hours}),
    due_at = due_at - make_interval(hours => ${hours}),
    return_reported_at = return_reported_at - make_interval(hours => ${hours}),
    returned_at = returned_at - make_interval(hours => ${hours}),
    inspection_until = inspection_until - make_interval(hours => ${hours})
   where id = ${loanId}`;
}
