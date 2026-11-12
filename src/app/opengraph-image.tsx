import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Vorschaubild für geteilte Links (WhatsApp, Mail, soziale Netze) */
export const alt = "Leihregal – Bücher aus Regalen in deiner Nähe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const logo = readFileSync(path.join(process.cwd(), "public", "brand", "logo-light.png")).toString("base64");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#faf8f4", padding: 80, color: "#141413" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${logo}`} width={96} height={96} alt="" />
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>Leihregal</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>Bücher aus Regalen</div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, color: "#6f6a60" }}>in deiner Nähe.</div>
          <div style={{ fontSize: 30, color: "#3b3934", marginTop: 12 }}>Leihen, tauschen und verschenken. Kostenlos unter Privatpersonen.</div>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, background: "#d23c1a", borderRadius: 5 }} />
      </div>
    ),
    size,
  );
}
