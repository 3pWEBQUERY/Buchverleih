/**
 * Zugänglichkeitsprüfung mit axe (WCAG 2.2 A/AA) gegen eine laufende Instanz mit Beispieldaten.
 * Start, Suche, Exemplar, Vorgang, Kreis und Einstellungen – jeweils hell und dunkel, 390 und 1440 px.
 * Schlägt fehl, sobald axe einen Befund der Stufe «serious» oder «critical» meldet.
 *
 *   SEED_CONFIRM=yes npm run seed && npm run build && npm start &   # oder npm run dev
 *   npm run a11y                                                    # BASE_URL, A11Y_EMAIL optional
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import postgres from "postgres";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.A11Y_EMAIL ?? "marc@beispiel.ch";
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/leihregal");

async function main() {
  const [user] = await sql<{ id: string }[]>`select id from users where email = ${EMAIL}`;
  if (!user) throw new Error(`Kein Konto ${EMAIL}. Zuerst: SEED_CONFIRM=yes npm run seed`);
  const token = randomBytes(32).toString("hex");
  await sql`insert into sessions (user_id, token_hash, kind, expires_at)
            values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, 'web', now() + interval '1 hour')`;

  // Je eine echte Seite pro Typ aus den Beispieldaten
  const [copy] = await sql<{ id: string }[]>`select id from copies where owner_id <> ${user.id} and removed_at is null and cardinality(offers) > 0 order by created_at limit 1`;
  const [loan] = await sql<{ id: string }[]>`select id from loans where ${user.id} in (owner_id, borrower_id) order by requested_at desc limit 1`;
  const [circle] = await sql<{ circle_id: string }[]>`select circle_id from circle_members where user_id = ${user.id} and status = 'active' limit 1`;
  const pages: [string, string][] = [["Start", "/"], ["Suche", "/suche?q=der"], ["Einstellungen", "/einstellungen"], ["Import", "/regal/import"], ["Kreis", "/kreise"], ["Statistik", "/regal/statistik"], ["Kreisdetail", "/kreise/ccb7141f-1f1e-420e-ab13-13f84abda138"]];
  if (copy) pages.push(["Exemplar", `/exemplar/${copy.id}`]);
  if (loan) pages.push(["Vorgang", `/vorgaenge/${loan.id}`]);
  if (circle) pages.push(["Kreis", `/kreise/${circle.circle_id}`]);
  for (const [need, row] of [["Exemplar", copy], ["Vorgang", loan], ["Kreis", circle]] as const) {
    if (!row) console.warn(`Hinweis: keine Beispieldaten für «${need}» – Seite wird übersprungen.`);
  }

  // In der CI lädt «npx playwright install chromium» den Browser; lokal darf einer vorinstalliert sein
  const local = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(existsSync(local) && !process.env.CI ? { executablePath: local } : {});
  const failures: string[] = [];
  let checked = 0;
  for (const width of [390, 1440]) {
    for (const colorScheme of ["light", "dark"] as const) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme, locale: "de-CH", reducedMotion: "reduce" });
      await ctx.addCookies([{ name: "lr_session", value: token, url: BASE }]);
      const page = await ctx.newPage();
      for (const [name, path] of pages) {
        await page.goto(BASE + path, { waitUntil: "networkidle" });
        const res = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        checked++;
        for (const v of res.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
          failures.push(`${name} · ${width}px · ${colorScheme}: [${v.impact}] ${v.id} – ${v.help}\n` +
            v.nodes.slice(0, 4).map((n) => `      ${n.target.join(" ")}  ${(n.failureSummary ?? "").split("\n")[1] ?? ""}`).join("\n"));
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  await sql`delete from sessions where token_hash = ${createHash("sha256").update(token).digest("hex")}`;
  await sql.end();
  if (failures.length) {
    console.error(`axe: ${failures.length} Befunde (serious/critical) auf ${checked} Ansichten:\n\n` + failures.map((f) => `  · ${f}`).join("\n\n"));
    process.exit(1);
  }
  console.log(`axe: ${checked} Ansichten geprüft, keine Befunde der Stufe serious oder critical.`);
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
