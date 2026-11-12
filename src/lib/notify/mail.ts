import nodemailer from "nodemailer";
import { env } from "@/lib/env";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Transaktions-E-Mail. Railway bietet keinen Mailversand (PRD 10.5);
 * angebunden wird ein SMTP-Anbieter mit EU-Standort über SMTP_URL.
 * Ohne Konfiguration landet die Mail im Log.
 */
export async function sendMail(to: string, subject: string, text: string, link?: { href: string; label: string }) {
  const body = link ? `${text}\n\n${link.label}: ${link.href}\n` : text;
  // Demo-Konten (…@demo.leihregal.invalid) bekommen nie Post
  if (/\.invalid$/i.test(to)) return;
  if (!env.smtpUrl) {
    // In Produktion nie Inhalt oder Links ins Log schreiben: Anmeldelinks wären sonst für alle mit Log-Zugriff nutzbar
    if (env.production) console.warn(`[mail] nicht gesendet, SMTP_URL fehlt · ${subject}`);
    else console.log(`[mail] an ${to} · ${subject}\n${body}`);
    return;
  }
  transport ??= nodemailer.createTransport(env.smtpUrl);
  await transport.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text: `${body}\n—\nLeihregal · Bücher aus Regalen in deiner Nähe\nBenachrichtigungen ändern: ${env.appUrl}/einstellungen`,
    html: renderHtml(subject, text, link),
  });
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function renderHtml(subject: string, text: string, link?: { href: string; label: string }) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = link
    ? `<p style="margin:24px 0"><a href="${esc(link.href)}" style="display:inline-block;background:#d23c1a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600">${esc(link.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="de-CH"><body style="margin:0;background:#faf8f4;color:#141413;font:16px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font:600 20px/1 Georgia,serif;margin:0 0 32px">Leihregal</p>
<h1 style="font:500 24px/1.25 Georgia,serif;margin:0 0 16px">${esc(subject)}</h1>
${paras}${button}
<p style="margin:40px 0 0;padding-top:16px;border-top:1px solid #e3ddd2;color:#6c665c;font-size:13px">Benachrichtigungen ändern: <a href="${env.appUrl}/einstellungen" style="color:#6c665c">Einstellungen</a></p>
</div></body></html>`;
}
