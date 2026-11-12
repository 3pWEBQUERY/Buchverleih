import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/** Sitemap: feste Seiten und Titel, von denen mindestens ein Exemplar öffentlich angeboten wird */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const fixed = ["", "/suche", "/hilfe", "/regeln", "/nutzungsbedingungen", "/datenschutz"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const }));
  try {
    const works = await sql<{ id: string; updated: Date }[]>`
      select e.work_id as id, max(c.created_at) as updated
        from copies c join editions e on e.id = c.edition_id join users o on o.id = c.owner_id
       where c.removed_at is null and cardinality(c.offers) > 0 and c.visibility = 'all'
         and o.deleted_at is null and o.banned_at is null and not o.is_demo
       group by e.work_id order by updated desc limit 5000`;
    return [...fixed, ...works.map((w) => ({ url: `${base}/titel/${w.id}`, lastModified: w.updated, changeFrequency: "daily" as const }))];
  } catch {
    return fixed;
  }
}
