/**
 * Einmal-Passwort für ein Konto setzen, ohne Mail- oder SMS-Versand (z. B. für den ersten Admin).
 * Auf Railway im laufenden Dienst ausführen, damit die interne DATABASE_URL gilt:
 *   railway ssh --service web -- npx tsx scripts/set-password.ts name@beispiel.ch
 * Gibt das neue Passwort einmal aus. Die Person ändert es danach in den Einstellungen.
 */
import { sql } from "@/lib/db";
import { setPassword } from "@/lib/auth/flows";
import { shortCode } from "@/lib/crypto";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Aufruf: npx tsx scripts/set-password.ts name@beispiel.ch");
  process.exit(1);
}
const [u] = await sql<{ id: string }[]>`select id from users where lower(email) = ${email} and deleted_at is null`;
if (!u) {
  console.error("Kein Konto mit dieser E-Mail-Adresse.");
  await sql.end();
  process.exit(1);
}
const password = `${shortCode(4)}-${shortCode(4)}-${shortCode(4)}`;
await setPassword(u.id, password);
console.log(`Einmal-Passwort für ${email}: ${password}`);
await sql.end();
