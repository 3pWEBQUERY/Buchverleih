import { pageUser } from "@/lib/page";
import { IconCheck } from "@/components/icons";
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
    <div className="min-h-[60vh] grid place-items-center py-2 md:py-8">
      <div className="w-full max-w-md panel !rounded-[12px] p-7 md:p-10 text-center anim-rise">
        <span className="mx-auto h-14 w-14 rounded-full bg-ink text-paper grid place-items-center anim-pop"><IconCheck width={26} height={26} strokeWidth={2} /></span>
        <p className="eyebrow mt-6">Übergabe</p>
        <h1 className="display text-[48px] md:text-[60px] mt-3">Code <em>gescannt.</em></h1>
        <Redeem token={token} />
      </div>
    </div>
  );
}
