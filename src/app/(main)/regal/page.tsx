import { pageUser } from "@/lib/page";
import { listShelf } from "@/lib/copies";
import { shelfLoanDays } from "@/lib/regal-queries";
import { RegalView } from "./regal-view";

export const metadata = { title: "Mein Regal" };

/** Mein Regal (PRD 8.4): Reihen nach Status, Mehrfachauswahl, Scan-Knopf immer erreichbar. */
export default async function Page() {
  const user = await pageUser("/regal");
  const [copies, loanDays] = await Promise.all([listShelf(user.id), shelfLoanDays(user.id)]);
  return <RegalView copies={copies} loanDays={loanDays} paused={user.shelf_paused} />;
}
