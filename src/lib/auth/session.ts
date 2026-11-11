import { cookies, headers } from "next/headers";
import { sql } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/crypto";
import { err } from "@/lib/errors";

export const SESSION_COOKIE = "lr_session";
const WEB_DAYS = 60;
const API_DAYS = 365;

export type SessionUser = {
  id: string;
  email: string;
  first_name: string;
  role: "member" | "moderator" | "admin";
  trust_level: number;
  plz: string | null;
  municipality: string | null;
  home_lat: number | null;
  home_lng: number | null;
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
  phone_e164: string | null;
  onboarded_at: Date | null;
  age_confirmed_at: Date | null;
  shelf_paused: boolean;
  banned_at: Date | null;
  lending_suspended_at: Date | null;
  plan_id: string;
  avatar_key: string | null;
  email_prefs: Record<string, boolean>;
  session_id: string;
};

/** Legt eine Sitzung in Postgres an. Für die iOS-App dieselben Sitzungen per Token (PRD 10.2). */
export async function createSession(userId: string, kind: "web" | "api" = "web") {
  const token = randomToken(32);
  const h = await headers();
  const days = kind === "web" ? WEB_DAYS : API_DAYS;
  await sql`
    insert into sessions (user_id, token_hash, kind, user_agent, expires_at)
    values (${userId}, ${hashToken(token)}, ${kind}, ${h.get("user-agent")?.slice(0, 200) ?? null},
            now() + make_interval(days => ${days}))`;
  return { token, maxAge: days * 86400 };
}

export async function setSessionCookie(token: string, maxAge: number) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

async function readToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? null;
}

export async function getUser(): Promise<SessionUser | null> {
  const token = await readToken();
  if (!token) return null;
  const rows = await sql<SessionUser[]>`
    with s as (
      update sessions set last_seen_at = now()
       where token_hash = ${hashToken(token)} and expires_at > now()
       returning id, user_id
    )
    select u.id, u.email, u.first_name, u.role, u.trust_level, u.plz, u.municipality,
           u.home_lat, u.home_lng, u.email_verified_at, u.phone_verified_at, u.phone_e164,
           u.onboarded_at, u.age_confirmed_at, u.shelf_paused, u.banned_at, u.lending_suspended_at,
           u.plan_id, u.avatar_key, u.email_prefs, s.id as session_id
      from s join users u on u.id = s.user_id
     where u.deleted_at is null`;
  return rows[0] ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw err.unauthorized();
  if (u.banned_at) throw err.forbidden("Dein Konto ist gesperrt. Antworte auf die E-Mail der Moderation, um das zu klären.");
  return u;
}

export async function requireModerator(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role === "member") throw err.forbidden();
  return u;
}

export async function destroySession() {
  const token = await readToken();
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}
