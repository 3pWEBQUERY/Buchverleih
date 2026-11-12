import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { SIGN_WINDOW_MS, signedGetUrl, stableSignedUrl } from "@/lib/storage";

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
    // Beteiligte immer; Moderation nur bei offenem Fall oder Meldung zum Vorgang, und protokolliert (PRD 12)
    const [ok] = await sql<{ party: boolean; mod: boolean }[]>`
      select exists (select 1 from loans where id::text = ${ref} and (owner_id = ${u.id} or borrower_id = ${u.id}))
          or exists (select 1 from cases c join loans l on l.id = c.loan_id where c.id::text = ${ref} and (l.owner_id = ${u.id} or l.borrower_id = ${u.id}))
             as party,
             ${u.role} <> 'member' and (
               exists (select 1 from cases c where (c.loan_id::text = ${ref} or c.id::text = ${ref}))
               or exists (select 1 from reports r where r.target_type = 'loan' and r.target_id = ${ref})
             ) as mod`;
    if (!ok?.party && !ok?.mod) return new Response(null, { status: 404 });
    if (!ok.party && ok.mod) {
      await sql`insert into moderation_log (moderator_id, action, target_type, target_id, note)
                values (${u.id}, 'view_photo', 'loan', ${ref}, ${key})`.catch(() => {});
    }
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
  const ready = up?.status === "processed" || !up;
  if (!ready) {
    const signed = await signedGetUrl(target, 600);
    return new Response(null, { status: 302, headers: { location: signed, "cache-control": "no-store", vary: "accept" } });
  }
  // Verarbeitete Bilder: stabile URL im 6-Stunden-Fenster, Weiterleitung bis zum Fensterende cachebar
  const signed = await stableSignedUrl(target);
  const left = Math.max(60, Math.floor((SIGN_WINDOW_MS - (Date.now() % SIGN_WINDOW_MS)) / 1000));
  return new Response(null, {
    status: 302,
    headers: { location: signed, "cache-control": `${key.startsWith("covers/") ? "public" : "private"}, max-age=${left}`, vary: "accept" },
  });
}
