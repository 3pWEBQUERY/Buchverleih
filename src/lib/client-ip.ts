/**
 * IP der anfragenden Person für Ratenbegrenzungen. Der Proxy von Railway hängt die echte
 * Absenderadresse hinten an X-Forwarded-For an; was der Client selbst mitschickt, steht davor.
 * Deshalb zählt der letzte Eintrag, nie der erste.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.slice(0, 64);
  }
  return (req.headers.get("x-real-ip") ?? "").trim().slice(0, 64) || "unbekannt";
}
