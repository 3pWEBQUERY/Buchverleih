import type { Metadata } from "next";
import { getUser } from "@/lib/auth/session";
import { origin as originOf } from "@/lib/page";
import { searchWorks, type WorkHit } from "@/lib/search";
import { plzInfo } from "@/lib/account";
import { SearchClient, type Filters } from "./search-client";

export const metadata: Metadata = { title: "Suche" };

const RADII = [1, 2, 5, 10, 25];
const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Suche (PRD 7.3, 8.4): Ergebnisse während des Tippens, Entfernung und Verfügbarkeit in jeder Zeile. */
export default async function SuchePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await getUser();
  const loggedIn = !!user?.onboarded_at;

  const radius = Number(pick(sp.radius));
  const condition = Number(pick(sp.condition));
  const offer = pick(sp.offer);
  const filters: Filters = {
    radius: RADII.includes(radius) ? radius : 25,
    offer: offer === "lend" || offer === "swap" || offer === "gift" ? offer : "",
    available: pick(sp.available) === "1",
    language: pick(sp.language).slice(0, 5),
    genre: pick(sp.genre).slice(0, 40),
    condition: condition >= 1 && condition <= 3 ? condition : 0,
  };
  const q = pick(sp.q).slice(0, 120);
  const plz = /^\d{4}$/.test(pick(sp.plz)) ? pick(sp.plz) : "";

  let place: string | null = user?.municipality ?? null;
  let o = loggedIn ? originOf(user) : null;
  if (!o && plz) {
    const p = await plzInfo(plz);
    if (p) {
      o = { lat: p.lat, lng: p.lng };
      place = p.municipality;
    }
  }

  let initial: WorkHit[] | null = null;
  if (o || loggedIn) {
    try {
      initial = await searchWorks(loggedIn ? user!.id : null, o, {
        q,
        radiusKm: filters.radius,
        offer: filters.offer || undefined,
        availableNow: filters.available,
        language: filters.language || undefined,
        genre: filters.genre || undefined,
        maxCondition: filters.condition || undefined,
      });
    } catch {
      initial = null;
    }
  }

  return (
    <SearchClient
      loggedIn={loggedIn}
      autoFocus={pick(sp.fokus) === "1"}
      initialQ={q}
      initialPlz={plz}
      initialPlace={place}
      initialFilters={filters}
      initialResults={initial}
    />
  );
}
