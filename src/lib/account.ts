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

/** Umzug innerhalb fertiger Profile: neuer Wohnort aus der PLZ, keine Änderung an Alter oder Onboarding */
export async function movePlz(userId: string, plz: string) {
  const p = await plzInfo(plz);
  if (!p || !p.enabled)
    throw err.conflict("region_closed", "Leihregal ist in dieser Region noch nicht offen. Trag dich auf die Warteliste ein, wir melden uns.");
  const { home, display } = homeFromPlz(p.lat, p.lng);
  await sql`
    update users set plz = ${p.plz}, municipality = ${p.municipality}, home_lat = ${home.lat}, home_lng = ${home.lng},
           display_lat = case when plz = ${p.plz} then display_lat else ${display.lat} end,
           display_lng = case when plz = ${p.plz} then display_lng else ${display.lng} end
     where id = ${userId} and onboarded_at is not null`;
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

/**
 * Profilbild setzen oder entfernen. Das Bild kommt aus einem eigenen Upload mit Zweck «avatar»
 * und liegt im Bucket unter u/<id>/avatar/<upload>. Das vorherige Bild wird aus dem Bucket gelöscht.
 */
export async function setAvatar(userId: string, uploadId: string | null) {
  let key: string | null = null;
  if (uploadId) {
    const [u] = await sql<{ key: string; status: string }[]>`
      select key, status from uploads where id = ${uploadId} and user_id = ${userId} and purpose = 'avatar'`;
    if (!u || u.status === "pending" || u.status === "rejected") throw err.invalid("Dieses Bild können wir nicht verwenden. Lade es erneut hoch.");
    key = u.key;
  }
  const [prev] = await sql<{ avatar_key: string | null }[]>`
    update users n set avatar_key = ${key} from users o where n.id = o.id and n.id = ${userId} returning o.avatar_key`;
  if (prev?.avatar_key && prev.avatar_key !== key) {
    const old = prev.avatar_key;
    const { deleteObject } = await import("@/lib/storage");
    await Promise.allSettled(["", "-480"].flatMap((s) => ["avif", "webp"].map((x) => deleteObject(`${old}${s}.${x}`))));
  }
  return key;
}

export async function joinWaitlist(email: string, plz: string) {
  if (!/^\d{4}$/.test(plz)) throw err.invalid("Gib eine vierstellige Postleitzahl ein.");
  await sql`insert into plz_waitlist (email, plz) values (${email.trim().toLowerCase()}, ${plz}) on conflict do nothing`;
}

/** Datenexport: alles, was zur Person gespeichert ist (DSG/DSGVO Auskunft) */
export async function exportData(userId: string) {
  const [user] = await sql`select id, email, first_name, plz, municipality, phone_e164, trust_level, role, created_at, onboarded_at,
                                  age_confirmed_at, email_prefs, shelf_paused, avatar_key, home_lat, home_lng, display_lat, display_lng
                             from users where id = ${userId}`;
  const copies = await sql`select c.*, e.title, e.isbn13 from copies c join editions e on e.id = c.edition_id where c.owner_id = ${userId}`;
  const copyPhotos = await sql`select p.* from copy_photos p join copies c on c.id = p.copy_id where c.owner_id = ${userId}`;
  const loans = await sql`select * from loans where owner_id = ${userId} or borrower_id = ${userId}`;
  const events = await sql`select ev.* from loan_events ev join loans l on l.id = ev.loan_id where l.owner_id = ${userId} or l.borrower_id = ${userId}`;
  const messages = await sql`select id, loan_id, handover_chat_id, body, proposal_place, proposal_at, created_at from messages where sender_id = ${userId}`;
  const messagesReceived = await sql`
    select m.id, m.loan_id, m.body, m.proposal_place, m.proposal_at, m.created_at from messages m join loans l on l.id = m.loan_id
     where (l.owner_id = ${userId} or l.borrower_id = ${userId}) and m.sender_id <> ${userId}`;
  const ratingsGiven = await sql`select loan_id, verdict, reasons, note, created_at from ratings where from_user = ${userId}`;
  const ratingsReceived = await sql`select loan_id, verdict, reasons, created_at from ratings where for_user = ${userId} and visible_from <= now()`;
  const cases = await sql`select cs.* from cases cs join loans l on l.id = cs.loan_id where l.owner_id = ${userId} or l.borrower_id = ${userId}`;
  const circles = await sql`select c.name, m.role, m.joined_at from circle_members m join circles c on c.id = m.circle_id where m.user_id = ${userId}`;
  const wishlist = await sql`select w.title, wi.radius_km, wi.created_at from wishlist_items wi join works w on w.id = wi.work_id where wi.user_id = ${userId}`;
  const spots = await sql`select label, detail, dropoff from pickup_spots where user_id = ${userId}`;
  const notifications = await sql`select type, channel, payload, created_at, read_at from notifications where user_id = ${userId} order by created_at desc limit 1000`;
  const reports = await sql`select target_type, target_id, reason, note, status, created_at from reports where reporter_id = ${userId}`;
  const blocks = await sql`select blocked_id, created_at from blocks where blocker_id = ${userId}`;
  const uploads = await sql`select id, purpose, key, content_type, status, created_at from uploads where user_id = ${userId}`;
  const passkeys = await sql`select name, created_at, last_used_at from passkeys where user_id = ${userId}`;
  const sessions = await sql`select kind, user_agent, created_at, last_seen_at, expires_at from sessions where user_id = ${userId}`;
  const searches = await sql`select q, created_at from search_log where user_id = ${userId} order by created_at desc limit 1000`;
  return {
    exportedAt: new Date().toISOString(), user, copies, copyPhotos, loans, events, messages, messagesReceived, ratingsGiven, ratingsReceived,
    cases, circles, wishlist, spots, notifications, reports, blocks, uploads, passkeys, sessions, searches,
  };
}

/** Löschung ist erst möglich, wenn keine Leihe offen ist. Vorgangsdaten werden anonymisiert, eigene Dateien gelöscht. */
export async function deleteAccount(userId: string) {
  const result = await sql.begin(async (tx) => {
    const [open] = await tx<{ n: number }[]>`
      select count(*)::int as n from loans where (owner_id = ${userId} or borrower_id = ${userId})
         and status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed')`;
    if (open.n) throw err.conflict("open_loans", `Du hast noch ${open.n === 1 ? "einen offenen Vorgang" : `${open.n} offene Vorgänge`}. Schliesse ${open.n === 1 ? "ihn" : "sie"} ab, dann kannst du dein Konto löschen.`);
    const [me] = await tx<{ email: string }[]>`select email from users where id = ${userId}`;
    await tx`update copies set removed_at = coalesce(removed_at, now()), removed_reason = coalesce(removed_reason, 'deleted') where owner_id = ${userId}`;
    await tx`delete from copy_photos p using copies c where c.id = p.copy_id and c.owner_id = ${userId}`;
    await tx`delete from circle_copies cc using copies c where c.id = cc.copy_id and c.owner_id = ${userId}`;
    await tx`delete from sessions where user_id = ${userId}`;
    await tx`delete from passkeys where user_id = ${userId}`;
    await tx`update loans set pickup_spot_id = null where pickup_spot_id in (select id from pickup_spots where user_id = ${userId})`;
    await tx`delete from pickup_spots where user_id = ${userId}`;
    await tx`delete from wishlist_items where user_id = ${userId}`;
    await tx`delete from circle_members where user_id = ${userId}`;
    await tx`delete from notifications where user_id = ${userId}`;
    await tx`delete from blocks where blocker_id = ${userId} or blocked_id = ${userId}`;
    await tx`delete from search_log where user_id = ${userId}`;
    await tx`delete from uploads where user_id = ${userId}`;
    await tx`update loans set message = null where borrower_id = ${userId}`;
    await tx`update messages set body = null, proposal_place = null where sender_id = ${userId} and body is not null and proposal_at is not null`;
    await tx`delete from messages where sender_id = ${userId} and proposal_at is null`;
    if (me?.email) await tx`delete from plz_waitlist where lower(email) = lower(${me.email})`;
    await tx`update users set email = ${"geloescht-" + userId + "@invalid"}, first_name = 'Ehemaliges Mitglied', phone_e164 = null,
                    plz = null, municipality = null,
                    home_lat = null, home_lng = null, display_lat = null, display_lng = null, avatar_key = null,
                    email_prefs = '{}', deleted_at = now() where id = ${userId}`;
  });
  // Eigene Dateien aus dem Bucket entfernen (Profilbild, Exemplarfotos, Rohdaten). Fotos in Vorgängen bleiben als Nachweis.
  const { deletePrefix } = await import("@/lib/storage");
  await Promise.allSettled([deletePrefix(`u/${userId}/`), deletePrefix(`raw/${userId}/`)]);
  return result;
}
