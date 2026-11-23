import type { Locale } from "../locale";

const de = {
  byPost: "Per Post",
  pickup: "Abholen",
  byPostHint: "Die verleihende Person schickt das Buch, du schickst es zurück. Porto zahlt, wer verschickt.",
  address: "Deine Adresse",
  addressHint: "Name, Strasse, PLZ und Ort. Sichtbar erst, wenn die Anfrage angenommen ist.",
  shipTo: "Lieferadresse",
  returnTo: "Adresse für die Rücksendung",
  returnToHint: "Sieht nur die leihende Person, nach der Annahme. Nach Abschluss löschen wir beide Adressen.",
  ownerShipsAt: "Das Porto für den Hinweg trägst du.",
  tracking: "Sendungsnummer",
  trackingHint: "Steht auf dem Beleg der Post, z. B. 99.00.123456.12345678.",
  shipCtx: (name: string) => `Schick das Buch an ${name} und trag die Sendungsnummer ein.`,
  shipped: "Als verschickt melden",
  shipBackCtx: (due: string) => `Schick das Buch zurück und trag die Sendungsnummer ein. ${due}`,
  shippedBack: "Rücksendung melden",
  inTransit: (n: string) => `Unterwegs mit Sendungsnummer ${n}.`,
  track: "Sendung verfolgen",
  confirmCtx: (name: string) => `${name} hat das Buch verschickt. Bestätige den Empfang, sobald es da ist. Ohne Einspruch gilt es nach 7 Tagen als angekommen.`,
  card: "Versand",
  allowed: ["Auch per Post", "Leihende können das Buch per Post anfragen. Das Porto für den Hinweg trägst du, die Rücksendung die andere Person."],
  sentToast: "Als verschickt gemeldet.",
  returnedToast: "Rücksendung gemeldet.",
  chip: "Versand",
};
type M = typeof de;

const fr: M = {
  byPost: "Par la poste",
  pickup: "Retrait",
  byPostHint: "La personne qui prête envoie le livre, tu le renvoies. Le port est payé par qui envoie.",
  address: "Ton adresse",
  addressHint: "Nom, rue, NPA et localité. Visible seulement une fois la demande acceptée.",
  shipTo: "Adresse de livraison",
  returnTo: "Adresse pour le retour",
  returnToHint: "Visible uniquement par la personne qui emprunte, après l’acceptation. Nous effaçons les deux adresses après la clôture.",
  ownerShipsAt: "Tu paies le port pour l’aller.",
  tracking: "Numéro d’envoi",
  trackingHint: "Figure sur le récépissé de la Poste, p. ex. 99.00.123456.12345678.",
  shipCtx: (name) => `Envoie le livre à ${name} et indique le numéro d’envoi.`,
  shipped: "Signaler l’envoi",
  shipBackCtx: (due) => `Renvoie le livre et indique le numéro d’envoi. ${due}`,
  shippedBack: "Signaler le retour",
  inTransit: (n) => `En route avec le numéro d’envoi ${n}.`,
  track: "Suivre l’envoi",
  confirmCtx: (name) => `${name} a envoyé le livre. Confirme la réception dès qu’il est arrivé. Sans opposition, il est considéré comme arrivé après 7 jours.`,
  card: "Envoi",
  allowed: ["Aussi par la poste", "Les emprunteur·euses peuvent demander l’envoi. Tu paies le port pour l’aller, l’autre personne le retour."],
  sentToast: "Envoi signalé.",
  returnedToast: "Retour signalé.",
  chip: "Envoi",
};

const it: M = {
  byPost: "Per posta",
  pickup: "Ritiro",
  byPostHint: "Chi presta spedisce il libro, tu lo rispedisci. Paga il porto chi spedisce.",
  address: "Il tuo indirizzo",
  addressHint: "Nome, via, NPA e località. Visibile solo quando la richiesta è accettata.",
  shipTo: "Indirizzo di consegna",
  returnTo: "Indirizzo per la restituzione",
  returnToHint: "Lo vede solo chi prende in prestito, dopo l’accettazione. Dopo la chiusura cancelliamo entrambi gli indirizzi.",
  ownerShipsAt: "Il porto per l’andata lo paghi tu.",
  tracking: "Numero di spedizione",
  trackingHint: "Si trova sulla ricevuta della Posta, ad es. 99.00.123456.12345678.",
  shipCtx: (name) => `Spedisci il libro a ${name} e inserisci il numero di spedizione.`,
  shipped: "Segnala come spedito",
  shipBackCtx: (due) => `Rispedisci il libro e inserisci il numero di spedizione. ${due}`,
  shippedBack: "Segnala la rispedizione",
  inTransit: (n) => `In viaggio con il numero di spedizione ${n}.`,
  track: "Segui la spedizione",
  confirmCtx: (name) => `${name} ha spedito il libro. Conferma la ricezione appena arriva. Senza obiezioni è considerato arrivato dopo 7 giorni.`,
  card: "Spedizione",
  allowed: ["Anche per posta", "Si può richiedere la spedizione. Il porto per l’andata lo paghi tu, la restituzione l’altra persona."],
  sentToast: "Segnalato come spedito.",
  returnedToast: "Rispedizione segnalata.",
  chip: "Spedizione",
};

const en: M = {
  byPost: "By post",
  pickup: "Pick up",
  byPostHint: "The lender posts the book, you post it back. Whoever sends pays the postage.",
  address: "Your address",
  addressHint: "Name, street, postcode and town. Only visible once the request is accepted.",
  shipTo: "Delivery address",
  returnTo: "Address for the return",
  returnToHint: "Only the borrower sees it, after acceptance. We delete both addresses once the loan is closed.",
  ownerShipsAt: "You pay the postage for sending it out.",
  tracking: "Tracking number",
  trackingHint: "It’s on the post office receipt, e.g. 99.00.123456.12345678.",
  shipCtx: (name) => `Post the book to ${name} and enter the tracking number.`,
  shipped: "Mark as sent",
  shipBackCtx: (due) => `Post the book back and enter the tracking number. ${due}`,
  shippedBack: "Report return shipment",
  inTransit: (n) => `On its way with tracking number ${n}.`,
  track: "Track shipment",
  confirmCtx: (name) => `${name} has posted the book. Confirm receipt once it arrives. Without objection it counts as arrived after 7 days.`,
  card: "Shipping",
  allowed: ["Also by post", "Borrowers can ask for the book to be posted. You pay the postage out, the other person the return."],
  sentToast: "Marked as sent.",
  returnedToast: "Return shipment reported.",
  chip: "Shipping",
};

export const SHIPPING: Record<Locale, M> = { de, fr, it, en };

/** Link zur Sendungsverfolgung der Schweizerischen Post (andere Formate ohne Link) */
export function trackingUrl(n: string): string | null {
  const clean = n.replace(/[\s.]/g, "");
  if (/^\d{18}$/.test(clean) || /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(clean)) return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(clean)}`;
  return null;
}
