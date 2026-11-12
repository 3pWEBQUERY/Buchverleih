/**
 * Texte der Benachrichtigungen in drei Sprachen. Gleiche Struktur pro Sprache:
 * jeder Typ liefert [Titel, Text]. Freitexte (d.text) stammen von Menschen und bleiben unübersetzt.
 */
import type { Locale } from "@/lib/i18n/locale";
import type { NotificationType, NotifyData } from "./index";

export type Ctx = {
  /** Buchtitel in Anführungszeichen, sonst «das Buch» */
  t: string;
  name: string;
  /** «leihen» / «tauschen» / «geschenkt bekommen» */
  verb: string;
  /** «Bis Sa, 12. Dez. (noch 9 Tage)» oder leer */
  due: string;
  /** Tag aus d.day, formatiert, oder leer */
  day: string;
  d: NotifyData;
};

type Table = Record<NotificationType, (c: Ctx) => [string, string]>;

export const quote: Record<Locale, (t?: string) => string> = {
  de: (t) => (t ? `«${t}»` : "das Buch"),
  fr: (t) => (t ? `« ${t} »` : "le livre"),
  it: (t) => (t ? `«${t}»` : "il libro"),
};

export const verb: Record<Locale, (k?: string) => string> = {
  de: (k) => (k === "swap" ? "tauschen" : k === "gift" ? "geschenkt bekommen" : "leihen"),
  fr: (k) => (k === "swap" ? "échanger" : k === "gift" ? "recevoir en cadeau" : "emprunter"),
  it: (k) => (k === "swap" ? "scambiare" : k === "gift" ? "ricevere in regalo" : "prendere in prestito"),
};

