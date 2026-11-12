/**
 * Texte, die das System selbst in Benachrichtigungen schreibt (nicht Freitexte von Menschen).
 * Sie werden als Schlüssel plus Werte gespeichert (NotifyData.textKey/textArgs) und erst beim
 * Anzeigen in der Sprache der Person zusammengesetzt. d.text bleibt als deutscher Rückfall erhalten.
 */
import type { Locale } from "@/lib/i18n/locale";
import { fmtDistance } from "@/lib/geo";

type Args = Record<string, string | number>;
type Fn = (a: Args) => string;

/** Entfernung genau wie überall sonst (fmtDistance): «ca. 900 m» / «env. 900 m» / «circa 900 m», «1,4 km», «12 km» */
function dist(m: unknown, l: Locale) {
  const n = Number(m);
  return Number.isFinite(n) ? fmtDistance(n, l) ?? "" : "";
}

const de: Record<string, Fn> = {
  circle_auto_accepted: () => "Im Kreis automatisch angenommen. Sprecht Ort und Zeit im Vorgang ab.",
  pass_on_owner: (a) => `Direkt von ${a.from} an ${a.to} weitergeben?`,
  pass_on_prev: (a) => `Gibst du das Buch direkt an ${a.name} weiter? Das spart euch zwei Treffen.`,
  pass_on_next: () => "Holst du das Buch direkt bei der Person ab, die es gerade hat?",
  case_return_date: () => "Ein Rückgabetermin ist genannt.",
  case_object: () => "Widerspruch eingelegt, die Moderation entscheidet.",
  case_replace: () => "Ein Ersatz ist angeboten.",
  case_replaced: () => "Der Ersatz ist bestätigt.",
  case_rejected: () => "Die Moderation hat entschieden: kein Schaden.",
  case_returned: () => "Das Buch ist zurück.",
  circle_name: (a) => `Kreis «${a.name}»`,
  title_alarm_free: (a) => `Ein Exemplar ist ${dist(a.meters, "de")} entfernt frei.`,
  chat_proposal: () => "Terminvorschlag",
};

const fr: typeof de = {
  circle_auto_accepted: () => "Accepté automatiquement dans le cercle. Convenez du lieu et de l’heure dans la transaction.",
  pass_on_owner: (a) => `Transmettre directement de ${a.from} à ${a.to} ?`,
  pass_on_prev: (a) => `Transmets-tu le livre directement à ${a.name} ? Cela vous évite deux rencontres.`,
  pass_on_next: () => "Récupères-tu le livre directement chez la personne qui l’a en ce moment ?",
  case_return_date: () => "Une date de retour a été indiquée.",
  case_object: () => "Contestation déposée, la modération décide.",
  case_replace: () => "Un remplacement est proposé.",
  case_replaced: () => "Le remplacement est confirmé.",
  case_rejected: () => "La modération a décidé : pas de dommage.",
  case_returned: () => "Le livre est rendu.",
  circle_name: (a) => `Cercle « ${a.name} »`,
  title_alarm_free: (a) => `Un exemplaire est libre à ${dist(a.meters, "fr")}.`,
  chat_proposal: () => "Proposition de rendez-vous",
};

const it: typeof de = {
  circle_auto_accepted: () => "Accettato automaticamente nella cerchia. Concordate luogo e ora nella pratica.",
  pass_on_owner: (a) => `Passare direttamente da ${a.from} a ${a.to}?`,
  pass_on_prev: (a) => `Passi il libro direttamente a ${a.name}? Così vi risparmiate due incontri.`,
  pass_on_next: () => "Ritiri il libro direttamente dalla persona che lo ha ora?",
  case_return_date: () => "È stata indicata una data di restituzione.",
  case_object: () => "Contestazione presentata, decide la moderazione.",
  case_replace: () => "È stata offerta una sostituzione.",
  case_replaced: () => "La sostituzione è confermata.",
  case_rejected: () => "La moderazione ha deciso: nessun danno.",
  case_returned: () => "Il libro è stato restituito.",
  circle_name: (a) => `Cerchia «${a.name}»`,
  title_alarm_free: (a) => `Un esemplare è libero a ${dist(a.meters, "it")}.`,
  chat_proposal: () => "Proposta di appuntamento",
};

const ALL: Record<Locale, typeof de> = { de, fr, it };
export type SystemTextKey = keyof typeof de;

/** Deutscher Text für d.text (Rückfall) und Schlüssel samt Werten für die Übersetzung */
export function systemText(key: SystemTextKey, args: Args = {}) {
  return { text: de[key](args), textKey: key, textArgs: args };
}

/** Text in der Sprache der Person; unbekannte Schlüssel ergeben undefined */
export function renderSystemText(key: string, args: Args | undefined, l: Locale): string | undefined {
  const fn = (ALL[l] ?? de)[key] ?? de[key];
  return fn ? fn(args ?? {}) : undefined;
}

/** «ca. 700 m» / «1,4 km» / «12 km» zurück in Meter (für alte Benachrichtigungen ohne Schlüssel) */
function metersOf(s: string): number | null {
  const m = /^(?:ca\. )?(\d+(?:,\d+)?) (m|km)$/.exec(s.trim());
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return m[2] === "km" ? Math.round(n * 1000) : n;
}

/** Ältere Benachrichtigungen (vor textKey) tragen nur den deutschen Systemtext: bekannte Texte übersetzen */
const LEGACY: [RegExp, SystemTextKey, (m: RegExpExecArray) => Args | null][] = [
  [/^Ein Exemplar ist (.+) entfernt frei\.$/, "title_alarm_free", (m) => { const n = metersOf(m[1]); return n == null ? null : { meters: n }; }],
  [/^Direkt von (.+) an (.+) weitergeben\?$/, "pass_on_owner", (m) => ({ from: m[1], to: m[2] })],
  [/^Gibst du das Buch direkt an (.+) weiter\? Das spart euch zwei Treffen\.$/, "pass_on_prev", (m) => ({ name: m[1] })],
  [/^Kreis «(.+)»$/, "circle_name", (m) => ({ name: m[1] })],
];

export function legacySystemText(text: string, l: Locale): string | undefined {
  if (l === "de") return undefined;
  for (const [key, fn] of Object.entries(de)) {
    if (fn.length === 0 && fn({}) === text) return renderSystemText(key, {}, l);
  }
  for (const [re, key, args] of LEGACY) {
    const m = re.exec(text);
    const a = m && args(m);
    if (a) return renderSystemText(key, a, l);
  }
  return undefined;
}
