import Link from "next/link";
import { sql } from "@/lib/db";
import { Spine } from "@/components/spine";
import { PlzExplorer } from "./plz-explorer";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { CalendarView } from "@/components/calendar";
import { demoCalendar } from "@/lib/loans/calendar-demo";
import { addDays, todayCH } from "@/lib/dates";
import { getLocale } from "@/lib/i18n/server";
import { PUBLIC } from "@/lib/i18n/messages/public";
import type { Locale } from "@/lib/i18n/locale";

type LM = (typeof PUBLIC)["de"]["landing"];

/**
 * Startseite abgemeldet (PRD 8.4): echte Bücher aus der Region statt Werbetext,
 * Postleitzahl eingeben und Bestand sehen. Keine Fantasie-Testimonials, keine Icon-Kacheln.
 */

// Zierband, solange die Region noch wenig Bestand hat (dekorativ, ohne Verfügbarkeitsangabe)
const CLASSICS: [string, string][] = [
  ["Homo faber", "Max Frisch"], ["Der Process", "Franz Kafka"], ["Effi Briest", "Theodor Fontane"], ["Die Physiker", "Friedrich Dürrenmatt"],
  ["Siddhartha", "Hermann Hesse"], ["Momo", "Michael Ende"], ["Der grüne Heinrich", "Gottfried Keller"], ["Heidi", "Johanna Spyri"],
  ["Schachnovelle", "Stefan Zweig"], ["Die Wand", "Marlen Haushofer"], ["Stiller", "Max Frisch"], ["Der Zauberberg", "Thomas Mann"],
  ["Middlemarch", "George Eliot"], ["Le Petit Prince", "Antoine de Saint-Exupéry"], ["Woyzeck", "Georg Büchner"], ["Buddenbrooks", "Thomas Mann"],
  ["Der Steppenwolf", "Hermann Hesse"], ["Wilhelm Tell", "Friedrich Schiller"], ["Frankenstein", "Mary Shelley"], ["Il Gattopardo", "Tomasi di Lampedusa"],
];