const de: Table = {
  request_new: ({ name, t, verb, d }) => [`${name} möchte ${t} ${verb}`, d.text ?? "Du hast 72 Stunden Zeit für eine Antwort. Danach verfällt die Anfrage."],
  request_accepted: ({ name, t }) => [`${name} hat angenommen`, `${t}: Übergabeort und Termin stehen im Vorgang.`],
  request_auto_accepted: ({ t }) => ["Im Kreis angenommen", `${t} ist für dich reserviert. Sprich die Übergabe im Vorgang ab.`],
  request_declined: ({ t }) => [`Anfrage für ${t} abgelehnt`, "Es gibt vielleicht ein anderes Exemplar in deiner Nähe."],
  request_expired: ({ t }) => [`Anfrage für ${t} verfallen`, "Innert 72 Stunden kam keine Antwort. Der Zeitraum ist wieder frei."],
  cancelled: ({ t, d }) => [`${t}: Vorgang storniert`, `${d.name ?? "Die andere Seite"} hat storniert. Der Zeitraum ist wieder frei.`],
  handover_reported: ({ t }) => [`Bitte bestätige die Übergabe von ${t}`, "Ohne Einspruch gilt die Meldung nach 48 Stunden."],
  handover_done: ({ t, due }) => [`${t} ist übergeben`, due || "Der Vorgang ist abgeschlossen."],
  handover_expired: ({ t }) => [`${t}: keine Übergabe`, "7 Tage nach dem geplanten Beginn gab es keine Übergabe. Der Vorgang ist verfallen."],
  due_soon: ({ t, due }) => [`${t} ist bald fällig`, `${due}. Verlängern oder Rückgabe planen geht im Vorgang.`],
  due_tomorrow: ({ t }) => [`${t} ist morgen fällig`, "Plane die Rückgabe im Vorgang."],
  overdue: ({ t }) => [`${t} ist überfällig`, "Schlag im Chat einen Termin für die Rückgabe vor."],
  overdue_late: ({ t }) => [`${t}: 3 Tage überfällig`, "Die Kulanz ist vorbei, die Leihe zählt als unpünktlich. Bitte gib das Buch so bald wie möglich zurück."],
  overdue_case_possible: ({ t }) => [`${t}: 7 Tage überfällig`, "Neue Anfragen sind erst nach der Rückgabe wieder möglich."],
  extended: ({ t, due }) => [`${t} verlängert`, due],
  extension_requested: ({ name, t }) => [`${name} möchte ${t} länger behalten`, "Entscheide im Vorgang."],
  recalled: ({ name, t, due }) => [`${name} ruft ${t} zurück`, `Bitte gib das Buch innert 7 Tagen zurück. ${due}`],
  return_reported: ({ t }) => [`Hast du ${t} zurückbekommen?`, "Bestätige die Rückgabe. Ohne Einspruch gilt sie nach 48 Stunden."],
  returned: ({ t }) => [`Rückgabe von ${t} bestätigt`, "Danke. Die Leihe wird nach der Prüfung abgeschlossen."],
  completed: ({ t }) => [`${t}: abgeschlossen`, "Wie war es? Eine Antwort reicht: «Gerne wieder» oder «Es gab Probleme»."],
  damage_reported: ({ t }) => [`Schaden an ${t} gemeldet`, "Wähle im Fall eine von drei Antworten."],
  case_opened: ({ t }) => [`Fall zu ${t} eröffnet`, "Nenne einen Rückgabetermin, biete Ersatz an oder schlage einen Tausch vor."],
  case_reminder: ({ t }) => [`Zweite Aufforderung: ${t}`, "Ohne Reaktion wird dein Konto in 7 Tagen für Leihen und Tauschen gesperrt."],
  case_suspended: ({ t }) => ["Leihen und Tauschen gesperrt", `Der Fall zu ${t} ist weiter offen. Die Moderation prüft ihn.`],
  case_lost: ({ t }) => [`${t} gilt als verloren`, "Eine spätere Rückgabe oder ein Ersatz bereinigt den Eintrag."],
  case_response: ({ t, d }) => [`Antwort im Fall zu ${t}`, d.text ?? "Die andere Seite hat geantwortet. Details stehen im Vorgang."],
  case_resolved: ({ t, d }) => [`Fall zu ${t} gelöst`, d.text ?? "Der Vorgang ist abgeschlossen."],
  pass_on_ask: ({ t, d }) => [`Direkt weitergeben: ${t}`, d.text ?? "Stimmst du zu, dass das Buch direkt weitergegeben wird?"],
  pass_on_agreed: ({ t }) => [`${t} geht direkt weiter`, "Alle drei haben zugestimmt. Sprecht Ort und Zeit im Übergabe-Chat ab."],
  handover_chat: ({ t }) => [`Übergabe-Chat zu ${t}`, "Zwei Leihen folgen aufeinander. Sprecht den Wechsel ab."],
  start_earlier: ({ t, day }) => [`${t} ist früher zurück`, day ? `Du kannst ab ${day} beginnen.` : "Du kannst früher beginnen."],
  bookings_paused: ({ t }) => [`Buchung für ${t} pausiert`, "Zum Exemplar ist ein Fall offen. Du kannst ohne Nachteil stornieren."],
  someone_waiting: ({ name, t, day }) => [`${name} wartet auf ${t}`, day ? `Ab ${day}. Bitte gib das Buch zurück.` : "Bitte gib das Buch zurück."],
  swap_offer: ({ name, t }) => [`${name} möchte ${t} behalten`, "und bietet dir dafür ein eigenes Buch an."],
  title_alarm: ({ t, d }) => [`${t} ist verfügbar`, d.text ?? "Ein Exemplar in deinem Umkreis ist frei."],
  swap_match: ({ name, t }) => ["Tauschtreffer", `${name} hat ${t} von deiner Wunschliste, und du hast eines von ${name}s.`],
  message: ({ name, t, d }) => [`${name}: ${t}`, d.text ?? "Neue Nachricht"],
  invite_own_books: () => ["Dein Regal ist noch leer", "Wer leiht, verleiht oft auch. Ein Buch einstellen dauert unter 20 Sekunden."],
  circle_join_request: ({ name, d }) => [`${name} möchte beitreten`, d.text ?? "Gib die Anfrage im Kreis frei."],
};

