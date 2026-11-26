import { readLimited, requestLocale, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { err } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";
import { matchSpines, readSpines } from "@/lib/shelf-photo";

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * POST /api/v1/catalog/shelf-photo – Foto eines Regalbretts (Body: das Bild, höchstens 4 MB).
 * Liefert die gelesenen Titel mit Katalogtreffern; gespeichert wird nichts, auch das Foto nicht.
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  // Jede Erkennung kostet: nur fertig eingerichtete Konten, dazu Grenzen pro Gerät/Netz und insgesamt
  if (!u.onboarded_at) throw err.forbidden("Richte zuerst dein Konto ein.");
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim() as (typeof TYPES)[number];
  if (!TYPES.includes(type)) throw err.invalid("Lade ein Foto als JPEG, PNG oder WebP hoch.");
  // Kosten im Rahmen halten: 20 Fotos pro Tag und Person
  await rateLimit(`shelfphoto:${u.id}`, 20, 86400);
  await rateLimit(`shelfphotoip:${clientIp(req)}`, 40, 86400);
  await rateLimit("shelfphoto:all", 2000, 86400);
  const bytes = await readLimited(req, 4 * 1024 * 1024);
  if (bytes.length < 1000) throw err.invalid("Lade ein Foto als JPEG, PNG oder WebP hoch.");
  const spines = await readSpines(Buffer.from(bytes).toString("base64"), type);
  return { matches: await matchSpines(spines, requestLocale(req)) };
});
