import type { Locale } from "@/lib/i18n/locale";
/**
 * Typische Antwortzeit als Text, überall gleich: «in weniger als einer Stunde», «innert ca. 5 Std.»,
 * «innert eines Tages», «innert ca. 3 Tagen». Eingabe in Stunden (Median), null = noch keine Daten.
 */
export function responseText(hours: number | null | undefined, l: Locale = "de"): string | null {
  if (hours == null || Number.isNaN(hours)) return null;
  if (l !== "de") {
    const days = Math.round(hours / 24);
    if (l === "fr") {
      if (hours < 1) return "en moins d’une heure";
      if (hours < 24) return `en env. ${Math.round(hours)} h`;
      return days <= 1 ? "en un jour" : `en env. ${days} jours`;
    }
    if (hours < 1) return "in meno di un’ora";
    if (hours < 24) return `in circa ${Math.round(hours)} h`;
    return days <= 1 ? "entro un giorno" : `in circa ${days} giorni`;
  }
  if (hours < 1) return "in weniger als einer Stunde";
  if (hours < 24) return `innert ca. ${Math.round(hours)} Std.`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "innert eines Tages" : `innert ca. ${days} Tagen`;
}
