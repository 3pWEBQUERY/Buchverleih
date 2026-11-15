import { z } from "zod";
import { body, route } from "@/lib/api";
import { getUser, requireUser } from "@/lib/auth/session";
import { completeProfile, movePlz, setAvatar, updateSettings } from "@/lib/account";
import { err } from "@/lib/errors";
import { requestBlocker } from "@/lib/trust";
import { sql } from "@/lib/db";

/** GET /api/v1/me – eigenes Konto, null wenn abgemeldet */
export const GET = route(async () => {
  const u = await getUser();
  if (!u) return { user: null };
  const [stats] = await sql`select lent_count, borrowed_count, punctual_count, rated_count from user_stats where user_id = ${u.id}`;
  return {
    user: {
      id: u.id, email: u.email, firstName: u.first_name, role: u.role, trustLevel: u.trust_level, plz: u.plz,
      municipality: u.municipality, avatarKey: u.avatar_key, emailVerified: Boolean(u.email_verified_at), phoneVerified: Boolean(u.phone_verified_at),
      onboarded: Boolean(u.onboarded_at), shelfPaused: u.shelf_paused, emailPrefs: u.email_prefs,
      pulseShowNewBooks: u.pulse_show_new_books, pinboardNotify: u.pinboard_notify, radiusKm: u.radius_km,
    },
    stats,
    requestBlocker: await requestBlocker(sql, u),
  };
});

/** POST /api/v1/me – Profil vervollständigen (Vorname, PLZ, Alter) */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ firstName: z.string().min(1).max(40), plz: z.string().regex(/^\d{4}$/), birthDate: z.string() }));
  await completeProfile(u.id, b);
  return { ok: true };
});

/** PATCH /api/v1/me – Einstellungen */
export const PATCH = route(async (req) => {
  const u = await requireUser();
  const b = await body(
    req,
    z.object({
      firstName: z.string().min(1).max(40).optional(),
      shelfPaused: z.boolean().optional(),
      emailPrefs: z.record(z.string(), z.boolean()).optional(),
      /** Neue Bücher von mir im Puls der Kreise zeigen */
      pulseShowNewBooks: z.boolean().optional(),
      /** E-Mail und Push zur Pinnwand: nur Antworten auf eigene Zettel (Standard), alles, nichts */
      pinboardNotify: z.enum(["replies", "all", "off"]).optional(),
      /** Standard-Umkreis in km für Start, Suche und neue Wünsche */
      radiusKm: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(25)]).optional(),
      plz: z.string().regex(/^\d{4}$/).optional(),
      /** Profilbild: Id eines eigenen Uploads mit Zweck «avatar», null entfernt das Bild */
      avatarUploadId: z.string().uuid().nullable().optional(),
    }),
  );
  if (b.avatarUploadId !== undefined) {
    const key = await setAvatar(u.id, b.avatarUploadId);
    if (Object.keys(b).length === 1) return { ok: true, avatarKey: key };
  }
  if (b.plz) {
    // Umzug: nur für fertige Profile. Das Onboarding (mit Altersprüfung) läuft über POST /me/profile.
    if (!u.onboarded_at) throw err.conflict("onboarding", "Schliesse zuerst die Anmeldung ab.");
    await movePlz(u.id, b.plz);
  }
  await updateSettings(u.id, b);
  return { ok: true };
});
