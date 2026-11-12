/**
 * Übersetzung der Server-Meldungen: jede deutsche Meldung im Code hat einen französischen
 * und italienischen Eintrag (ERRORS oder ERROR_PATTERNS). Kommt eine neue Meldung dazu,
 * schlägt dieser Test fehl, bis sie übersetzt ist.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ERRORS, ERROR_PATTERNS, translateError } from "@/lib/i18n/messages/errors";
import { renderNotification } from "@/lib/notify";
import { systemText } from "@/lib/notify/system-texts";
import { requestLocale } from "@/lib/api";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return p.includes("i18n") ? [] : files(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

/** Argumente von err.*(…) und new AppError(…) mit Klammer-Zählung */
function messagesIn(src: string) {
  const out: { text: string; template: boolean }[] = [];
  const re = /err\.(invalid|conflict|forbidden|notFound|tooMany)\(|new AppError\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let i = m.index + m[0].length, depth = 1, q: string | null = null;
    const start = i;
    for (; i < src.length && depth; i++) {
      const c = src[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; }
      else if (c === '"' || c === "`" || c === "'") q = c;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    const arg = src.slice(start, i - 1);
    for (const s of arg.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      const text = s[1] ?? s[2];
      if (text.includes(" ")) out.push({ text, template: s[2] !== undefined && text.includes("${") });
    }
  }
  return out;
}

const root = path.resolve(__dirname, "..");
const sources = ["src/lib", "src/app/api", "src/worker"].flatMap((d) => files(path.join(root, d))).map((f) => readFileSync(f, "utf8"));
const literals = [...new Set(sources.flatMap(messagesIn).filter((m) => !m.template).map((m) => m.text))]
  // Teilstücke aus verschachtelten Template-Ausdrücken (z. B. «einen offenen Vorgang») sind keine ganzen Meldungen
  .filter((t) => /[.!?]$|^[a-zäöü]/.test(t) || t.length > 25);

describe("Server-Meldungen", () => {
  it("jede wörtliche Meldung ist übersetzt", () => {
    expect(literals.length).toBeGreaterThan(90);
    const missing = literals.filter((t) => !ERRORS[t] && !ERROR_PATTERNS.some((p) => p.re.test(t)));
    expect(missing).toEqual([]);
  });

  it("Meldungen aus Voraussetzungen und Fehlerantworten sind übersetzt", () => {
    const trust = readFileSync(path.join(root, "src/lib/trust.ts"), "utf8");
    const returned = [...trust.matchAll(/return "([^"]+)"/g)].map((m) => m[1]).filter((t) => t.includes(" "));
    const api = readFileSync(path.join(root, "src/lib/api.ts"), "utf8");
    const answers = [...api.matchAll(/message: "([^"]+)"/g)].map((m) => m[1]);
    for (const t of [...returned, ...answers]) expect(ERRORS[t], t).toBeDefined();
  });

  it("Einträge sind vollständig und nicht deutsch geblieben", () => {
    for (const [de, [fr, it]] of Object.entries(ERRORS)) {
      expect(fr && it, de).toBeTruthy();
      expect(fr, de).not.toBe(de);
      expect(it, de).not.toBe(de);
    }
  });

  it("Muster setzen Zahlen und Namen ein", () => {
    expect(translateError("Du hast 3 offene Anfragen, das ist deine Grenze. Warte auf Antworten oder ziehe eine Anfrage zurück.", "fr")).toContain("3 demandes");
    expect(translateError("Marc hat gerade schon 2 Leihen laufen oder gebucht, mehr sind mit der aktuellen Stufe nicht möglich. Die Anfrage kann erst später angenommen werden.", "it")).toMatch(/^Marc ha già 2 prestiti/);
    expect(translateError("Du hast noch 2 offene Vorgänge. Schliesse sie ab, dann kannst du dein Konto löschen.", "fr")).toContain("2 transactions");
    expect(translateError("Du hast noch einen offenen Vorgang. Schliesse ihn ab, dann kannst du dein Konto löschen.", "it")).toContain("una pratica");
    expect(translateError("Nicht gefunden.", "de")).toBe("Nicht gefunden.");
    expect(translateError("Etwas Unbekanntes.", "fr")).toBe("Etwas Unbekanntes.");
  });

  it("Sprache der Anfrage: Cookie vor Browser", () => {
    const r = (h: Record<string, string>) => requestLocale(new Request("http://x/api", { headers: h }));
    expect(r({ cookie: "a=1; lr_lang=it", "accept-language": "fr-CH" })).toBe("it");
    expect(r({ "accept-language": "fr-CH,fr;q=0.9,de;q=0.8" })).toBe("fr");
    expect(r({})).toBe("de");
  });
});

describe("Systemtexte in Benachrichtigungen", () => {
  it("werden in der Sprache der Person gezeigt, deutsch bleibt gleich", () => {
    const d = { title: "Stiller", ...systemText("title_alarm_free", { meters: 1400 }) };
    expect(d.text).toBe("Ein Exemplar ist 1,4 km entfernt frei.");
    expect(renderNotification("title_alarm", d, "de").body).toBe("Ein Exemplar ist 1,4 km entfernt frei.");
    expect(renderNotification("title_alarm", d, "fr").body).toBe("Un exemplaire est libre à 1,4 km.");
    expect(renderNotification("pass_on_ask", { title: "X", ...systemText("pass_on_owner", { from: "Lea", to: "Jonas" }) }, "it").body).toBe("Passare direttamente da Lea a Jonas?");
    // Alte Einträge ohne Schlüssel: Text wie gespeichert
    expect(renderNotification("case_resolved", { title: "X", text: "Das Buch ist zurück." }, "fr").body).toBe("Das Buch ist zurück.");
  });
});
