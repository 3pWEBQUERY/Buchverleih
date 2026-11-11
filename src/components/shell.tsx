import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { NavLink, SearchTrigger, Shortcuts, UnreadDot } from "./shell-client";
import { Wordmark, LogoMark } from "./brand";
import { IconBell, IconBookmark, IconCircles, IconHome, IconLoans, IconScan, IconSearch, IconSettings, IconShelf, IconShield } from "./icons";
import { trustLabel } from "@/lib/i18n/de-CH";

export { Wordmark } from "./brand";

/**
 * App-Hülle. Mobil: unten liegende Navigation mit zentralem Scan-Knopf.
 * Desktop: Seitenleiste mit Suche, Tastaturkürzeln und Profil (PRD 8.3).
 */
export function AppShell({ user, unread, children }: { user: SessionUser; unread: number; children: React.ReactNode }) {
  const mod = user.role !== "member";
  const initial = (user.first_name || "?").slice(0, 1).toUpperCase();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_1fr]">
      <Shortcuts />
      <aside className="hidden md:flex flex-col sticky top-0 h-dvh border-r border-line bg-paper-2/60 px-4 py-6">
        <Wordmark className="px-2 mb-8" />
        <SearchTrigger />
        <Link href="/regal/neu" className="mt-3 mb-7 h-11 rounded-[6px] bg-accent text-accent-ink font-medium text-[15px] flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors">
          <IconScan width={18} height={18} /> Buch erfassen
        </Link>
        <nav className="flex flex-col gap-0.5 text-[15px]" aria-label="Hauptnavigation">
          <NavLink href="/" exact icon={<IconHome />}>Start</NavLink>
          <NavLink href="/vorgaenge" icon={<IconLoans />}>Vorgänge</NavLink>
          <NavLink href="/regal" icon={<IconShelf />}>Mein Regal</NavLink>
          <NavLink href="/kreise" icon={<IconCircles />}>Kreise</NavLink>
          <NavLink href="/wunschliste" icon={<IconBookmark />}>Wunschliste</NavLink>
          <NavLink href="/benachrichtigungen" icon={<IconBell />}>
            Benachrichtigungen <UnreadDot initial={unread} />
          </NavLink>
          {mod && <NavLink href="/moderation" icon={<IconShield />}>Moderation</NavLink>}
        </nav>

        <div className="mt-auto">
          <Link href={`/profil/${user.id}`} className="flex items-center gap-3 rounded-[8px] p-2 hover:bg-paper-3 transition-colors">
            <span className="h-10 w-10 rounded-full bg-ink text-paper grid place-items-center text-[17px] font-semibold">{initial}</span>
            <span className="min-w-0 leading-tight">
              <span className="block font-semibold truncate">{user.first_name || "Profil"}</span>
              <span className="block text-[13px] text-muted truncate">{trustLabel[user.trust_level]} · {user.municipality}</span>
            </span>
          </Link>
          <div className="flex items-center justify-between px-2 mt-3 text-[12px] text-muted">
            <Link href="/einstellungen" className="inline-flex items-center gap-1.5 hover:text-ink"><IconSettings width={15} height={15} /> Einstellungen</Link>
            <span className="inline-flex items-center gap-1"><kbd className="font-sans border border-line-strong rounded-[4px] px-1.5 leading-5">/</kbd> Suche</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-line h-14 px-4 flex items-center justify-between">
          <Wordmark />
          <div className="flex items-center">
            <Link href="/suche" className="p-2.5" aria-label="Suche"><IconSearch /></Link>
            <Link href="/benachrichtigungen" className="relative p-2.5" aria-label="Benachrichtigungen">
              <IconBell /> <span className="absolute top-2 right-2"><UnreadDot initial={unread} compact /></span>
            </Link>
          </div>
        </header>
        <main id="inhalt" className="flex-1 px-4 md:px-12 lg:px-16 pt-7 md:pt-14 pb-32 md:pb-20 w-full max-w-[1240px]">{children}</main>
      </div>

      <nav aria-label="Hauptnavigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-[68px] text-[11px] items-center">
          <NavLink href="/" exact icon={<IconHome />} tab>Start</NavLink>
          <NavLink href="/vorgaenge" icon={<IconLoans />} tab>Vorgänge</NavLink>
          <div className="flex justify-center">
            <Link href="/regal/neu" aria-label="Buch erfassen" className="-mt-7 h-14 w-14 rounded-full bg-accent text-accent-ink grid place-items-center ring-[5px] ring-paper active:scale-95 transition-transform">
              <IconScan width={24} height={24} />
            </Link>
          </div>
          <NavLink href="/regal" icon={<IconShelf />} tab>Regal</NavLink>
          <NavLink href={`/profil/${user.id}`} icon={<span className="h-6 w-6 rounded-full bg-ink text-paper grid place-items-center text-[11px] font-semibold">{initial}</span>} tab>Profil</NavLink>
        </div>
      </nav>
    </div>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="public-header sticky top-0 z-30 bg-paper/85 backdrop-blur-md border-b border-line transition-colors">
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 h-16 flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-1 md:gap-2 text-[15px] font-medium">
            <Link href="/suche" className="hidden sm:inline-flex px-3 h-10 items-center rounded-[6px] hover:bg-paper-2">Bücher finden</Link>
            <Link href="/hilfe" className="hidden sm:inline-flex px-3 h-10 items-center rounded-[6px] hover:bg-paper-2">So funktioniert es</Link>
            <Link href="/anmelden" className="ml-1 inline-flex px-5 h-10 items-center rounded-[6px] bg-ink text-paper hover:bg-ink-2 transition-colors">Anmelden</Link>
          </nav>
        </div>
      </header>
      <main id="inhalt" className="flex-1 w-full max-w-[1320px] mx-auto px-4 md:px-10 py-10 md:py-16">{children}</main>
      <footer className="surface-night">
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 py-14 grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 text-night-ink"><LogoMark /><span className="text-[21px] font-[620] leading-none tracking-[-0.04em]">Leihregal</span></div>
            <p className="text-night-muted mt-4 max-w-xs text-[15px]">Bücher aus Regalen in deiner Nähe. Kostenlos unter Privatpersonen, mit festen Fristen und einer Bestätigung bei jeder Übergabe.</p>
          </div>
          <FooterCol title="Entdecken" links={[["/suche", "Bücher finden"], ["/anmelden?next=/regal/neu", "Buch einstellen"], ["/anmelden?next=/kreise/neu", "Kreis gründen"]]} />
          <FooterCol title="Hilfe" links={[["/hilfe", "So funktioniert es"], ["/hilfe#schaden", "Schaden und Verlust"], ["/regeln", "Regeln"]]} />
          <FooterCol title="Rechtliches" links={[["/nutzungsbedingungen", "Nutzungsbedingungen"], ["/datenschutz", "Datenschutz"]]} />
        </div>
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 pb-8 text-[13px] text-night-muted flex flex-wrap gap-x-6 gap-y-1 border-t border-night-line pt-6">
          <span>Leihregal · Beta Zürich und Zürcher Unterland</span>
          <span>Daten in der EU gespeichert</span>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-night-muted mb-4">{title}</p>
      <ul className="space-y-2.5 text-[15px] text-night-ink">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="link-grow">{label}</Link></li>)}
      </ul>
    </div>
  );
}
