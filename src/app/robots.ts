import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Öffentliche Seiten dürfen in Suchmaschinen, persönliche Bereiche nicht */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/vorgaenge", "/regal", "/einstellungen", "/benachrichtigungen", "/moderation", "/profil/", "/exemplar/", "/k/", "/h/", "/uebergabe/", "/willkommen", "/anmelden"],
    },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
