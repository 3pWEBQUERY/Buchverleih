/** Begriffe der Moderationsoberfläche, in der Sprache der Person (Texte in messages/moderation-labels.ts) */
import type { Locale } from "@/lib/i18n/locale";
import { MOD_LABELS } from "@/lib/i18n/messages/moderation-labels";

export const modLabels = (l: Locale) => MOD_LABELS[l] ?? MOD_LABELS.de;

export function caseStageLabel(stage: number, l: Locale = "de") {
  const m = modLabels(l);
  return m.caseStages[stage] ?? m.stage(stage);
}
