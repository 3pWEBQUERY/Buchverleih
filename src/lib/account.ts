/** Profil, Datenexport und Kontolöschung (PRD 7.7, 12) */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { homeFromPlz } from "@/lib/geo";

export async function plzInfo(plz: string) {
  const [p] = await sql<{ plz: string; municipality: string; lat: number; lng: number; region_id: string | null; region_name: string | null; enabled: boolean | null }[]>`
    select p.plz, p.municipality, p.lat, p.lng, p.region_id, r.name as region_name, r.enabled
      from postal_codes p left join regions r on r.id = p.region_id where p.plz = ${plz}`;
  return p ?? null;
}

export async function completeProfile(userId: string, input: { firstName: string; plz: string; birthDate: string }) {
  const first = input.firstName.trim();
  if (first.length < 1 || first.length > 40) throw err.invalid("Gib deinen Vornamen ein.");
  // Mindestalter 16 Jahre (PRD 6.6). Gespeichert wird nur die Bestätigung, nicht das Datum.
  const bd = new Date(input.birthDate);
  if (Number.isNaN(bd.getTime())) throw err.invalid("Gib dein Geburtsdatum ein.");
  const sixteen = new Date(bd);
  sixteen.setFullYear(sixteen.getFullYear() + 16);
  if (sixteen > new Date()) throw err.conflict("too_young", "Für ein eigenes Konto brauchst du mindestens 16 Jahre. Kinderbücher leihen deine Eltern.");
  const p = await plzInfo(input.plz);
  if (!p || !p.enabled)
    throw err.conflict("region_closed", "Leihregal ist in deiner Region noch nicht offen. Trag dich auf die Warteliste ein, wir melden uns.");
  const { home, display } = homeFromPlz(p.lat, p.lng);
  await sql`
    update users set first_name = ${first}, plz = ${p.plz}, municipality = ${p.municipality},
           home_lat = ${home.lat}, home_lng = ${home.lng},
           display_lat = coalesce(case when plz = ${p.plz} then display_lat end, ${display.lat}),
           display_lng = coalesce(case when plz = ${p.plz} then display_lng end, ${display.lng}),
           age_confirmed_at = coalesce(age_confirmed_at, now()), onboarded_at = coalesce(onboarded_at, now())
     where id = ${userId}`;
}

export async function updateSettings(userId: string, s: { firstName?: string; shelfPaused?: boolean; emailPrefs?: Record<string, boolean>; avatarKey?: string | null }) {
  const row: Record<string, unknown> = {};
  if (s.firstName !== undefined) row.first_name = s.firstName.trim().slice(0, 40);
  if (s.shelfPaused !== undefined) row.shelf_paused = s.shelfPaused;
  if (s.avatarKey !== undefined) row.avatar_key = s.avatarKey;
  if (Object.keys(row).length) await sql`update users set ${sql(row)} where id = ${userId}`;
  if (s.emailPrefs) {
    const clean = Object.fromEntries(Object.entries(s.emailPrefs).filter(([k]) => k !== "cases").map(([k, v]) => [k, Boolean(v)]));
    await sql`update users set email_prefs = email_prefs || ${sql.json(clean)} where id = ${userId}`;
  }
}

export async function joinWaitlist(email: string, plz: string) {
  if (!/^\d{4}$/.test(plz)) throw err.invalid("Gib eine vierstellige Postleitzahl ein.");
  await sql`insert into plz_waitlist (email, plz) values (${email.trim().toLowerCase()}, ${plz}) on conflict do nothing`;
}

/** Datenexport: alles, was zur Person gespeichert ist */
export async function exportData(userId: string) {
  const [user] = await sql`select id, email, first_name, plz, municipality, phone_e164, trust_level, created_at, email_prefs, shelf_paused from users where id = ${userId}`;
  const copies = await sql`select c.*, e.title, e.isbn13 from copies c join editions e on e.id = c.edition_id where c.owner_id = ${userId}`;
  const loans = await sql`select * from loans where owner_id = ${userId} or borrower_id = ${userId}`;
  const events = await sql`select ev.* from loan_events ev join loans l on l.id = ev.loan_id where l.owner_id = ${userId} or l.borrower_id = ${userId}`;
  const messages = await sql`select id, loan_id, handover_chat_id, body, proposal_place, proposal_at, created_at from messages where sender_id = ${userId}`;
  const ratingsGiven = await sql`select loan_id, verdict, reasons, note, created_at from ratings where from_user = ${userId}`;
  const circles = await sql`select c.name, m.role, m.joined_at from circle_members m join circles c on c.id = m.circle_id where m.user_id = ${userId}`;
  const wishlist = await sql`select w.title, wi.radius_km, wi.created_at from wishlist_items wi join works w on w.id = wi.work_id where wi.user_id = ${userId}`;
  const spots = await sql`select label, detail, dropoff from pickup_spots where user_id = ${userId}`;
  const notifications = await sql`select type, channel, payload, created_at, read_at from notifications where user_id = ${userId} order by created_at desc limit 1000`;
  return { exportedAt: new Date().toISOString(), user, copies, loans, events, messages, ratingsGiven, circles, wishlist, spots, notifications };
}

/** Löschung ist erst möglich, wenn keine Leihe offen ist. Vorgangsdaten werden anonymisiert. */
export async function deleteAccount(userId: string) {
  return sql.begin(async (tx) => {
    const [open] = await tx<{ n: number }[]>`
      select count(*)::int as n from loans where (owner_id = ${userId} or borrower_id = ${userId})
         and status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed')`;
    if (open.n) throw err.conflict("open_loans", `Du hast noch ${open.n} offene Vorgänge. Schliesse sie ab, dann kannst du dein Konto löschen.`);
    await tx`update copies set removed_at = coalesce(removed_at, now()), removed_reason = coalesce(removed_reason, 'deleted') where owner_id = ${userId}`;
    await tx`delete from sessions where user_id = ${userId}`;
    await tx`delete from passkeys where user_id = ${userId}`;
    await tx`delete from pickup_spots where user_id = ${userId}`;
    await tx`delete from wishlist_items where user_id = ${userId}`;
    await tx`delete from circle_members where user_id = ${userId}`;
    await tx`update messages set body = null, proposal_place = null where sender_id = ${userId} and body is not null and proposal_at is not null`;
    await tx`delete from messages where sender_id = ${userId} and proposal_at is null`;
    await tx`update users set email = ${"geloescht-" + userId + "@invalid"}, first_name = 'Ehemaliges Mitglied', phone_e164 = null,
                    home_lat = null, home_lng = null, display_lat = null, display_lng = null, avatar_key = null,
                    email_prefs = '{}', deleted_at = now() where id = ${userId}`;
  });
}
