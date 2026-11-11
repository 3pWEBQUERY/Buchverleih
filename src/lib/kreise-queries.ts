/** Lesende Abfragen für die Kreisübersicht: Gesichter (Vornamen) und Buchrücken je Kreis. */
import { sql } from "@/lib/db";

export async function circlePreviews(circleIds: string[]) {
  if (circleIds.length === 0) return {} as Record<string, { names: string[]; books: { title: string; author: string }[] }>;
  const [faces, books] = await Promise.all([
    sql<{ circle_id: string; first_name: string }[]>`
      select circle_id, first_name from (
        select m.circle_id, u.first_name, row_number() over (partition by m.circle_id order by (m.role = 'admin') desc, u.first_name) as n
          from circle_members m join users u on u.id = m.user_id
         where m.circle_id in ${sql(circleIds)} and m.status = 'active'
      ) x where n <= 5`,
    sql<{ circle_id: string; title: string; author: string | null }[]>`
      select circle_id, title, author from (
        select cc.circle_id, w.title, w.authors[1] as author, row_number() over (partition by cc.circle_id order by c.created_at desc) as n
          from circle_copies cc
          join copies c on c.id = cc.copy_id and c.removed_at is null
          join editions e on e.id = c.edition_id join works w on w.id = e.work_id
         where cc.circle_id in ${sql(circleIds)}
      ) x where n <= 12`,
  ]);
  const out: Record<string, { names: string[]; books: { title: string; author: string }[] }> = {};
  for (const id of circleIds) out[id] = { names: [], books: [] };
  for (const f of faces) out[f.circle_id].names.push(f.first_name);
  for (const b of books) out[b.circle_id].books.push({ title: b.title, author: b.author ?? "" });
  return out;
}
