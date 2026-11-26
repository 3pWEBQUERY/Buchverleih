import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const req = (url: string, host: string) => new NextRequest(url, { headers: { host } });
const before = process.env.APP_URL;
afterEach(() => { process.env.APP_URL = before; });

describe("Weiterleitung auf die Hauptadresse", () => {
  it("leitet die Railway-Adresse und www. dauerhaft weiter, Pfad und Suche bleiben", () => {
    process.env.APP_URL = "https://leihregal.ch";
    const r = proxy(req("https://web-production-460789f1.up.railway.app/suche?q=momo", "web-production-460789f1.up.railway.app"));
    expect(r.status).toBe(308);
    expect(r.headers.get("location")).toBe("https://leihregal.ch/suche?q=momo");
    const w = proxy(req("https://www.leihregal.ch/k/abc", "www.leihregal.ch"));
    expect(w.headers.get("location")).toBe("https://leihregal.ch/k/abc");
  });

  it("lässt API, .well-known, die Hauptadresse und fremde Hosts in Ruhe", () => {
    process.env.APP_URL = "https://leihregal.ch";
    const pass = (u: string, h: string) => expect(proxy(req(u, h)).headers.get("location")).toBeNull();
    pass("https://web-production-460789f1.up.railway.app/api/v1/health", "web-production-460789f1.up.railway.app");
    pass("https://web-production-460789f1.up.railway.app/.well-known/apple-app-site-association", "web-production-460789f1.up.railway.app");
    pass("https://leihregal.ch/suche", "leihregal.ch");
    pass("http://localhost:3000/suche", "localhost:3000");
  });

  it("leitet nicht weiter, solange APP_URL noch die Railway-Adresse ist", () => {
    process.env.APP_URL = "https://web-production-460789f1.up.railway.app";
    expect(proxy(req("https://web-production-460789f1.up.railway.app/", "web-production-460789f1.up.railway.app")).headers.get("location")).toBeNull();
  });
});
