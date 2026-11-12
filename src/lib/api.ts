import { NextResponse } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/errors";
import { PG, pgCode } from "@/lib/db";

/**
 * Hülle für alle Endpunkte unter /api/v1. Einheitliches Fehlerformat:
 *   { "error": { "code": "...", "message": "..." } }
 * Die Meldung ist für Menschen gedacht und sagt, was zu tun ist.
 */
type Ctx<P> = { params: Promise<P> };

/**
 * Schreibende Anfragen aus dem Browser müssen von dieser Seite kommen (Schutz gegen CSRF zusätzlich zu SameSite).
 * Anfragen ohne Origin (Apps, Skripte mit Bearer-Token) sind nicht betroffen.
 */
function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  let host: string;
  try { host = new URL(origin).host; } catch { throw new AppError(403, "forbidden_origin", "Diese Anfrage kommt nicht von Leihregal."); }
  const allowed = new Set([req.headers.get("x-forwarded-host"), req.headers.get("host"), new URL(req.url).host].filter(Boolean) as string[]);
  try { allowed.add(new URL(process.env.APP_URL || "http://localhost:3000").host); } catch {}
  if (!allowed.has(host)) throw new AppError(403, "forbidden_origin", "Diese Anfrage kommt nicht von Leihregal.");
}

export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      const params = (await ctx?.params) ?? ({} as P);
      const out = await fn(req, params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return NextResponse.json(
      { error: { code: "invalid", message: first ? `${first.path.join(".") || "Eingabe"}: ${first.message}` : "Ungültige Eingabe.", details: e.issues } },
      { status: 422 },
    );
  }
  const code = pgCode(e);
  if (code === PG.EXCLUSION) {
    return NextResponse.json(
      { error: { code: "calendar_conflict", message: "Dieser Zeitraum ist im Verleihkalender bereits belegt. Wähle einen freien Zeitraum." } },
      { status: 409 },
    );
  }
  if (code === PG.UNIQUE) {
    return NextResponse.json(
      { error: { code: "duplicate", message: "Das gibt es bereits. Lade die Seite neu, um den aktuellen Stand zu sehen." } },
      { status: 409 },
    );
  }
  if (code === "22007" || code === "22008") {
    return NextResponse.json({ error: { code: "invalid", message: "Dieses Datum gibt es nicht. Prüfe die Eingabe." } }, { status: 422 });
  }
  if (code === "22P02") {
    return NextResponse.json({ error: { code: "not_found", message: "Nicht gefunden." } }, { status: 404 });
  }
  if (code === PG.CHECK) {
    return NextResponse.json(
      { error: { code: "rule_violation", message: "Dieser Schritt verletzt eine Regel des Vorgangs. Lade die Seite neu." } },
      { status: 409 },
    );
  }
  console.error(e);
  return NextResponse.json(
    { error: { code: "server_error", message: "Etwas ist schiefgelaufen. Versuche es in einem Moment erneut." } },
    { status: 500 },
  );
}

/** Höchstgrösse für JSON-Anfragen (Bilder laufen über den Bucket, nie durch diese Funktion) */
const MAX_JSON_BYTES = 64 * 1024;

/** Liest den Body mit Obergrenze – ohne zuerst alles in den Speicher zu laden */
export async function readLimited(req: Request, max: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > max) throw new AppError(413, "too_large", "Die Anfrage ist zu gross.");
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new AppError(413, "too_large", "Die Anfrage ist zu gross.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

export async function body<T extends ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let data: unknown = {};
  const text = new TextDecoder().decode(await readLimited(req, MAX_JSON_BYTES));
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new AppError(400, "bad_json", "Die Anfrage konnte nicht gelesen werden.");
    }
  }
  return schema.parse(data);
}

export function query<T extends ZodType>(req: Request, schema: T): z.infer<T> {
  const url = new URL(req.url);
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams) {
    if (k in obj) obj[k] = ([] as string[]).concat(obj[k], v);
    else obj[k] = v;
  }
  return schema.parse(obj);
}

export const uuid = z.string().uuid({ message: "ungültige ID" });
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