const fr: Table = {
  request_new: ({ name, t, verb, d }) => [`${name} aimerait ${verb} ${t}`, d.text ?? "Tu as 72 heures pour répondre. Ensuite, la demande expire."],
  request_accepted: ({ name, t }) => [`${name} a accepté`, `${t} : le lieu et la date de remise figurent dans la transaction.`],
  request_auto_accepted: ({ t }) => ["Accepté dans le cercle", `${t} est réservé pour toi. Convenez de la remise dans la transaction.`],
  request_declined: ({ t }) => [`Demande pour ${t} refusée`, "Il y a peut-être un autre exemplaire près de chez toi."],
  request_expired: ({ t }) => [`Demande pour ${t} expirée`, "Aucune réponse en 72 heures. La période est de nouveau libre."],
  cancelled: ({ t, d }) => [`${t} : transaction annulée`, `${d.name ?? "L’autre partie"} a annulé. La période est de nouveau libre.`],
  handover_reported: ({ t }) => [`Confirme la remise de ${t}`, "Sans opposition, la déclaration est valable après 48 heures."],
  handover_done: ({ t, due }) => [`${t} a été remis`, due || "La transaction est terminée."],
  handover_expired: ({ t }) => [`${t} : pas de remise`, "Aucune remise dans les 7 jours suivant le début prévu. La transaction a expiré."],
  due_soon: ({ t, due }) => [`${t} arrive bientôt à échéance`, `${due}. Tu peux prolonger ou planifier le retour dans la transaction.`],
  due_tomorrow: ({ t }) => [`${t} est à rendre demain`, "Planifie le retour dans la transaction."],
  overdue: ({ t }) => [`${t} est en retard`, "Propose une date de retour dans le chat."],
  overdue_late: ({ t }) => [`${t} : 3 jours de retard`, "Le délai de grâce est passé, le prêt compte comme en retard. Rends le livre dès que possible."],
  overdue_case_possible: ({ t }) => [`${t} : 7 jours de retard`, "De nouvelles demandes ne seront possibles qu’après le retour."],
  extended: ({ t, due }) => [`${t} prolongé`, due],
  extension_requested: ({ name, t }) => [`${name} aimerait garder ${t} plus longtemps`, "Décide dans la transaction."],
  recalled: ({ name, t, due }) => [`${name} rappelle ${t}`, `Rends le livre dans les 7 jours. ${due}`],
  return_reported: ({ t }) => [`As-tu récupéré ${t} ?`, "Confirme le retour. Sans opposition, il est valable après 48 heures."],
  returned: ({ t }) => [`Retour de ${t} confirmé`, "Merci. Le prêt sera clôturé après la vérification."],
  completed: ({ t }) => [`${t} : terminé`, "Comment ça s’est passé ? Une réponse suffit : « Volontiers à nouveau » ou « Il y a eu un problème »."],
  damage_reported: ({ t }) => [`Dommage signalé sur ${t}`, "Choisis l’une des trois réponses dans le litige."],
  case_opened: ({ t }) => [`Litige ouvert pour ${t}`, "Indique une date de retour, propose un remplacement ou suggère un échange."],
  case_reminder: ({ t }) => [`Deuxième rappel : ${t}`, "Sans réaction, ton compte sera bloqué pour les prêts et échanges dans 7 jours."],
  case_suspended: ({ t }) => ["Prêts et échanges bloqués", `Le litige concernant ${t} est toujours ouvert. La modération l’examine.`],
  case_lost: ({ t }) => [`${t} est considéré comme perdu`, "Un retour ultérieur ou un remplacement efface l’inscription."],
  case_response: ({ t, d }) => [`Réponse dans le litige concernant ${t}`, d.text ?? "L’autre partie a répondu. Les détails figurent dans la transaction."],
  case_resolved: ({ t, d }) => [`Litige concernant ${t} résolu`, d.text ?? "La transaction est terminée."],
  pass_on_ask: ({ t, d }) => [`Transmettre directement : ${t}`, d.text ?? "Acceptes-tu que le livre soit transmis directement ?"],
  pass_on_agreed: ({ t }) => [`${t} est transmis directement`, "Les trois personnes ont accepté. Convenez du lieu et de l’heure dans le chat de remise."],
  handover_chat: ({ t }) => [`Chat de remise pour ${t}`, "Deux prêts se suivent. Convenez du passage de relais."],
  start_earlier: ({ t, day }) => [`${t} est de retour plus tôt`, day ? `Tu peux commencer dès le ${day}.` : "Tu peux commencer plus tôt."],
  bookings_paused: ({ t }) => [`Réservation de ${t} en pause`, "Un litige est ouvert pour cet exemplaire. Tu peux annuler sans pénalité."],
  someone_waiting: ({ name, t, day }) => [`${name} attend ${t}`, day ? `Dès le ${day}. Merci de rendre le livre.` : "Merci de rendre le livre."],
  swap_offer: ({ name, t }) => [`${name} aimerait garder ${t}`, "et te propose un de ses livres en échange."],
  title_alarm: ({ t, d }) => [`${t} est disponible`, d.text ?? "Un exemplaire est libre dans ton rayon."],
  swap_match: ({ name, t }) => ["Échange possible", `${name} a ${t} de ta liste d’envies, et tu as un livre de la sienne.`],
  message: ({ name, t, d }) => [`${name} : ${t}`, d.text ?? "Nouveau message"],
  invite_own_books: () => ["Ton étagère est encore vide", "Qui emprunte prête souvent aussi. Ajouter un livre prend moins de 20 secondes."],
  circle_join_request: ({ name, d }) => [`${name} aimerait rejoindre le cercle`, d.text ?? "Valide la demande dans le cercle."],
};

