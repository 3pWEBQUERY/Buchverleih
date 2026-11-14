import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms, smsConfigured } from "@/lib/notify/sms";

/** ASPSMS-Anbindung: richtige Anfrage, Fehler am StatusCode erkennen, ohne Zugangsdaten nichts senden. */
describe("SMS über ASPSMS", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.SMS_PROVIDER = "aspsms";
    process.env.ASPSMS_USERKEY = "KEY";
    process.env.ASPSMS_PASSWORD = "geheim";
    delete process.env.ASPSMS_ORIGINATOR;
  });
  afterEach(() => { process.env = { ...saved }; vi.restoreAllMocks(); });

  it("sendet Empfänger, Text und Absender an die JSON-Schnittstelle", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ StatusCode: "1", StatusInfo: "OK" }), { status: 200 }));
    await sendSms("+41791234567", "Dein Leihregal-Code: 123456. Gültig 10 Minuten.");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://json.aspsms.com/SendSimpleTextSMS");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      UserName: "KEY", Password: "geheim", Originator: "Leihregal", Recipients: ["+41791234567"], MessageText: "Dein Leihregal-Code: 123456. Gültig 10 Minuten.",
    });
  });

  it("kürzt den Absender auf 11 Zeichen", async () => {
    process.env.ASPSMS_ORIGINATOR = "LeihregalSchweiz";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ StatusCode: "1" }), { status: 200 }));
    await sendSms("+41791234567", "x");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)).Originator).toBe("LeihregalSc");
  });

  it("wirft bei abgelehntem Versand (HTTP 200, StatusCode ungleich 1) und schreibt weder Passwort noch Text ins Log", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ StatusCode: "3", StatusInfo: "Authorization failed." }), { status: 200 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendSms("+41791234567", "Code 654321")).rejects.toThrow(/Authorization failed/);
    const printed = log.mock.calls.flat().join(" ");
    expect(printed).not.toContain("geheim");
    expect(printed).not.toContain("654321");
  });

  it("gilt ohne Zugangsdaten nicht als eingerichtet und sendet nichts", async () => {
    delete process.env.ASPSMS_PASSWORD;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(smsConfigured()).toBe(false);
    await sendSms("+41791234567", "x");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
