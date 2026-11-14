import Link from "next/link";
import { Monogram } from "@/components/person/monogram";
import type { SessionUser } from "@/lib/auth/session";
import { ViewTransition } from "react";
import { MobileMore, NavLink, PaletteButton, SearchTrigger, Shortcuts } from "./shell-client";
import { NavRail } from "./motion";
import { LiveBell, LiveNotifications, UnreadBadge } from "./live-notifications";
import { Wordmark, LogoMark } from "./brand";
import { IconBell, IconBookmark, IconCircles, IconHome, IconLoans, IconScan, IconSearch, IconSettings, IconShelf, IconShield } from "./icons";
import { getLocale } from "@/lib/i18n/server";
import { labels } from "@/lib/i18n/labels";
import { SHELL } from "@/lib/i18n/messages/shell";
import { LanguageSwitch } from "./language-switch";

export { Wordmark } from "./brand";

/**
 * App-Hülle. Mobil: unten liegende Navigation mit zentralem Scan-Knopf.
 * Desktop: Seitenleiste mit Suche, Tastaturkürzeln und Profil (PRD 8.3).
 */
export async function AppShell({ user, unread, children }: { user: SessionUser; unread: number; children: React.ReactNode }) {
  const mod = user.role !== "member";
  const l = await getLocale();
  const m = SHELL[l];
  const n = m.nav;
  return (
    <LiveNotifications initial={unread}>
    <div className="min-h-dvh md:grid md:grid-cols-[256px_1fr]">
      <Shortcuts />
      <aside className="hidden md:flex flex-col sticky top-0 h-dvh border-r border-line bg-paper-2/60 px-4 py-6">
        <Wordmark className="px-2 mb-8" label={m.home} />
        <SearchTrigger />
        <Link href="/regal/neu" className="mt-3 mb-7 h-11 rounded-sm bg-accent text-accent-ink font-medium text-body flex items-center justify-center gap-2 hover:bg-accent-hover press">
          <IconScan width={18} height={18} /> {m.addBook}
        </Link>
        <nav aria-label={n.main}>
        <NavRail className="flex flex-col gap-0.5 text-body" marker="rounded-sm bg-paper outline outline-1 outline-line-strong">
          <NavLink href="/" exact icon={<IconHome />}>{n.start}</NavLink>
          <NavLink href="/vorgaenge" icon={<IconLoans />}>{n.loans}</NavLink>
          <NavLink href="/regal" icon={<IconShelf />}>{n.shelf}</NavLink>
          <NavLink href="/kreise" icon={<IconCircles />}>{n.circles}</NavLink>
          <NavLink href="/wunschliste" icon={<IconBookmark />}>{n.wishlist}</NavLink>
          <NavLink href="/benachrichtigungen" icon={<LiveBell />}>
            {n.notifications} <UnreadBadge />
          </NavLink>
          {mod && <NavLink href="/moderation" icon={<IconShield />}>{n.moderation}</NavLink>}
        </NavRail>
        </nav>

        <div className="mt-auto">
          <Link href={`/profil/${user.id}`} className="flex items-center gap-3 rounded-md p-2 hover:bg-paper-3 transition-colors">
            <Monogram name={user.first_name || "?"} seed={user.id} size={40} photo={user.avatar_key} />
            <span className="min-w-0 leading-tight">
              <span className="block font-medium truncate">{user.first_name || n.profile}</span>
              <span className="block text-meta text-muted truncate">{labels(l).trustLabel[user.trust_level]} · {user.municipality}</span>
            </span>
          </Link>
          <div className="flex items-center justify-between px-2 mt-3 text-caption text-muted">
            <Link href="/einstellungen" className="inline-flex items-center gap-1.5 hover:text-ink"><IconSettings width={15} height={15} /> {n.settings}</Link>
            <PaletteButton className="inline-flex items-center gap-1 hover:text-ink"><kbd className="font-sans border border-line-strong rounded-xs px-1.5 leading-5">⌘K</kbd> {m.palette.label}</PaletteButton>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 mt-3">
            <nav aria-label={n.legal} className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
              <Link href="/hilfe" className="hover:text-ink">{n.help}</Link>
              <Link href="/datenschutz" className="hover:text-ink">{n.privacy}</Link>
              <Link href="/impressum" className="hover:text-ink">{n.imprint}</Link>
            </nav>
          </div>
          <LanguageSwitch className="mt-2 ml-1" />
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-line h-14 px-4 flex items-center justify-between">
          <Wordmark label={m.home} />
          <div className="flex items-center">
            <Link href="/suche" className="h-11 w-11 grid place-items-center" aria-label={n.search}><IconSearch /></Link>
            <Link href="/benachrichtigungen" className="relative h-11 w-11 grid place-items-center">
              <IconBell aria-hidden /><span className="sr-only">{n.notifications}</span> <span className="absolute top-2 right-2"><UnreadBadge compact /></span>
            </Link>
            <MobileMore label={n.more} links={[
              { href: "/kreise", label: n.circles },
              { href: "/wunschliste", label: n.wishlist },
              { href: "/regal/kalender", label: n.calendar },
              { href: "/einstellungen", label: n.settings },
              ...(mod ? [{ href: "/moderation", label: n.moderation }] : []),
              { href: "/hilfe", label: n.help },
              { href: "/impressum", label: n.imprint },
            ]} />
          </div>
        </header>
        <main id="inhalt" className="flex-1 px-4 md:px-12 lg:px-16 pt-7 md:pt-14 pb-32 md:pb-20 w-full max-w-[1240px]"><ViewTransition default="page">{children}</ViewTransition></main>
      </div>

      <nav aria-label={n.main} className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
        <NavRail className="grid grid-cols-5 h-[68px] text-caption items-center" marker="rounded-sm bg-paper-3">
          <NavLink href="/" exact icon={<IconHome />} tab>{n.start}</NavLink>
          <NavLink href="/vorgaenge" icon={<IconLoans />} tab>{n.loans}</NavLink>
          <div className="flex justify-center">
            <Link href="/regal/neu" aria-label={m.addBook} className="-mt-7 h-14 w-14 rounded-full bg-accent text-accent-ink grid place-items-center ring-[5px] ring-paper press">
              <IconScan width={24} height={24} />
            </Link>
          </div>
          <NavLink href="/regal" icon={<IconShelf />} tab>{n.shelfShort}</NavLink>
          <NavLink href={`/profil/${user.id}`} icon={<Monogram name={user.first_name || "?"} seed={user.id} size={24} photo={user.avatar_key} />} tab>{n.profile}</NavLink>
        </NavRail>
      </nav>
    </div>
    </LiveNotifications>
  );
}

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const l = await getLocale();
  const m = SHELL[l];
  const f = m.footer;
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="public-header sticky top-0 z-30 bg-paper/85 backdrop-blur-md border-b border-line transition-colors">
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 h-16 flex items-center justify-between">
          <Wordmark label={m.home} />
          <nav className="flex items-center gap-1 md:gap-2 text-body font-medium">
            <Link href="/suche" className="hidden sm:inline-flex px-3 h-10 items-center rounded-sm hover:bg-paper-2">{m.publicNav.find}</Link>
            <Link href="/hilfe" className="hidden lg:inline-flex px-3 h-10 items-center rounded-sm hover:bg-paper-2">{m.publicNav.how}</Link>
            <LanguageSwitch className="hidden sm:inline-flex mx-1" />
            <Link href="/anmelden" className="ml-1 inline-flex px-5 h-10 items-center rounded-sm bg-accent-soft text-accent-hover hover:bg-accent hover:text-accent-ink transition-colors">{m.publicNav.login}</Link>
          </nav>
        </div>
      </header>
      <main id="inhalt" className="flex-1 w-full max-w-[1320px] mx-auto px-4 md:px-10 py-10 md:py-16"><ViewTransition default="page">{children}</ViewTransition></main>
      <footer className="surface-night">
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 py-14 grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 text-night-ink"><LogoMark onDark size={30} /><span className="text-title-sm font-semibold leading-none tracking-display">Leihregal</span></div>
            <p className="text-night-muted mt-4 max-w-xs text-body">{f.claim}</p>
            <LanguageSwitch tone="night" className="mt-6 -ml-1.5" />
          </div>
          <FooterCol title={f.discover} links={[["/suche", f.find], ["/anmelden?next=/regal/neu", f.addBook], ["/anmelden?next=/kreise/neu", f.newCircle]]} />
          <FooterCol title={f.help} links={[["/hilfe", f.how], ["/hilfe#schaden", f.damage], ["/regeln", f.rules]]} />
          <FooterCol title={f.legal} links={[["/nutzungsbedingungen", f.terms], ["/datenschutz", f.privacy], ["/impressum", f.imprint]]} />
        </div>
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 pb-8 text-meta text-night-muted flex flex-wrap gap-x-6 gap-y-1 border-t border-night-line pt-6">
          <span>{f.beta}</span>
          <span>{f.eu}</span>
          {f.legalNote && <span>{f.legalNote}</span>}
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-caption font-medium text-night-muted mb-4">{title}</p>
      <ul className="space-y-2.5 text-body text-night-ink">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="link-grow">{label}</Link></li>)}
      </ul>
    </div>
  );
}
