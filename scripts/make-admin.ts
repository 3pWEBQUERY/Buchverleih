/**
 * Konto zum Admin machen, ohne bestätigte E-Mail (ADMIN_EMAILS verlangt eine bestätigte Adresse,
 * was ohne Mailversand nicht geht). Auf Railway im laufenden Dienst ausführen:
 *   railway ssh --service web -- npx tsx scripts/make-admin.ts name@beispiel.ch
 * Wer den Befehl ausführt, bürgt für die Adresse: sie gilt danach als bestätigt.
 */
import { sql } from "@/lib/db";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Aufruf: npx tsx scripts/make-admin.ts name@beispiel.ch");
  process.exit(1);
}
const [u] = await sql<{ id: string }[]>`
  update users set role = 'admin', admin_via_env = false, email_verified_at = coalesce(email_verified_at, now())
   where lower(email) = ${email} and deleted_at is null returning id`;
if (!u) {
  console.error("Kein Konto mit dieser E-Mail-Adresse.");
  await sql.end();
  process.exit(1);
}
await sql`insert into moderation_log (moderator_id, action, target_type, target_id, note) values (${u.id}, 'role_admin', 'user', ${u.id}, 'scripts/make-admin.ts')`;
console.log(`${email} ist jetzt Admin.`);
await sql.end();
