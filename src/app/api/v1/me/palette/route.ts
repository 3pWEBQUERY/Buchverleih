import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { paletteData } from "@/lib/palette";

/** GET /api/v1/me/palette – kleine Listen für die Befehlspalette: eigene Bücher, Kreise, laufende Vorgänge */
export const GET = route(async () => paletteData((await requireUser()).id));
