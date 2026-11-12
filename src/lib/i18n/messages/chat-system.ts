/**
 * Systemnachrichten im Chat (sender_id null) werden auf Deutsch gespeichert.
 * Für FR/IT werden die bekannten Texte beim Anzeigen übersetzt; Unbekanntes bleibt, wie es ist.
 */
import type { Locale } from "../locale";

const EXACT: Record<string, { fr: string; it: string }> = {
  "Zwei Leihen folgen aufeinander. Hier sprecht ihr den Wechsel ab: direkt oder über die verleihende Person.": {
    fr: "Deux prêts se suivent. Convenez ici du passage de relais : directement ou par la personne qui prête.",
    it: "Due prestiti si susseguono. Qui concordate il passaggio: direttamente o tramite chi presta.",
  },
};

const CASE_PREFIX = "Antwort im Fall: ";
const CASE: Record<string, { fr: string; it: string }> = {
  "Rückgabe geplant": { fr: "Retour prévu", it: "Restituzione pianificata" },
  "Widerspruch, die Moderation entscheidet": { fr: "Contestation, la modération décide", it: "Contestazione, decide la moderazione" },
  "Ersatz angeboten": { fr: "Remplacement proposé", it: "Sostituzione offerta" },
};
const CASE_LEAD = { fr: "Réponse dans le litige : ", it: "Risposta nel caso: " };

export function systemChatText(body: string | null, l: Locale): string | null {
  if (!body || l === "de") return body;
  const exact = EXACT[body];
  if (exact) return exact[l];
  if (body.startsWith(CASE_PREFIX)) {
    const rest = body.slice(CASE_PREFIX.length);
    for (const [de, tr] of Object.entries(CASE)) {
      // Danach folgt evtl. « – Freitext» der Person, der bleibt unverändert
      if (rest === de || rest.startsWith(`${de} – `)) return CASE_LEAD[l] + tr[l] + rest.slice(de.length);
    }
  }
  return body;
}
