import { env } from "@/lib/env";

/**
 * SMS nur für Verifikation und Streitfall ab Tag 7 (PRD 7.6).
 * Anbieter ist offen (PRD 14); angebunden wird er über einen Webhook.
 */
export async function sendSms(to: string, text: string) {
  if (env.smsProvider !== "webhook" || !process.env.SMS_WEBHOOK_URL) {
    console.log(`[sms] an ${to}: ${text}`);
    return;
  }
  const res = await fetch(process.env.SMS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.SMS_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to, text }),
  });
  if (!res.ok) throw new Error(`SMS-Versand fehlgeschlagen: ${res.status}`);
}
