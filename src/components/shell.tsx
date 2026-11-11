import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { NavLink, Shortcuts, UnreadDot } from "./shell-client";
import { IconBell, IconBookmark, IconCircles, IconHome, IconLoans, IconSearch, IconSettings, IconShelf, IconShield, IconUser } from "./icons";

/**
 * Mobil zuerst: unten liegende Navigation auf dem Handy; Seitenleiste und
 * Tastaturkürzel auf dem Desktop. Die Suche ist überall mit «/» erreichbar (PRD 8.3).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-serif text-[22px] tracking-[-0.02em] leading-none ${className}`} aria-label="Leihregal, Start">
      Leih<span className="italic">regal</span>
    </Link>
  );
}

export function AppShell({ user, unread, children }: { user: SessionUser; unread: number; children: React.ReactNode }) {
  const mod = user.role !== "member";
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <Shortcuts />
      <aside className="hidden md:flex flex-col sticky top-0 h-dvh border-r border-line px-5 py-7">
        <Wordmark className="mb-10 px-2" />
        <nav className="flex flex-col gap-0.5 text-[15px]" aria-label="Hauptnavigation">
          <NavLink href="/" exact icon={<IconHome />}>Start</NavLink>
          <NavLink href="/suche" icon={<IconSearch />} kbd="/">Suche</NavLink>
          <NavLink href="/regal" icon={<IconShelf />}>Mein Regal</NavLink>
          <NavLink href="/vorgaenge" icon={<IconLoans />}>Vorgänge</NavLink>
          <NavLink href="/kreise" icon={<IconCircles />}>Kreise</NavLink>
          <NavLink href="/wunschliste" icon={<IconBookmark />}>Wunschliste</NavLink>
          <NavLink href="/benachrichtigungen" icon={<IconBell />}>
            Benachrichtigungen <UnreadDot initial={unread} />
          </NavLink>
          {mod && <NavLink href="/moderation" icon={<IconShield />}>Moderation</NavLink>}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 text-[15px]">
          <NavLink href={`/profil/${user.id}`} icon={<IconUser />}>{user.first_name || "Profil"}</NavLink>
          <NavLink href="/einstellungen" icon={<IconSettings />}>Einstellungen</NavLink>
          <dl className="text-xs text-muted mt-5 px-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {[["/", "Suche"], ["n", "Buch erfassen"], ["g v", "Vorgänge"], ["g r", "Regal"]].map(([k, l]) => (
              <div key={k} className="contents"><dt><kbd className="font-sans border border-line rounded-xs px-1">{k}</kbd></dt><dd>{l}</dd></div>
            ))}
          </dl>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-paper/95 backdrop-blur-sm border-b border-line h-14 px-4 flex items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-1">
            <Link href="/benachrichtigungen" className="relative p-2" aria-label="Benachrichtigungen">
              <IconBell /> <span className="absolute top-1.5 right-1.5"><UnreadDot initial={unread} compact /></span>
            </Link>
            <Link href="/einstellungen" className="p-2" aria-label="Einstellungen"><IconSettings /></Link>
          </div>
        </header>
        <main id="inhalt" className="flex-1 px-4 md:px-10 lg:px-14 pt-6 md:pt-12 pb-28 md:pb-16 w-full max-w-[1180px]">{children}</main>
      </div>

      <nav aria-label="Hauptnavigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16 text-[11px]">
          <NavLink href="/" exact icon={<IconHome />} tab>Start</NavLink>
          <NavLink href="/suche" icon={<IconSearch />} tab>Suche</NavLink>
          <NavLink href="/regal" icon={<IconShelf />} tab>Regal</NavLink>
          <NavLink href="/vorgaenge" icon={<IconLoans />} tab>Vorgänge</NavLink>
          <NavLink href={`/profil/${user.id}`} icon={<IconUser />} tab>Profil</NavLink>
        </div>
      </nav>
    </div>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-4 md:px-10 h-16 flex items-center justify-between border-b border-line">
        <Wordmark />
        <nav className="flex items-center gap-5 text-[15px]">
          <Link href="/suche" className="hover:underline hidden sm:inline">Suche</Link>
          <Link href="/hilfe" className="hover:underline hidden sm:inline">So funktioniert es</Link>
          <Link href="/anmelden" className="font-medium hover:underline">Anmelden</Link>
        </nav>
      </header>
      <main id="inhalt" className="flex-1 px-4 md:px-10 py-8 md:py-14 w-full max-w-[1180px] mx-auto">{children}</main>
      <footer className="border-t border-line px-4 md:px-10 py-8 text-sm text-muted flex flex-wrap gap-x-6 gap-y-2">
        <span>Leihregal · Bücher aus Regalen in deiner Nähe</span>
        <Link href="/hilfe" className="hover:underline">Hilfe</Link>
        <Link href="/regeln" className="hover:underline">Regeln</Link>
        <Link href="/nutzungsbedingungen" className="hover:underline">Nutzungsbedingungen</Link>
        <Link href="/datenschutz" className="hover:underline">Datenschutz</Link>
      </footer>
    </div>
  );
}
