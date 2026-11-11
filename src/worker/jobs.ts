/** Hintergrundaufgaben aus der Postgres-Warteschlange (Tabelle jobs). */
import sharp from "sharp";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/notify/mail";
import { sendSms } from "@/lib/notify/sms";
import { renderNotification, type NotificationType, type NotifyData } from "@/lib/notify";
import { deleteObject, getObjectBytes, keys, putObject } from "@/lib/storage";
import { coverCandidates, fetchImage } from "@/lib/catalog/covers";

type Job = { id: number; kind: string; payload: Record<string, unknown>; attempts: number };

/** Holt die nächste fällige Aufgabe; mehrere Worker stören sich dank SKIP LOCKED nicht. */
export async function nextJob(): Promise<Job | null> {
  const [j] = await sql<Job[]>`
    update jobs set locked_at = now(), attempts = attempts + 1
     where id = (
       select id from jobs
        where done_at is null and run_at <= now() and attempts < 5
          and (locked_at is null or locked_at < now() - interval '5 minutes')
        order by run_at limit 1 for update skip locked)
    returning id, kind, payload, attempts`;
  return j ?? null;
}

export async function runJob(job: Job) {
  try {
    await handlers[job.kind]?.(job.payload);
    await sql`update jobs set done_at = now(), last_error = null where id = ${job.id}`;
  } catch (e) {
    const backoff = Math.min(3600, 30 * 2 ** job.attempts);
    await sql`update jobs set locked_at = null, last_error = ${(e as Error).message.slice(0, 500)},
                              run_at = now() + make_interval(secs => ${backoff}) where id = ${job.id}`;
    console.error(`[job ${job.kind} #${job.id}]`, (e as Error).message);
  }
}

const handlers: Record<string, (p: Record<string, unknown>) => Promise<void>> = {
  async send_email(p) {
    const [n] = await sql<{ id: string; type: NotificationType; payload: NotifyData; loan_id: string | null; email: string; sent_at: Date | null; deleted_at: Date | null }[]>`
      select n.id, n.type, n.payload, n.loan_id, u.email, n.sent_at, u.deleted_at
        from notifications n join users u on u.id = n.user_id where n.id = ${p.notificationId as string}`;
    if (!n || n.sent_at || n.deleted_at) return;
    const { title, body } = renderNotification(n.type, n.payload);
    const href = n.payload.href ? `${env.appUrl}${n.payload.href}` : n.loan_id ? `${env.appUrl}/vorgaenge/${n.loan_id}` : `${env.appUrl}/`;
    await sendMail(n.email, title, body, { href, label: n.loan_id ? "Zum Vorgang" : "Öffnen" });
    await sql`update notifications set sent_at = now() where id = ${n.id}`;
  },

  async send_sms(p) {
    const [n] = await sql<{ id: string; type: NotificationType; payload: NotifyData; phone: string | null; sent_at: Date | null }[]>`
      select n.id, n.type, n.payload, u.phone_e164 as phone, n.sent_at from notifications n join users u on u.id = n.user_id where n.id = ${p.notificationId as string}`;
    if (!n?.phone || n.sent_at) return;
    const { title } = renderNotification(n.type, n.payload);
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
      return;
    }
  },
};
