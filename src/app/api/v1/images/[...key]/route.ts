import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { signedGetUrl } from "@/lib/storage";

/**
 * GET /api/v1/images/<key>?w=480 – liefert eine Bildvariante über eine kurzlebige
 * vorsignierte URL aus (PRD 10.3). Fotos aus Vorgängen und Fällen nur für Beteiligte.
 */
export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!env.s3.configured || key.includes("..") || key.startsWith("raw/")) return new Response(null, { status: 404 });

  if (key.startsWith("loans/") || key.startsWith("cases/")) {
    const u = await getUser();
    if (!u) return new Response(null, { status: 401 });
    const ref = parts[1];
    const [ok] = await sql<{ ok: boolean }[]>`
      select (${u.role} <> 'member')
          or exists (select 1 from loans where id::text = ${ref} and (owner_id = ${u.id} or borrower_id = ${u.id}))
          or exists (select 1 from cases c join loans l on l.id = c.loan_id where c.id::text = ${ref} and (l.owner_id = ${u.id} or l.borrower_id = ${u.id}))
          as ok`;
    if (!ok?.ok) return new Response(null, { status: 404 });
  }

  const [up] = await sql<{ status: string; raw_key: string; user_id: string }[]>`select status, raw_key, user_id from uploads where key = ${key}`;
  const url = new URL(req.url);
  const small = url.searchParams.get("w") === "480" ? "-480" : "";
  const accept = req.headers.get("accept") ?? "";
  const ext = accept.includes("image/avif") ? "avif" : "webp";

  let target = `${key}${small}.${ext}`;
  if (up && up.status !== "processed" && !key.startsWith("covers/")) {
    // Noch nicht verarbeitet: nur die hochladende Person sieht das Original (Metadaten sind noch drin)
    const u = await getUser();
    if (!u || u.id !== up.user_id || up.status === "rejected") return new Response(null, { status: 404, headers: { "retry-after": "3" } });
    target = up.raw_key;
  }
  const signed = await signedGetUrl(target, 3600);
  return new Response(null, {
    status: 302,
    headers: { location: signed, "cache-control": up?.status === "processed" || !up ? "private, max-age=3000" : "no-store", vary: "accept" },
  });
}
