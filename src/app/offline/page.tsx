import { StandaloneShell } from "@/components/auth/standalone";
import { OfflineMotif, OfflineText } from "./offline-text";

export const dynamic = "force-static";
export const metadata = { title: "Offline", robots: { index: false } };

/** Offline-Hülle der PWA. Der Service Worker liefert sie, wenn eine Seite ohne Netz nicht lädt. */
export default function Page() {
  return (
    <StandaloneShell motif={{ label: <OfflineMotif /> }}>
      <OfflineText />
    </StandaloneShell>
  );
}
