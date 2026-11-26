import { NextResponse, type NextRequest } from "next/server";

/**
 * Eine Adresse für alle: Seitenaufrufe über die Railway-Adresse oder www. leiten dauerhaft (308)
 * auf die Hauptadresse aus APP_URL weiter (https://leihregal.ch). Pfad und Suchparameter bleiben.
 *
 * Nicht weitergeleitet werden:
 * - /api/…: ältere App-Versionen, der Stripe-Webhook und der Healthcheck rufen die alte Adresse direkt auf
 * - /.well-known/…: Apple lädt die App Site Association ohne Weiterleitung
 * - Anfragen ohne öffentliche Adresse (localhost, interne Railway-Adressen)
 */
export function proxy(req: NextRequest) {
  const target = canonical();
  if (!target) return NextResponse.next();
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (!host || host === target.host || !redirectable(host, target.host)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/.well-known/")) return NextResponse.next();
  return NextResponse.redirect(new URL(pathname + search, target.origin), 308);
}

function canonical(): URL | null {
  try {
    const u = new URL(process.env.APP_URL ?? "");
    return u.protocol === "https:" && !u.hostname.endsWith(".up.railway.app") ? u : null;
  } catch {
    return null;
  }
}

/** Nur bekannte Nebenadressen: die öffentliche Railway-Adresse und www. der Hauptadresse */
function redirectable(host: string, main: string) {
  const name = host.split(":")[0];
  return name.endsWith(".up.railway.app") || name === `www.${main}`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|sw.js).*)"],
};
