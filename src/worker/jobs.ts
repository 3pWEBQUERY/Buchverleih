/** Hintergrundaufgaben aus der Postgres-Warteschlange (Tabelle jobs). */
import sharp from "sharp";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/notify/mail";
import { sendSms } from "@/lib/notify/sms";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";
import { deleteObject, getObjectBytes, keys, putObject } from "@/lib/storage";
import { coverCandidates, fetchImage } from "@/lib/catalog/covers";
import { removeDemo, seedDemo } from "./seed-demo";
import { pushToUser } from "@/lib/push";
import { MAIL } from "@/lib/notify/texts";
import { isLocale, type Locale } from "@/lib/i18n/locale";

let warnedNoMail = false;
const loc = (x: unknown): Locale => (isLocale(x) ? x : "de");

type Job = { id: number; kind: string; payload: Record<string, unknown>; attempts: number };

/** Holt die nächste fällige Aufgabe; mehrere Worker stören sich dank SKIP LOCKED nicht. */
export async function nextJob(): Promise<Job | null> {
  const [j] = await sql<Job[]>`
    update jobs set locked_at = now(), attempts = attempts + 1
     where id = (
       select id from jobs
        where done_at is null and run_at <= now() and attempts < 5
          and (locked_at is null or locked_at < now() - interval '5 minutes')
        -- Mails und SMS zuerst, damit sie nicht hinter Cover-Jobs warten
        order by (kind in ('send_email', 'send_sms', 'send_push')) desc, run_at limit 1 for update skip locked)
    returning id, kind, payload, attempts`;
  return j ?? null;
}

export async function runJob(job: Job) {
  try {
    const handler = handlers[job.kind];
    // Unbekannte Arten nicht still als erledigt markieren: sie landen nach den Versuchen sichtbar als tot
    if (!handler) throw new Error(`Kein Handler für «${job.kind}»`);
    await handler(job.payload);
    await sql`update jobs set done_at = now(), last_error = null where id = ${job.id}`;
  } catch (e) {
    const backoff = Math.min(3600, 30 * 2 ** job.attempts);
    console.error(`[job ${job.kind} #${job.id}]`, (e as Error).message);
    // Auch dieses Update kann scheitern (DB weg): nicht den ganzen Worker beenden, der Lock läuft nach 5 Min. ab
    await sql`update jobs set locked_at = null, last_error = ${(e as Error).message.slice(0, 500)},
                              run_at = now() + make_interval(secs => ${backoff}) where id = ${job.id}`
      .catch((e2) => console.error(`[job ${job.kind} #${job.id}] Status nicht gespeichert:`, (e2 as Error).message));
  }
}

