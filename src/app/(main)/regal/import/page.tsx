import { pageUser } from "@/lib/page";
import { getLocale } from "@/lib/i18n/server";
import { IMPORT } from "@/lib/i18n/messages/import";
import { features } from "@/lib/features";
import { ImportClient } from "./import-client";

export async function generateMetadata() {
  return { title: IMPORT[await getLocale()].title };
}

/** Bibliothek aus Goodreads oder StoryGraph übernehmen (PRD 7.1, Phase 2) */
export default async function Page() {
  await pageUser("/regal/import");
  const f = await features();
  return <ImportClient wishlist={f.wishlist} swap={f.swap} />;
}
