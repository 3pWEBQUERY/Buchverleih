import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { htmlLang, type Locale } from "@/lib/i18n/locale";
import { MAIL } from "./texts";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Transaktions-E-Mail. Railway bietet keinen Mailversand (PRD 10.5);
 * angebunden wird ein SMTP-Anbieter mit EU-Standort über SMTP_URL.
 * Ohne Konfiguration landet die Mail im Log.
 */
export async function sendMail(to: string, subject: string, text: string, link?: { href: string; label: string }, l: Locale = "de") {
  const m = MAIL[l] ?? MAIL.de;
  const body = link ? `${text}\n\n${link.label}: ${link.href}\n` : text;
  // Demo-Konten (…@demo.leihregal.invalid) bekommen nie Post
  if (/\.invalid$/i.test(to)) return;
  if (!env.smtpUrl) {
    // In Produktion nicht still verschlucken: der Job scheitert sichtbar, die Anmeldung meldet einen klaren Fehler.
    // Nie Inhalt oder Links ins Log schreiben: Anmeldelinks wären sonst für alle mit Log-Zugriff nutzbar.
    if (env.production) {
      console.error(`[mail] nicht gesendet, SMTP_URL fehlt · ${subject}`);
      throw new AppError(503, "mail_unavailable", "Der E-Mail-Versand ist noch nicht eingerichtet. Bitte versuche es später erneut.");
    }
    console.log(`[mail] an ${to} · ${subject}\n${body}`);
    return;
  }
  // Feste Zeitlimits: ein hängender Mailserver darf weder den Worker noch die Anmeldung minutenlang blockieren
  transport ??= nodemailer.createTransport({ url: env.smtpUrl, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  await transport.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text: `${body}\n—\nLeihregal · ${m.tagline}\n${m.changeNotifications}: ${env.appUrl}/einstellungen`,
    html: renderHtml(subject, text, link, l),
    // Mailprogramme zeigen damit «Abmelden»; führt zu den E-Mail-Einstellungen
    headers: { "List-Unsubscribe": `<${env.appUrl}/einstellungen#benachrichtigungen>` },
  });
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function renderHtml(subject: string, text: string, link: { href: string; label: string } | undefined, l: Locale) {
  const m = MAIL[l] ?? MAIL.de;
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = link
    ? `<p style="margin:24px 0"><a href="${esc(link.href)}" style="display:inline-block;background:#d23c1a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600">${esc(link.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="${htmlLang[l]}"><body style="margin:0;background:#faf8f4;color:#141413;font:16px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font:600 20px/1 Georgia,serif;margin:0 0 32px">Leihregal</p>
<h1 style="font:500 24px/1.25 Georgia,serif;margin:0 0 16px">${esc(subject)}</h1>
${paras}${button}
<p style="margin:40px 0 0;padding-top:16px;border-top:1px solid #e3ddd2;color:#6c665c;font-size:13px">${esc(m.changeNotifications)}: <a href="${env.appUrl}/einstellungen" style="color:#6c665c">${esc(m.settings)}</a></p>
</div></body></html>`;
}
