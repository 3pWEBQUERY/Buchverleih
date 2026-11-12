/**
 * Universal Links und geteilte Passwörter für die iOS-App (Apple App Site Association).
 * Apple lädt die Datei über https://<Domain>/.well-known/apple-app-site-association – ohne
 * Weiterleitung, als JSON. App-IDs: APPLE_APP_IDS (kommagetrennt, «TEAMID.bundle.id»).
 *
 * - /k/<code>: Kreis-Einladungen öffnen direkt die App
 * - /anmelden/link?…&app=1: Anmeldelinks, die die App angefordert hat (Web-Links bleiben im Browser)
 * - webcredentials: Passwörter aus dem Web stehen in der App zur Verfügung und umgekehrt
 */
const DEFAULT_APP_IDS = "CY2659G6Q3.ch.leihregal.app";

export function GET() {
  const appIDs = (process.env.APPLE_APP_IDS || DEFAULT_APP_IDS).split(",").map((s) => s.trim()).filter(Boolean);
  const body = {
    applinks: {
      details: [
        {
          appIDs,
          components: [
            { "/": "/k/*", comment: "Kreis-Einladungen" },
            { "/": "/anmelden/link", "?": { app: "1" }, comment: "Anmeldelinks aus der App" },
          ],
        },
      ],
    },
    webcredentials: { apps: appIDs },
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
