import { pageUser } from "@/lib/page";
import { IconCheck } from "@/components/icons";
import { Redeem } from "./redeem";
import { getLocale } from "@/lib/i18n/server";
import { LOANS } from "@/lib/i18n/messages/loans";

export async function generateMetadata() {
  return { title: LOANS[await getLocale()].redeem.title };
}

/**
 * Ziel des QR-Codes. Wer mit der normalen Kamera-App scannt, landet hier und bestätigt
 * mit einem Tipp – dieselbe Einlösung wie im Scanner der App.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await pageUser(`/h/${token}`);
  const t = LOANS[await getLocale()].redeem;
  return (
    <div className="min-h-[60vh] grid place-items-center py-2 md:py-8">
      <div className="w-full max-w-md rounded-[12px] border border-line p-7 md:p-10 text-center anim-rise">
        <span className="mx-auto h-14 w-14 rounded-full bg-accent-soft text-accent-hover grid place-items-center anim-pop"><IconCheck width={26} height={26} strokeWidth={2} /></span>
        <p className="eyebrow mt-6">{t.eyebrow}</p>
        <h1 className="display text-[32px] md:text-[44px] mt-3">{t.heading[0]}<em>{t.heading[1]}</em></h1>
        <Redeem token={token} />
      </div>
    </div>
  );
}
