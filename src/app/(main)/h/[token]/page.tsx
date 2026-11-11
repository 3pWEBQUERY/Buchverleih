import { pageUser } from "@/lib/page";
import { Redeem } from "./redeem";

export const metadata = { title: "Übergabe" };

/**
 * Ziel des QR-Codes. Wer mit der normalen Kamera-App scannt, landet hier und bestätigt
 * mit einem Tipp – dieselbe Einlösung wie im Scanner der App.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await pageUser(`/h/${token}`);
  return (
    <div className="max-w-md pt-6">
      <p className="eyebrow">Übergabe</p>
      <h1 className="display text-5xl mt-3">Code gescannt.</h1>
      <Redeem token={token} />
    </div>
  );
}
