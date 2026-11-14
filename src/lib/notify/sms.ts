import { env } from "@/lib/env";

/**
 * SMS nur für Verifikation und Streitfall ab Tag 7 (PRD 7.6).
 * Anbieter: ASPSMS (Schweiz) über die JSON-Schnittstelle, oder ein eigener Webhook.
 * Ohne Anbieter landet der Text in der Entwicklung im Log; in Produktion wird gewarnt.
 *
 *   SMS_PROVIDER=aspsms   ASPSMS_USERKEY, ASPSMS_PASSWORD, optional ASPSMS_ORIGINATOR (höchstens 11 Zeichen)
 *   SMS_PROVIDER=webhook  SMS_WEBHOOK_URL, optional SMS_WEBHOOK_TOKEN
 */
const ASPSMS_URL = "https://json.aspsms.com/SendSimpleTextSMS";

/** Ist ein Anbieter vollständig eingerichtet? Nur dann darf die Mobilnummer Pflicht sein. */
export function smsConfigured() {
  if (env.smsProvider === "aspsms") return Boolean(process.env.ASPSMS_USERKEY && process.env.ASPSMS_PASSWORD);
  if (env.smsProvider === "webhook") return Boolean(process.env.SMS_WEBHOOK_URL);
  return false;
}

export async function sendSms(to: string, text: string) {
  if (!smsConfigured()) {
    if (env.production) console.warn("[sms] nicht gesendet, kein SMS-Anbieter eingerichtet");
    else console.log(`[sms] an ${to}: ${text}`);
    return;
  }
  if (env.smsProvider === "aspsms") return sendAspsms(to, text);
  const res = await fetch(process.env.SMS_WEBHOOK_URL!, {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.SMS_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to, text }),
  });
  if (!res.ok) throw new Error(`SMS-Versand fehlgeschlagen: ${res.status}`);
}

/**
 * ASPSMS antwortet auch bei Fehlern mit HTTP 200; massgebend ist StatusCode «1» im JSON
 * (z. B. 3 = Zugangsdaten falsch, 5 = kein Guthaben). Zugangsdaten und Code stehen nie im Log.
 */
async function sendAspsms(to: string, text: string) {
  const res = await fetch(ASPSMS_URL, {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      UserName: process.env.ASPSMS_USERKEY,
      Password: process.env.ASPSMS_PASSWORD,
      Originator: (process.env.ASPSMS_ORIGINATOR || "Leihregal").slice(0, 11),
      Recipients: [to],
      MessageText: text,
    }),
  });
  let data: { StatusCode?: string | number; StatusInfo?: string } = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || String(data.StatusCode) !== "1") {
    console.error(`[sms] ASPSMS lehnt ab: HTTP ${res.status}, StatusCode ${data.StatusCode ?? "?"} ${data.StatusInfo ?? ""}`);
    throw new Error(`SMS-Versand fehlgeschlagen: ${data.StatusInfo || res.status}`);
  }
}
