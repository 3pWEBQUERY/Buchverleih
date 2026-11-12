/**
 * Typische Antwortzeit als Text, überall gleich: «in weniger als einer Stunde», «innert ca. 5 Std.»,
 * «innert eines Tages», «innert ca. 3 Tagen». Eingabe in Stunden (Median), null = noch keine Daten.
 */
export function responseText(hours: number | null | undefined): string | null {
  if (hours == null || Number.isNaN(hours)) return null;
  if (hours < 1) return "in weniger als einer Stunde";
  if (hours < 24) return `innert ca. ${Math.round(hours)} Std.`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "innert eines Tages" : `innert ca. ${days} Tagen`;
}
