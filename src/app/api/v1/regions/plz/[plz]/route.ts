import { route } from "@/lib/api";
import { plzInfo } from "@/lib/account";
import { newNearby } from "@/lib/copies";

/** GET /api/v1/regions/plz/:plz – Region offen? Bestand in der Nähe (Startseite abgemeldet) */
export const GET = route<{ plz: string }>(async (_req, p) => {
  const info = await plzInfo(p.plz);
  if (!info) return { known: false, open: false, copies: [] };
  const copies = info.enabled ? await newNearby(null, { lat: info.lat, lng: info.lng }, 5, 24) : [];
  return { known: true, open: Boolean(info.enabled), municipality: info.municipality, region: info.region_name, copies };
});
