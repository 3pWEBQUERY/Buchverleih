import type { Locale } from "@/lib/i18n/locale";
import { htmlLang } from "@/lib/i18n/locale";

/**
 * Leihen pro Monat als schlichte Säulen: eine Reihe, eine Farbe, keine Legende (der Titel benennt sie).
 * Werte erscheinen beim Darüberfahren oder Fokussieren; die Tabelle darunter ist die Textfassung.
 */
export function MonthBars({ data, label, l, unit }: { data: { month: string; n: number }[]; label: string; l: Locale; unit: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const fmt = new Intl.DateTimeFormat(htmlLang[l], { month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(htmlLang[l], { month: "long", year: "numeric", timeZone: "UTC" });
  const date = (m: string) => new Date(`${m}-01T00:00:00Z`);
  return (
    <figure>
      <div className="relative h-40 flex items-end gap-[2px] border-b border-line-strong" role="img" aria-label={label}>
        {/* Recessive Hilfslinie auf halber Höhe */}
        <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        {data.map((d) => (
          <div key={d.month} tabIndex={0} aria-label={`${long.format(date(d.month))}: ${unit(d.n)}`}
            className="group relative flex-1 h-full flex items-end justify-center outline-none">
            <span className="absolute -top-1 -translate-y-full text-caption tnum text-ink bg-paper border border-line rounded-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {long.format(date(d.month))}: {unit(d.n)}
            </span>
            <span className="w-full max-w-9 rounded-t-xs bg-accent group-hover:bg-accent-hover transition-colors"
              style={{ height: d.n ? `${Math.max(3, (d.n / max) * 100)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-[2px] mt-1.5">
        {data.map((d, i) => (
          <span key={d.month} className="flex-1 text-center text-caption text-muted tnum">{i % 2 === 0 || data.length <= 6 ? fmt.format(date(d.month)) : ""}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{data.map((d) => <tr key={d.month}><th scope="row">{long.format(date(d.month))}</th><td>{d.n}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
