/**
 * Original-Cover (PRD 7.2): Deutsche Nationalbibliothek (Verlagscover), Open Library, Google Books. Gefundene Cover werden im
 * eigenen Bucket zwischengespeichert (covers/{isbn}) und nie direkt von der Quelle eingebunden.
 * Die Nutzungsbedingungen der Quellen sind vor dem öffentlichen Start zu prüfen (PRD 12);
 * abschalten mit COVERS=false.
 */
const UA = { "user-agent": "Leihregal/0.1 (Buchverleih unter Privatpersonen)" };

export async function coverCandidates(isbn: string): Promise<string[]> {
  const urls = [
    // Verlagscover über die Deutsche Nationalbibliothek (VLB/MVB) – beste Abdeckung für deutschsprachige Titel
    `https://portal.dnb.de/opac/mvb/cover?isbn=${isbn}&size=l`,
    `https://portal.dnb.de/opac/mvb/cover?isbn=${isbn}`,
    `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  ];
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const j = await res.json();
      const links = j.items?.[0]?.volumeInfo?.imageLinks;
      const best: string | undefined = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail ?? links?.smallThumbnail;
      if (best) {
        const u = new URL(best.replace(/^http:/, "https:"));
        u.searchParams.delete("edge");
        u.searchParams.set("zoom", "1");
        u.searchParams.set("fife", "w800"); // grössere Variante
        urls.push(u.toString());
      }
    }
  } catch {
    // Quelle nicht erreichbar: nächster Versuch beim nächsten Lauf
  }
  return urls;
}

export async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10_000), redirect: "follow" });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 2500 ? buf : null; // Platzhalter (1×1, «kein Bild») sind winzig
  } catch {
    return null;
  }
}
