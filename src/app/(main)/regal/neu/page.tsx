import { pageUser } from "@/lib/page";
import { listShelf } from "@/lib/copies";
import { isoDay, todayCH } from "@/lib/dates";
import { Erfassen, type Added } from "./erfassen";

export const metadata = { title: "Buch erfassen" };

/** Erfassen ohne Formular (PRD 7.1, 8.3 Punkt 4): Scan, Zustand antippen, fertig. */
export default async function Page() {
  const user = await pageUser("/regal/neu");
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
  return <Erfassen initial={added} />;
}