const it: Table = {
  request_new: ({ name, t, verb, d }) => [`${name} vorrebbe ${verb} ${t}`, d.text ?? "Hai 72 ore per rispondere. Poi la richiesta scade."],
  request_accepted: ({ name, t }) => [`${name} ha accettato`, `${t}: luogo e data della consegna sono nella pratica.`],
  request_auto_accepted: ({ t }) => ["Accettato nella cerchia", `${t} è riservato per te. Concordate la consegna nella pratica.`],
  request_declined: ({ t }) => [`Richiesta per ${t} rifiutata`, "Forse c’è un altro esemplare vicino a te."],
  request_expired: ({ t }) => [`Richiesta per ${t} scaduta`, "Nessuna risposta entro 72 ore. Il periodo è di nuovo libero."],
  cancelled: ({ t, d }) => [`${t}: pratica annullata`, `${d.name ?? "L’altra parte"} ha annullato. Il periodo è di nuovo libero.`],
  handover_reported: ({ t }) => [`Conferma la consegna di ${t}`, "Senza obiezioni, la segnalazione vale dopo 48 ore."],
  handover_done: ({ t, due }) => [`${t} è stato consegnato`, due || "La pratica è conclusa."],
  handover_expired: ({ t }) => [`${t}: nessuna consegna`, "Nessuna consegna entro 7 giorni dall’inizio previsto. La pratica è scaduta."],
  due_soon: ({ t, due }) => [`${t} scade presto`, `${due}. Puoi prolungare o pianificare la restituzione nella pratica.`],
  due_tomorrow: ({ t }) => [`${t} scade domani`, "Pianifica la restituzione nella pratica."],
  overdue: ({ t }) => [`${t} è in ritardo`, "Proponi una data di restituzione nella chat."],
  overdue_late: ({ t }) => [`${t}: 3 giorni di ritardo`, "La tolleranza è finita, il prestito conta come non puntuale. Restituisci il libro il prima possibile."],
  overdue_case_possible: ({ t }) => [`${t}: 7 giorni di ritardo`, "Nuove richieste saranno possibili solo dopo la restituzione."],
  extended: ({ t, due }) => [`${t} prolungato`, due],
  extension_requested: ({ name, t }) => [`${name} vorrebbe tenere ${t} più a lungo`, "Decidi nella pratica."],
  recalled: ({ name, t, due }) => [`${name} richiama ${t}`, `Restituisci il libro entro 7 giorni. ${due}`],
  return_reported: ({ t }) => [`Hai riavuto ${t}?`, "Conferma la restituzione. Senza obiezioni, vale dopo 48 ore."],
  returned: ({ t }) => [`Restituzione di ${t} confermata`, "Grazie. Il prestito sarà chiuso dopo la verifica."],
  completed: ({ t }) => [`${t}: concluso`, "Com’è andata? Basta una risposta: «Volentieri di nuovo» o «Ci sono stati problemi»."],
  damage_reported: ({ t }) => [`Danno segnalato a ${t}`, "Scegli una delle tre risposte nel caso."],
  case_opened: ({ t }) => [`Caso aperto per ${t}`, "Indica una data di restituzione, offri una sostituzione o proponi uno scambio."],
  case_reminder: ({ t }) => [`Secondo sollecito: ${t}`, "Senza reazione, tra 7 giorni il tuo conto sarà bloccato per prestiti e scambi."],
  case_suspended: ({ t }) => ["Prestiti e scambi bloccati", `Il caso relativo a ${t} è ancora aperto. La moderazione lo sta esaminando.`],
  case_lost: ({ t }) => [`${t} è considerato perso`, "Una restituzione successiva o una sostituzione cancella la voce."],
  case_response: ({ t, d }) => [`Risposta nel caso relativo a ${t}`, d.text ?? "L’altra parte ha risposto. I dettagli sono nella pratica."],
  case_resolved: ({ t, d }) => [`Caso relativo a ${t} risolto`, d.text ?? "La pratica è conclusa."],
  pass_on_ask: ({ t, d }) => [`Passare direttamente: ${t}`, d.text ?? "Sei d’accordo che il libro venga passato direttamente?"],
  pass_on_agreed: ({ t }) => [`${t} passa direttamente`, "Tutti e tre hanno accettato. Concordate luogo e ora nella chat di consegna."],
  handover_chat: ({ t }) => [`Chat di consegna per ${t}`, "Due prestiti si susseguono. Concordate il passaggio."],
  start_earlier: ({ t, day }) => [`${t} è tornato prima`, day ? `Puoi iniziare dal ${day}.` : "Puoi iniziare prima."],
  bookings_paused: ({ t }) => [`Prenotazione di ${t} sospesa`, "Per questo esemplare è aperto un caso. Puoi annullare senza svantaggi."],
  someone_waiting: ({ name, t, day }) => [`${name} aspetta ${t}`, day ? `Dal ${day}. Restituisci il libro, per favore.` : "Restituisci il libro, per favore."],
  swap_offer: ({ name, t }) => [`${name} vorrebbe tenere ${t}`, "e in cambio ti offre un suo libro."],
  title_alarm: ({ t, d }) => [`${t} è disponibile`, d.text ?? "Un esemplare nel tuo raggio è libero."],
  swap_match: ({ name, t }) => ["Scambio possibile", `${name} ha ${t} dalla tua lista dei desideri, e tu hai un libro della sua.`],
  message: ({ name, t, d }) => [`${name}: ${t}`, d.text ?? "Nuovo messaggio"],
  invite_own_books: () => ["Il tuo scaffale è ancora vuoto", "Chi prende in prestito spesso presta anche. Aggiungere un libro richiede meno di 20 secondi."],
  circle_join_request: ({ name, d }) => [`${name} vorrebbe entrare nella cerchia`, d.text ?? "Approva la richiesta nella cerchia."],
};

export const TEXTS: Record<Locale, Table> = { de, fr, it };

/** Rahmen der E-Mails und Knöpfe */
export const MAIL: Record<Locale, { open: string; toLoan: string; settings: string; changeNotifications: string; tagline: string }> = {
  de: { open: "Öffnen", toLoan: "Zum Vorgang", settings: "Einstellungen", changeNotifications: "Benachrichtigungen ändern", tagline: "Bücher aus Regalen in deiner Nähe" },
  fr: { open: "Ouvrir", toLoan: "Voir la transaction", settings: "Paramètres", changeNotifications: "Modifier les notifications", tagline: "Des livres des étagères près de chez toi" },
  it: { open: "Apri", toLoan: "Vai alla pratica", settings: "Impostazioni", changeNotifications: "Modifica le notifiche", tagline: "Libri dagli scaffali vicino a te" },
};
