import { pageUser } from "@/lib/page";
import { sql } from "@/lib/db";
import { shelfPhotoEnabled } from "@/lib/shelf-photo";
import { listShelf } from "@/lib/copies";
import { isoDay, todayCH } from "@/lib/dates";
import { Erfassen, type Added } from "./erfassen";
import { getLocale } from "@/lib/i18n/server";
import { CAPTURE } from "@/lib/i18n/messages/capture";

export async function generateMetadata() {
  return { title: CAPTURE[await getLocale()].title };
}

/** Erfassen ohne Formular (PRD 7.1, 8.3 Punkt 4): Scan, Zustand antippen, fertig. */
export default async function Page({ searchParams }: { searchParams: Promise<{ kreis?: string; start?: string }> }) {
  const user = await pageUser("/regal/neu");
  const { kreis, start } = await searchParams;
  // Kreisbibliothek: nur Admins des Kreises erfassen für den Kreis
  const [library] = kreis && /^[0-9a-f-]{36}$/.test(kreis)
    ? await sql<{ id: string; name: string }[]>`
        select ci.id, ci.name from circles ci join circle_members m on m.circle_id = ci.id
         where ci.id = ${kreis} and m.user_id = ${user.id} and m.role = 'admin' and m.status = 'active'`
    : [];
  const today = todayCH();
  const shelf = await listShelf(user.id);
  const added: Added[] = shelf
    .filter((c) => isoDay(c.created_at) === today)
    .map((c) => ({
      id: c.id,
      title: c.title,
      authors: c.authors,
      condition: c.condition,
      circlesOnly: c.visibility === "circles",
      cover: { title: c.title, authors: c.authors, photoKey: c.photo_key, photoW: c.photo_w, photoH: c.photo_h, coverKey: c.cover_key, seed: c.work_id },
    }));
  // Direkt nach der Einrichtung und noch ohne Bücher: Begrüssung, Regalfoto zuerst (wenn eingerichtet)
  const welcome = start === "1" && shelf.length === 0 && !library;
  return <Erfassen initial={library ? [] : added} library={library ?? null} shelfPhoto={shelfPhotoEnabled()} welcome={welcome} />;
}