const handlers: Record<string, (p: Record<string, unknown>) => Promise<void>> = {
  /** Einmaliger Demo-Bestand für die Beta (siehe seed-demo.ts) */
  async seed_demo() {
    // Nie zweimal gleichzeitig (der Job kann länger als die 5-Minuten-Sperre laufen)
    const conn = await sql.reserve();
    try {
      const [l] = await conn<{ ok: boolean }[]>`select pg_try_advisory_lock(515151) as ok`;
      if (!l?.ok) return;
      try { await seedDemo(sql); } finally { await conn`select pg_advisory_unlock(515151)`.catch(() => {}); }
    } finally {
      conn.release();
    }
  },
  async remove_demo() {
    await removeDemo(sql);
  },

  async send_email(p) {
    const [n] = await sql<{ id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; email: string; sent_at: Date | null; deleted_at: Date | null; locale: string }[]>`
      select n.id, n.type, n.payload, n.loan_id, u.email, n.sent_at, u.deleted_at, u.locale
        from notifications n join users u on u.id = n.user_id where n.id = ${p.notificationId as string}`;
    if (!n || n.sent_at || n.deleted_at) return;
    // Ohne Mailanbieter: Benachrichtigung überspringen statt fünfmal scheitern (die App zeigt sie trotzdem)
    if (!env.smtpUrl && env.production) {
      if (!warnedNoMail) console.warn("[mail] SMTP_URL fehlt – E-Mail-Benachrichtigungen werden übersprungen");
      warnedNoMail = true;
      return;
    }
    const l = loc(n.locale);
    const { title, body } = renderNotification(n.type, n.payload, l);
    const href = n.payload.href ? `${env.appUrl}${n.payload.href}` : n.loan_id ? `${env.appUrl}/vorgaenge/${n.loan_id}` : `${env.appUrl}/`;
    await sendMail(n.email, title, body, { href, label: n.loan_id ? MAIL[l].toLoan : MAIL[l].open }, l);
    await sql`update notifications set sent_at = now() where id = ${n.id}`;
  },

  /** Push an alle Geräte. Schon gelesene Benachrichtigungen (live in der App gesehen) nicht mehr schicken. */
  async send_push(p) {
    const [n] = await sql<{ id: string; user_id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; read_at: Date | null; created_at: Date; locale: string }[]>`
      select n.id, n.user_id, n.type, n.payload, n.loan_id, n.read_at, n.created_at, u.locale
        from notifications n join users u on u.id = n.user_id
       where n.id = ${p.notificationId as string} and u.deleted_at is null and u.banned_at is null`;
    if (!n || n.read_at) return;
    // Nach einem Ausfall keine veralteten Hinweise nachschieben
    if (Date.now() - n.created_at.getTime() > 24 * 3600_000) return;
    const { title, body } = renderNotification(n.type, n.payload, loc(n.locale));
    const href = n.payload.href ?? (n.loan_id ? `/vorgaenge/${n.loan_id}` : "/benachrichtigungen");
    await pushToUser(n.user_id, { title, body, href, tag: n.loan_id ? `loan-${n.loan_id}` : n.id });
  },

  async send_push_test(p) {
    const [u] = await sql<{ locale: string }[]>`select locale from users where id = ${p.userId as string}`;
    const text = {
      de: ["Push ist eingerichtet", "So erscheinen Anfragen, Zusagen und Fristen auf diesem Gerät."],
      fr: ["Les notifications push sont activées", "Les demandes, réponses et échéances s’afficheront ainsi sur cet appareil."],
      it: ["Le notifiche push sono attive", "Richieste, conferme e scadenze appariranno così su questo dispositivo."],
    }[loc(u?.locale)];
    await pushToUser(p.userId as string, { title: text[0], body: text[1], href: "/einstellungen#push", tag: "test" });
  },

  async send_sms(p) {
    const [n] = await sql<{ id: string; type: NotificationType; payload: NotifyData; phone: string | null; sent_at: Date | null; locale: string }[]>`
      select n.id, n.type, n.payload, u.phone_e164 as phone, n.sent_at, u.locale from notifications n join users u on u.id = n.user_id where n.id = ${p.notificationId as string}`;
    if (!n?.phone || n.sent_at) return;
    const { title } = renderNotification(n.type, n.payload, loc(n.locale));
    await sendSms(n.phone, `Leihregal: ${title}. ${env.appUrl}`);
    await sql`update notifications set sent_at = now() where id = ${n.id}`;
  },

  /**
   * Prüft die Datei, entfernt Metadaten (Standort im Foto) und erzeugt Varianten in AVIF und WebP.
   * Varianten: {key}.avif, {key}.webp (bis 1600 px) und {key}-480.avif, {key}-480.webp
   */
  async process_upload(p) {
    const [u] = await sql<{ id: string; raw_key: string; key: string; status: string }[]>`
      select id, raw_key, key, status from uploads where id = ${p.uploadId as string}`;
    if (!u || u.status === "processed") return;
    const raw = await getObjectBytes(u.raw_key);
    let img: ReturnType<typeof sharp>;
    let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
    try {
      img = sharp(raw, { failOn: "error" }).rotate(); // EXIF-Ausrichtung anwenden; Metadaten werden nicht übernommen
      meta = await img.metadata();
      if (!meta.width || !meta.height || meta.width * meta.height > 60_000_000) throw new Error("ungültige Grösse");
      // Nur echte Fotos: tatsächliches Format prüfen (nicht dem Content-Type vertrauen; kein SVG, PDF, GIF …)
      if (!["jpeg", "png", "webp", "heif", "avif"].includes(meta.format ?? "")) throw new Error(`Format ${meta.format} nicht erlaubt`);
    } catch {
      await sql`update uploads set status = 'rejected' where id = ${u.id}`;
      await deleteObject(u.raw_key).catch(() => {});
      return;
    }
    const swap = (meta.orientation ?? 1) >= 5;
    const w = swap ? meta.height! : meta.width!;
    const h = swap ? meta.width! : meta.height!;
    for (const [suffix, size] of [["", 1600], ["-480", 480]] as const) {
      const base = sharp(raw).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true });
      await putObject(`${u.key}${suffix}.avif`, await base.clone().avif({ quality: 55 }).toBuffer(), "image/avif");
      await putObject(`${u.key}${suffix}.webp`, await base.clone().webp({ quality: 78 }).toBuffer(), "image/webp");
    }
    const scale = Math.min(1, 1600 / Math.max(w, h));
    const fw = Math.round(w * scale);
    const fh = Math.round(h * scale);
    await sql`update uploads set status = 'processed', width = ${fw}, height = ${fh}, processed_at = now() where id = ${u.id}`;
    await sql`update copy_photos set width = ${fw}, height = ${fh} where key = ${u.key}`;
    await deleteObject(u.raw_key).catch(() => {});
  },

  /** Original-Cover suchen, Metadaten entfernen, AVIF/WebP-Varianten im Bucket ablegen. */
  async cache_cover(p) {
    const isbn = p.isbn as string;
    const urls = p.url ? [p.url as string] : await coverCandidates(isbn);
    for (const url of urls) {
      const buf = await fetchImage(url);
      if (!buf) continue;
      let meta;
      try {
        meta = await sharp(buf).metadata();
      } catch {
        continue;
      }
      if (!meta.width || !meta.height || meta.height < 160 || meta.width / meta.height > 1.2) continue; // zu klein oder kein Buchformat
      const key = keys.cover(isbn);
      const big = sharp(buf).rotate().resize({ width: 900, height: 1350, fit: "inside", withoutEnlargement: true });
      const out = await big.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      await putObject(`${key}.webp`, out.data, "image/webp");
      await putObject(`${key}.avif`, await big.clone().avif({ quality: 58 }).toBuffer(), "image/avif");
      const small = sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true });
      await putObject(`${key}-480.webp`, await small.clone().webp({ quality: 80 }).toBuffer(), "image/webp");
      await putObject(`${key}-480.avif`, await small.clone().avif({ quality: 55 }).toBuffer(), "image/avif");
      await sql`update editions set cover_key = ${key}, cover_w = ${out.info.width}, cover_h = ${out.info.height} where isbn13 = ${isbn}`;
      console.log(`[covers] ${isbn} gespeichert (${new URL(url).hostname})`);
      return;
    }
    console.log(`[covers] ${isbn} kein Cover gefunden (${urls.length} Quellen geprüft)`);
  },
};
