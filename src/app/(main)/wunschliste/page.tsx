import type { Metadata } from "next";
import { pageUser } from "@/lib/page";
import { listWishlist, mySwapMatches } from "@/lib/wishlist";
import { coversForWorks } from "@/lib/title-queries";
import { PageTitle } from "@/components/ui";
import { WishlistClient, type WishItem } from "./wishlist-client";

export const metadata: Metadata = { title: "Wunschliste" };

/** Wunschliste, Titelalarm und Tauschtreffer (PRD 4.6, 5.3) */
export default async function WunschlistePage() {
  const user = await pageUser("/wunschliste");
  const [items, matches] = await Promise.all([listWishlist(user.id), mySwapMatches(user.id)]);
  const covers = await coversForWorks(items.map((i) => i.work_id));
  const list: WishItem[] = items.map((i) => {
    const c = covers.get(i.work_id);
    return { ...i, cover_key: c?.cover_key ?? null, cover_w: c?.cover_w ?? null, cover_h: c?.cover_h ?? null };
  });

  return (
    <div>
      <p className="eyebrow mb-3 anim-rise">Titelalarm</p>
      <PageTitle sub="Titel, die du suchst. Mit dem Titelalarm melden wir uns, sobald ein Exemplar im gewählten Umkreis frei wird.">
        Deine <em>Wunschliste.</em>
      </PageTitle>
      <WishlistClient
        items={list}
        matches={matches.map((m) => ({ id: m.id, other_name: m.other_name, their_copy: m.their_copy, their_title: m.their_title, my_title: m.my_title }))}
      />
    </div>
  );
}
