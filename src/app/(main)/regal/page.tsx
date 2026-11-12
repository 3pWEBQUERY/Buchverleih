import { pageUser } from "@/lib/page";
import { listShelf } from "@/lib/copies";
import { shelfLoanDays } from "@/lib/regal-queries";
import { RegalView } from "./regal-view";
import { getLocale } from "@/lib/i18n/server";
import { SHELF } from "@/lib/i18n/messages/shelf";

export async function generateMetadata() {
  return { title: SHELF[await getLocale()].title };
}

/** Mein Regal (PRD 8.4): Reihen nach Status, Mehrfachauswahl, Scan-Knopf immer erreichbar. */
export default async function Page() {
  const user = await pageUser("/regal");
  const [copies, loanDays] = await Promise.all([listShelf(user.id), shelfLoanDays(user.id)]);
  return <RegalView copies={copies} loanDays={loanDays} paused={user.shelf_paused} />;
}
