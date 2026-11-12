/**
 * Dateien im Railway Storage Bucket (PRD 10.3). Buckets sind privat und S3-kompatibel.
 * 1. Der Client fragt einen Upload an, die API stellt einen vorsignierten POST aus.
 * 2. Der Client lädt direkt in den Bucket.
 * 3. Der Worker entfernt Metadaten und erzeugt AVIF- und WebP-Varianten.
 * 4. Ausgeliefert wird über kurzlebige vorsignierte URLs.
 */
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let client: S3Client | null = null;

export function s3() {
  if (!env.s3.configured) throw new Error("Bucket ist nicht konfiguriert (S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)");
  client ??= new S3Client({
    endpoint: env.s3.endpoint,
    region: env.s3.region,
    forcePathStyle: env.s3.forcePathStyle,
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  });
  return client;
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"];

export async function presignUpload(key: string, contentType: string, maxBytes = MAX_UPLOAD_BYTES) {
  return createPresignedPost(s3(), {
    Bucket: env.s3.bucket,
    Key: key,
    Expires: 600,
    Conditions: [
      { bucket: env.s3.bucket },
      ["eq", "$key", key],
      ["eq", "$Content-Type", contentType],
      ["content-length-range", 1_000, maxBytes],
    ],
    Fields: { "Content-Type": contentType },
  });
}

export async function signedGetUrl(key: string, seconds = 3600) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }), { expiresIn: seconds });
}

export async function getObjectBytes(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3().send(
    new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=31536000, immutable" }),
  );
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

/** Alle Objekte unter einem Präfix löschen (z. B. «u/<id>/» bei der Kontolöschung) */
export async function deletePrefix(prefix: string) {
  if (!prefix.endsWith("/") || prefix.length < 4) throw new Error("Unsicheres Präfix");
  let token: string | undefined;
  let n = 0;
  do {
    const list = await s3().send(new ListObjectsV2Command({ Bucket: env.s3.bucket, Prefix: prefix, ContinuationToken: token }));
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) {
      await s3().send(new DeleteObjectsCommand({ Bucket: env.s3.bucket, Delete: { Objects: keys, Quiet: true } }));
      n += keys.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return n;
}

/** Direkte Browser-Uploads brauchen CORS. Versucht es einmal beim Start des Workers. */
export async function ensureCors() {
  if (!env.s3.configured) return false;
  try {
    await s3().send(
      new PutBucketCorsCommand({
        Bucket: env.s3.bucket,
        CORSConfiguration: {
          CORSRules: [{ AllowedOrigins: [env.appUrl], AllowedMethods: ["POST", "GET"], AllowedHeaders: ["*"], MaxAgeSeconds: 3600 }],
        },
      }),
    );
    return true;
  } catch (e) {
    console.warn("[storage] CORS nicht gesetzt, Uploads laufen über die API:", (e as Error).message);
    return false;
  }
}

/** Schlüsselschema (PRD 10.3) */
export const keys = {
  raw: (userId: string, id: string) => `raw/${userId}/${id}`,
  copyPhoto: (userId: string, copyId: string, id: string) => `u/${userId}/copies/${copyId}/${id}`,
  avatar: (userId: string, id: string) => `u/${userId}/avatar/${id}`,
  case: (caseOrLoan: string, id: string) => `cases/${caseOrLoan}/${id}`,
  dropoff: (loanId: string, id: string) => `loans/${loanId}/dropoff/${id}`,
  condition: (loanId: string, id: string) => `loans/${loanId}/condition/${id}`,
  cover: (isbn: string) => `covers/${isbn}`,
};
