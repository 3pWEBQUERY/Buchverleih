import type { Metadata, Viewport } from "next";
import "@fontsource-variable/host-grotesk/wght.css";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/literata/opsz-italic.css";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { RegisterSW } from "@/components/register-sw";
import { ThemeSync } from "@/components/theme-sync";

export const metadata: Metadata = {
  title: { default: "Leihregal", template: "%s · Leihregal" },
  description: "Bücher aus Regalen in deiner Nähe leihen, tauschen und verschenken. Kostenlos unter Privatpersonen.",
  applicationName: "Leihregal",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Leihregal", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body>
        <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-ink text-paper px-3 py-2 rounded-sm">
          Zum Inhalt
        </a>
        <ToastProvider>{children}</ToastProvider>
        <RegisterSW />
        <ThemeSync />
      </body>
    </html>
  );
}
