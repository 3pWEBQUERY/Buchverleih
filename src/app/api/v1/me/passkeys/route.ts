import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { passkeyRegisterOptions, passkeyRegisterVerify } from "@/lib/auth/flows";
import { sql } from "@/lib/db";

/** GET /api/v1/me/passkeys */
export const GET = route(async () => {
  const u = await requireUser();
  return { passkeys: await sql`select id, name, created_at, last_used_at from passkeys where user_id = ${u.id} order by created_at` };
});

/** POST /api/v1/me/passkeys – { step: "options" } oder { step: "verify", response } */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, z.object({ step: z.enum(["options", "verify"]), response: z.any().optional(), name: z.string().max(40).optional() }));
  if (b.step === "options") return passkeyRegisterOptions(u);
  await passkeyRegisterVerify(u, b.response, b.name);
  return { ok: true };
});

/** DELETE /api/v1/me/passkeys?id=… */
export const DELETE = route(async (req) => {
  const u = await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  await sql`delete from passkeys where id = ${id} and user_id = ${u.id}`;
  return { ok: true };
});
