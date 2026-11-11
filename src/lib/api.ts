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

export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
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

export async function body<T extends ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let data: unknown = {};
  const text = await req.text();
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
