/**
 * Rücksprungziel nach der Anmeldung: nur Pfade auf dieser Seite.
 * Verhindert Weiterleitungen auf fremde Seiten («//evil.com», «/\\evil.com», «javascript:»).
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || typeof next !== "string" || next.length > 500) return "";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return "";
  try {
    const u = new URL(next, "https://leihregal.invalid");
    if (u.origin !== "https://leihregal.invalid") return "";
    return u.pathname + u.search + u.hash;
  } catch {
    return "";
  }
}
