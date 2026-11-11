import { z } from "zod";
import { body, route } from "@/lib/api";
import { getUser, requireUser } from "@/lib/auth/session";
import { completeProfile, setAvatar, updateSettings } from "@/lib/account";
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
      plz: z.string().regex(/^\d{4}$/).optional(),
      /** Profilbild: Id eines eigenen Uploads mit Zweck «avatar», null entfernt das Bild */
      avatarUploadId: z.string().uuid().nullable().optional(),
    }),
  );
  if (b.avatarUploadId !== undefined) {
    const key = await setAvatar(u.id, b.avatarUploadId);
    if (Object.keys(b).length === 1) return { ok: true, avatarKey: key };
  }
  if (b.plz) await completeProfile(u.id, { firstName: b.firstName ?? u.first_name, plz: b.plz, birthDate: "1900-01-01" });
  await updateSettings(u.id, b);
  return { ok: true };
});
