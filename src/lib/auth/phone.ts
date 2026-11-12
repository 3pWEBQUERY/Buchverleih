/** Mobilnummern in E.164. Schweizer Nummern dürfen national eingegeben werden. */
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s\-().\/]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (/^0[1-9]\d{8}$/.test(s)) s = "+41" + s.slice(1);
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  // Schweizer Mobilnummern beginnen mit 07x
  if (s.startsWith("+41") && !/^\+417[5-9]\d{7}$/.test(s)) return null;
  return s;
}

/**
 * SMS nur an Mobilnummern aus der Schweiz und Liechtenstein: schützt vor teuren
 * Auslands- und Mehrwertnummern (SMS-Pumping).
 */
export function smsAllowed(e164: string) {
  return /^\+417[5-9]\d{7}$/.test(e164) || /^\+423[67]\d{6}$/.test(e164);
}

export function maskPhone(e164: string) {
  return e164.slice(0, 5) + " ••• •• " + e164.slice(-2);
}