export async function Landing() {
  const today = todayCH();
  const loc = await getLocale();
  const m = PUBLIC[loc].landing;
  const [[stats], titles] = await Promise.all([
    sql<{ copies: number; members: number; places: number }[]>`
      select (select count(*)::int from copies c join users u on u.id = c.owner_id where c.removed_at is null and cardinality(c.offers) > 0 and c.visibility = 'all' and u.deleted_at is null) as copies,
             (select count(*)::int from users where onboarded_at is not null and deleted_at is null) as members,
             (select count(distinct municipality)::int from users where onboarded_at is not null and deleted_at is null) as places`,
    sql<{ title: string; author: string | null }[]>`
      select w.title, w.authors[1] as author from works w
       where exists (select 1 from editions e join copies c on c.edition_id = e.id where e.work_id = w.id and c.removed_at is null)
       order by w.created_at desc limit 30`,
  ]);
  const spines = titles.length >= 14 ? titles.map((t) => [t.title, t.author ?? ""] as [string, string]) : CLASSICS;
  const band = [...spines, ...spines];

  return (
    <div className="-mt-10 md:-mt-16">
      {/* ------------------------------------------------------------ Bühne */}
      <section className="landing-stage full-bleed surface-night relative overflow-clip">
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 pt-12 md:pt-16 pb-10 grid lg:grid-cols-[1.25fr_1fr] gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-2 h-8 px-3.5 rounded-[6px] border border-night-line text-[13px] font-medium text-night-muted anim-rise">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> {m.beta}
            </p>
            <h1 className="display mt-6 text-[40px] sm:text-[52px] md:text-[60px] xl:text-[68px] anim-rise" style={{ animationDelay: "60ms" }}>
              {m.hero[0]}<em>{m.hero[1]}</em>
            </h1>
            <p className="mt-7 text-night-muted text-[17px] md:text-[19px] leading-relaxed max-w-xl anim-rise" style={{ animationDelay: "120ms" }}>
              {m.lead}
            </p>
            <dl className="mt-9 flex gap-9 md:gap-12 anim-rise" style={{ animationDelay: "160ms" }}>
              {[[stats.copies, m.stats.books], [stats.members, m.stats.members], ["0", m.stats.fee]].map(([n, l]) => (
                <div key={String(l)}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-[560] tracking-[-0.04em] text-[32px] md:text-[40px] leading-none tnum">{n}</dd>
                  <dd className="text-[13px] text-night-muted mt-1.5">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroPreview m={m.preview} />
        </div>

        {/* Endloses Regal aus Buchrücken */}
        <div className="marquee-wrap relative mt-4" aria-hidden>
          <div className="marquee gap-[6px] items-end px-2" style={{ height: 250 }}>
            {band.map(([t, a], i) => <Spine key={i} title={t} author={a} height={240} />)}
          </div>
          <div className="h-[6px] bg-night-ink/90" />
        </div>

        <div className="max-w-[1320px] mx-auto px-4 md:px-10 py-12 md:py-16">
          <PlzExplorer />
        </div>
      </section>

      {/* ------------------------------------------------------- Ablauf */}
      <section className="pt-20 md:pt-32">
        <div className="grid md:grid-cols-12 gap-8 items-end mb-10 md:mb-14">
          <div className="md:col-span-7">
            <p className="eyebrow">{m.flowEyebrow}</p>
            <h2 className="display text-[32px] md:text-[44px] mt-2">{m.flowTitle[0]}<em>{m.flowTitle[1]}</em>{m.flowTitle[2]}</h2>
          </div>
          <p className="md:col-span-5 text-ink-2 text-[17px] leading-relaxed">
            {m.flowLead}
          </p>
        </div>
        <ol className="grid grid-flow-col auto-cols-[82%] sm:auto-cols-[48%] lg:grid-flow-row lg:grid-cols-4 gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0 pb-2" style={{ scrollbarWidth: "none" }}>
          <Step n="01" title={m.steps[0][0]} text={m.steps[0][1]}>
            <MiniCalendar today={today} loc={loc} />
          </Step>
          <Step n="02" title={m.steps[1][0]} text={m.steps[1][1]}>
            <MiniQr hint={m.orDigits} />
          </Step>
          <Step n="03" title={m.steps[2][0]} text={m.steps[2][1]}>
            <div className="space-y-2">
              <span className="chip !bg-paper"><span className="h-1.5 w-1.5 rounded-full bg-lent" /> {m.lentChip}</span>
              <p className="font-serif text-[28px] leading-none">{m.sampleDue}</p>
              <p className="text-[13px] text-muted">{m.sampleLeft}</p>
            </div>
          </Step>
          <Step n="04" title={m.steps[3][0]} text={m.steps[3][1]}>
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-accent-soft text-accent-hover grid place-items-center anim-pop"><IconCheck width={22} height={22} /></span>
              <div className="leading-tight"><p className="font-semibold">{m.back}</p><p className="text-[13px] text-muted">{m.bothConfirmed}</p></div>
            </div>
          </Step>
        </ol>
      </section>

      {/* -------------------------------------------------- Vertrauen (Bento) */}
      <section className="pt-20 md:pt-32">
        <p className="eyebrow">{m.trustEyebrow}</p>
        <h2 className="display text-[32px] md:text-[44px] mt-2 max-w-[20ch]">{m.trustTitle[0]}<em>{m.trustTitle[1]}</em></h2>
        <div className="mt-10 md:mt-14 grid gap-4 md:grid-cols-6 md:auto-rows-[minmax(250px,auto)]">
          <article className="surface-night rounded-[10px] p-7 md:p-9 md:col-span-4 flex flex-col">
            <p className="eyebrow !text-night-muted">{m.calEyebrow}</p>
            <h3 className="text-[26px] md:text-[32px] font-[560] tracking-[-0.03em] mt-2 max-w-md">{m.calTitle}</h3>
            <p className="text-night-muted mt-3 max-w-md">{m.calText}</p>
            <div className="mt-auto pt-8">
              {/* Derselbe Verleihkalender wie in der App, mit Beispieldaten */}
              <div className="rounded-[10px] bg-paper text-ink p-4 md:p-5" aria-label={m.calAria}>
                <CalendarView cal={demoCalendar(today, loc)} fit />
              </div>
            </div>
          </article>
          <article className="rounded-[10px] p-7 md:p-9 md:col-span-2 bg-accent text-accent-ink flex flex-col justify-between">
            <p className="eyebrow !text-accent-ink/75">{m.moneyEyebrow}</p>
            <div>
              <p className="font-[560] tracking-[-0.04em] text-[64px] md:text-[80px] leading-[0.9] tnum">0.–</p>
              <p className="mt-3 text-[17px] font-medium">{m.moneyText}</p>
            </div>
          </article>
          <article className="panel-quiet rounded-[10px] p-7 md:p-9 md:col-span-3">
            <p className="eyebrow">{m.levelsEyebrow}</p>
            <h3 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] leading-tight mt-2">{m.levelsTitle}</h3>
            <div className="mt-7 space-y-3">
              {m.levels.map(([l, d], i) => [l, [2, 5, 10][i], d] as const).map(([l, n, d], i) => (
                <div key={String(l)} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                  <span className="font-semibold">{l}</span>
                  <span className="h-3 rounded-full bg-paper-3 overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${(Number(n) / 10) * 100}%`, opacity: 0.55 + i * 0.22 }} /></span>
                  <span className="text-[13px] text-muted tnum w-36 text-right hidden sm:block">{n} {m.atOnce} · {d}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted mt-5">{m.levelsNote}</p>
          </article>
          <article className="panel rounded-[10px] p-7 md:p-9 md:col-span-3 flex flex-col">
            <p className="eyebrow">{m.circlesEyebrow}</p>
            <h3 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] leading-tight mt-2">{m.circlesTitle}</h3>
            <p className="text-ink-2 mt-3 max-w-md">{m.circlesText}</p>
            <div className="mt-auto pt-7 flex items-center justify-between">
              <div className="flex -space-x-3">
                {["L", "M", "J", "A", "S"].map((c, i) => (
                  <span key={c} className="h-11 w-11 rounded-full ring-[3px] ring-paper grid place-items-center font-semibold text-lg" style={{ background: ["#22324a", "#d23c1a", "#2e4a3b", "#b8902f", "#4b2e44"][i], color: "#fff" }}>{c}</span>
                ))}
              </div>
              <Link href="/anmelden?next=/kreise/neu" className="inline-flex items-center gap-2 font-semibold link-grow">{m.newCircle} <IconArrowRight width={18} height={18} /></Link>
            </div>
          </article>
          <article className="panel rounded-[10px] p-7 md:p-9 md:col-span-6 grid md:grid-cols-[1fr_1.4fr] gap-8 items-center">
            <div>
              <p className="eyebrow">{m.escEyebrow}</p>
              <h3 className="text-[24px] md:text-[28px] font-[560] tracking-[-0.03em] leading-tight mt-2">{m.escTitle}</h3>
              <p className="text-ink-2 mt-3">{m.escText}</p>
            </div>
            <ol className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line rounded-[12px] overflow-hidden">
              {m.esc.map(([d, t], i) => (
                <li key={d} className="bg-paper p-4">
                  <span className={`block font-[520] tracking-[-0.035em] text-[26px] leading-none tnum ${i === 3 ? "text-late" : ""}`}>{d}</span>
                  <span className="block text-[13px] text-ink-2 mt-2 leading-snug">{t}</span>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------- Abschluss */}
      <section className="full-bleed bg-accent text-accent-ink mt-20 md:mt-32 -mb-10 md:-mb-16">
        <div className="max-w-[1320px] mx-auto px-4 md:px-10 py-16 md:py-24 grid md:grid-cols-[1fr_auto] gap-8 items-end">
          <h2 className="display text-[36px] md:text-[52px] max-w-[16ch]">{m.ctaTitle[0]}<em>{m.ctaTitle[1]}</em></h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/anmelden?next=/regal/neu" className="h-14 px-8 rounded-[6px] bg-night-ink text-accent-hover font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              {m.ctaStart} <IconArrowRight width={18} height={18} />
            </Link>
            <Link href="/hilfe" className="h-14 px-8 rounded-[6px] border-2 border-accent-ink/40 font-semibold inline-flex items-center justify-center hover:border-accent-ink transition-colors">
              {m.ctaHow}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Produktvorschau aus echten UI-Bausteinen – flach, leicht versetzt */
function HeroPreview({ m }: { m: LM["preview"] }) {
  return (
    <div className="relative hidden lg:block h-[480px]" aria-hidden>
      <div className="absolute right-0 top-0 w-[350px] rounded-[10px] bg-paper text-ink p-6 anim-cover" style={{ animationDelay: "200ms" }}>
        <div className="flex gap-4">
          <div className="w-[74px] h-[108px] rounded-[3px] flex-none p-2.5 flex flex-col" style={{ background: "#2e4a3b", color: "#eee4cc" }}>
            <span className="block h-px w-6 bg-current opacity-70" />
            <span className="font-serif text-[15px] leading-tight mt-auto">Homo faber</span>
            <span className="text-[6.5px] uppercase tracking-[0.14em] mt-1.5 opacity-80">Max Frisch</span>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">{m.loanFrom}</p>
            <p className="font-serif text-[28px] leading-[1.05] mt-1.5">Homo faber</p>
            <span className="chip mt-3"><span className="h-1.5 w-1.5 rounded-full bg-wait" /> {m.accepted}</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-1.5">
          {m.steps.map((l, i) => (
            <div key={l}><span className={`block h-1.5 rounded-full ${i < 2 ? "bg-ink-2" : i === 2 ? "bg-accent" : "bg-paper-3"}`} /><span className="block text-[10px] text-muted mt-1.5 truncate">{l}</span></div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-[12px] bg-paper-2 px-4 py-3">
          <div className="leading-tight"><p className="text-[12px] text-muted">{m.handover}</p><p className="font-semibold text-[14.5px]">{m.when}</p></div>
          <span className="h-9 px-4 rounded-[6px] bg-accent text-accent-ink text-[13px] font-semibold grid place-items-center whitespace-nowrap">{m.scan}</span>
        </div>
      </div>
      <div className="absolute left-0 bottom-0 w-[196px] rounded-[10px] bg-white text-black p-4 anim-cover" style={{ animationDelay: "320ms" }}>
        <p className="font-serif text-[17px]">{m.code}</p>
        <div className="mt-3 grid grid-cols-9 gap-[2px]">
          {"111011101011010010111101001110110100101110010110101111001011101110110100101111010011101".split("").map((c, i) => <span key={i} className={`aspect-square ${c === "1" ? "bg-black" : ""}`} />)}
        </div>
        <p className="mt-3 text-center font-sans font-semibold text-[20px] tracking-[0.16em] tnum">420 350</p>
        <p className="text-center text-[11px] text-neutral-500">{m.valid}</p>
      </div>
    </div>
  );
}

function Step({ n, title, text, children }: { n: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="snap-start panel-quiet rounded-[10px] p-6 md:p-7 flex flex-col min-h-[340px] group hover:bg-paper-3 transition-colors duration-300">
      <span className="font-[520] tracking-[-0.035em] text-[22px] text-muted tnum">{n}</span>
      <h3 className="ui-title text-[24px] mt-1">{title}</h3>
      <p className="text-ink-2 text-[15px] mt-2 leading-relaxed">{text}</p>
      <div className="mt-auto pt-8 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1">{children}</div>
    </li>
  );
}

/** Vorschau im Schritt «Anfragen»: derselbe Kalender wie in der App, mit gewähltem Zeitraum */
function MiniCalendar({ today, loc }: { today: string; loc: Locale }) {
  return (
    <div aria-hidden className="rounded-[8px] bg-paper p-3 -mx-1">
      <CalendarView cal={demoCalendar(today, loc)} compact fit showLegend={false} selection={{ start: addDays(today, 66), end: addDays(today, 80), ok: true }} />
    </div>
  );
}

function MiniQr({ hint }: { hint: string }) {
  const cells = "1110111010110100101111010011101101001011100101101011110010111011";
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <div className="grid grid-cols-8 gap-[2px] p-2 bg-white rounded-[6px] w-[86px]">
        {cells.split("").map((c, i) => <span key={i} className={`aspect-square ${c === "1" ? "bg-black" : ""}`} />)}
      </div>
      <div><p className="font-sans font-semibold text-[22px] tracking-[0.15em] tnum">420 350</p><p className="text-[12px] text-muted">{hint}</p></div>
    </div>
  );
}

