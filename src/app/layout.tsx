import type { Metadata, Viewport } from "next";
import "@fontsource-variable/host-grotesk/wght.css";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/literata/opsz-italic.css";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { RegisterSW } from "@/components/register-sw";
import { ThemeSync } from "@/components/theme-sync";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/i18n/server";
import { htmlLang } from "@/lib/i18n/locale";
import { SHELL } from "@/lib/i18n/messages/shell";

export async function generateMetadata(): Promise<Metadata> {
  const l = await getLocale();
  return { ...metadata, description: SHELL[l].description, openGraph: { ...metadata.openGraph, locale: htmlLang[l].replace("-", "_") } };
}

const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000")),
  title: { default: "Leihregal", template: "%s · Leihregal" },
  description: "Bücher aus Regalen in deiner Nähe leihen, tauschen und verschenken. Kostenlos unter Privatpersonen.",
  applicationName: "Leihregal",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Leihregal", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: { siteName: "Leihregal", locale: "de_CH", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const l = await getLocale();
  return (
    <html lang={htmlLang[l]} suppressHydrationWarning>
      <head>
        {/* Gewähltes Design vor dem ersten Zeichnen setzen, sonst blitzt kurz das andere auf */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('lr-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>
        <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-ink text-paper px-3 py-2 rounded-sm">
          {SHELL[l].skip}
        </a>
        <LocaleProvider locale={l}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
        <RegisterSW />
        <ThemeSync />
      </body>
    </html>
  );
}
