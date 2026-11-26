import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { pageUser } from "@/lib/page";
import { getUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { circleFor, type Circle } from "@/lib/circles";
import { Spine } from "@/components/spine";
import { IconArrowLeft } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import { CIRCLES } from "@/lib/i18n/messages/circles";
import { PrintButton } from "./print-button";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Allgemeine Titel statt der Bücher im Kreis: das Plakat hängt öffentlich, die Regale der Mitglieder bleiben privat */
const SPINES = [
  "Heidi", "Homo faber", "Momo", "Der Richter und sein Henker", "Die schwarze Spinne", "Stiller", "Der grüne Heinrich",
  "Der Besuch der alten Dame", "Die kleine Hexe", "Uli der Knecht", "Schellen-Ursli", "Mein Name sei Gantenbein",
  "Der Process", "Krabat", "Die Physiker", "Pippi Langstrumpf", "Andorra", "Der kleine Prinz",
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = CIRCLES[await getLocale()];
  if (!UUID.test(id)) return { title: t.circle };
  const u = await getUser();
  const [c] = u ? await sql<{ name: string }[]>`
    select ci.name from circles ci join circle_members m on m.circle_id = ci.id and m.user_id = ${u.id} and m.status = 'active'
     where ci.id = ${id}` : [];
  return { title: c ? t.poster.title(c.name) : t.circle };
}

/**
 * Druckbares Einladungsplakat (A4 hochformatig) für Treppenhaus, Schule oder Büro:
 * Name, kurze Einladung, grosser QR-Code des Einladungslinks, der Link ausgeschrieben, Logo
 * und unten ein Brett mit Buchrücken. Nur für aktive Mitglieder, die den Link sehen dürfen.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/kreise/${id}/plakat`);
  if (!UUID.test(id)) notFound();
  const l = await getLocale();
  const t = CIRCLES[l];
  const p = t.poster;

  let circle: Circle;
  try {
    circle = await circleFor(id, user.id);
  } catch {
    notFound();
  }
  // Wie auf der Kreisseite: den Link sehen Admins oder alle, wenn der Beitritt per Link offen ist
  const url = circle.my_role === "admin" || circle.join_mode === "link" ? `${env.appUrl}/k/${circle.invite_code}` : null;

  if (!url) {
    return (
      <div className="max-w-2xl">
        <Link href={`/kreise/${circle.id}`} className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted hover:text-ink transition-colors mb-6 min-h-11 -my-2">
          <IconArrowLeft width={16} height={16} /> {p.back}
        </Link>
        <h1 className="display text-display">{circle.name}<em>.</em></h1>
        <p className="text-lead text-ink-2 mt-6">{t.client.askAdmin}</p>
      </div>
    );
  }

  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#141413", light: "#ffffff" } });

  return (
    <div>
      {/* A4 hochformatig, ohne Ränder; beim Drucken erscheint nur das Plakat */}
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        .circle-poster { container-type: inline-size; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .circle-poster svg { display: block; width: 100%; height: auto; }
        @media print {
          body:has(.circle-poster) * { visibility: hidden; }
          body:has(.circle-poster) .circle-poster, body:has(.circle-poster) .circle-poster * { visibility: visible; }
          body:has(.circle-poster) .circle-poster { position: absolute; inset: 0 auto auto 0; width: 210mm; height: 297mm; max-width: none; margin: 0; border-radius: 0; box-shadow: none; border: 0; }
        }
      `}</style>

      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/kreise/${circle.id}`} className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted hover:text-ink transition-colors min-h-11">
          <IconArrowLeft width={16} height={16} /> {p.back}
        </Link>
        <PrintButton label={p.print} />
      </div>
      <p className="print:hidden text-body-sm text-muted mb-6 max-w-2xl">{p.hint}</p>

      {/* Festes Weiss und feste Tinte: das Plakat sieht auch im Dunkelmodus aus wie gedruckt */}
      <article className="circle-poster relative mx-auto w-full max-w-[794px] aspect-[210/297] overflow-hidden rounded-md border border-line bg-white text-[#141413] flex flex-col">
        <div className="flex-1 flex flex-col px-[9cqw] pt-[8cqw] min-h-0">
          <div className="flex items-center gap-[2cqw]">
            <img src="/brand/logo.svg" alt="Leihregal" width={64} height={64} className="w-[7cqw] h-[7cqw]" />
            <span className="text-[3.2cqw] font-semibold tracking-tight">Leihregal</span>
          </div>
          <p className="mt-[6cqw] text-[2.6cqw] font-medium uppercase tracking-caps text-[#6c665c]">{p.eyebrow}</p>
          <h1 className="mt-[1.5cqw] font-serif text-[7.4cqw] leading-[1.05] tracking-tight break-words">{circle.name}</h1>
          <p className="mt-[2.5cqw] text-[4.2cqw] font-semibold leading-tight">{p.heading}</p>
          <p className="mt-[2cqw] text-[2.7cqw] leading-relaxed text-[#3b3934] max-w-[64cqw]">{p.text(circle.name)}</p>

          <div className="mt-[5cqw] flex items-end gap-[5cqw]">
            <div role="img" aria-label={p.qrLabel(circle.name)} className="w-[40cqw] flex-none" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="min-w-0 pb-[1cqw]">
              <p className="text-[3cqw] font-semibold leading-snug">{p.scan}</p>
              <p className="mt-[2cqw] text-[2.3cqw] text-[#525252]">{p.orOpen}</p>
              <p className="text-[2.6cqw] font-medium break-all tnum">{url.replace(/^https?:\/\//, "")}</p>
              {circle.join_mode === "approval" && <p className="mt-[2cqw] text-[2.3cqw] text-[#525252]">{p.approval}</p>}
            </div>
          </div>
        </div>

        {/* Buchrücken auf dem Eichenbrett */}
        <div aria-hidden className="flex-none mt-[4cqw] bg-[#3b3b3b] pt-[4cqw]">
          <div className="flex items-end gap-[3px] px-[6cqw] h-[150px] overflow-hidden">
            {SPINES.map((s) => <Spine key={s} title={s} height={150} />)}
          </div>
          <div className="shelf-plank !h-[14px]" />
          <div className="h-[4cqw]" />
        </div>
      </article>
    </div>
  );
}
