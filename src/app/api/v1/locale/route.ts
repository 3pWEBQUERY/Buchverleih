import { z } from "zod";
import { cookies } from "next/headers";
import { body, route } from "@/lib/api";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { LOCALES, LOCALE_COOKIE } from "@/lib/i18n/locale";

/** POST /api/v1/locale – Sprache wählen. Gilt für diesen Browser; angemeldet auch für E-Mails und Push. */
export const POST = route(async (req) => {
  const b = await body(req, z.object({ locale: z.enum(LOCALES) }));
  (await cookies()).set(LOCALE_COOKIE, b.locale, {
    path: "/",
    maxAge: 365 * 86400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  const u = await getUser();
  if (u) await sql`update users set locale = ${b.locale} where id = ${u.id}`;
  return { locale: b.locale };
});
