import type { Locale } from "../locale";

const de = {
  title: "Benachrichtigungen",
  heading: ["Benach­richtigungen. ", "Was neu ist."],
  newSince: (n: number) => (n === 1 ? "1 neue seit deinem letzten Besuch" : `${n} neue seit deinem letzten Besuch`),
  allRead: "Alles gelesen",
  sub: "Anfragen, Fristen und Titelalarme an einem Ort. Beim Öffnen dieser Seite gelten alle als gelesen.",
  statNew: "neu",
  statAll: "insgesamt",
  filter: "Filter",
  filters: { alle: "Alle", anfragen: "Leihen und Tausch", fristen: "Fristen", alarme: "Titelalarme", weiteres: "Weiteres" },
  days: { today: "Heute", yesterday: "Gestern", week: "Diese Woche", earlier: "Früher" },
  empty: "Noch nichts.",
  emptyText: "Hier erscheinen Anfragen zu deinen Büchern, Rückgabefristen und Titelalarme aus deiner Wunschliste.",
  searchBooks: "Bücher suchen",
  newSection: "Neu",
  newSr: "Neu: ",
  noneOfKind: "Keine Benachrichtigungen dieser Art.",
  showAll: "Alle zeigen",
};
type M = typeof de;

const fr: M = {
  title: "Notifications",
  heading: ["Notifications. ", "Les nouveautés."],
  newSince: (n) => (n === 1 ? "1 nouvelle depuis ta dernière visite" : `${n} nouvelles depuis ta dernière visite`),
  allRead: "Tout est lu",
  sub: "Demandes, échéances et alertes de titres au même endroit. À l’ouverture de cette page, tout est marqué comme lu.",
  statNew: "nouvelles",
  statAll: "au total",
  filter: "Filtre",
  filters: { alle: "Toutes", anfragen: "Prêts et échanges", fristen: "Échéances", alarme: "Alertes de titres", weiteres: "Autres" },
  days: { today: "Aujourd’hui", yesterday: "Hier", week: "Cette semaine", earlier: "Plus tôt" },
  empty: "Rien pour l’instant.",
  emptyText: "Ici apparaissent les demandes pour tes livres, les délais de retour et les alertes de ta liste d’envies.",
  searchBooks: "Chercher des livres",
  newSection: "Nouveau",
  newSr: "Nouveau : ",
  noneOfKind: "Aucune notification de ce type.",
  showAll: "Tout afficher",
};

const it: M = {
  title: "Notifiche",
  heading: ["Notifiche. ", "Le novità."],
  newSince: (n) => (n === 1 ? "1 nuova dalla tua ultima visita" : `${n} nuove dalla tua ultima visita`),
  allRead: "Tutto letto",
  sub: "Richieste, scadenze e avvisi di titoli in un unico posto. Aprendo questa pagina, tutte risultano lette.",
  statNew: "nuove",
  statAll: "in totale",
  filter: "Filtro",
  filters: { alle: "Tutte", anfragen: "Prestiti e scambi", fristen: "Scadenze", alarme: "Avvisi di titoli", weiteres: "Altro" },
  days: { today: "Oggi", yesterday: "Ieri", week: "Questa settimana", earlier: "Prima" },
  empty: "Ancora niente.",
  emptyText: "Qui appaiono le richieste per i tuoi libri, le scadenze di restituzione e gli avvisi dalla tua lista dei desideri.",
  searchBooks: "Cerca libri",
  newSection: "Nuove",
  newSr: "Nuova: ",
  noneOfKind: "Nessuna notifica di questo tipo.",
  showAll: "Mostra tutte",
};

const en: M = {
  title: "Notifications",
  heading: ["Notifi­cations. ", "What’s new."],
  newSince: (n: number) => (n === 1 ? "1 new since your last visit" : `${n} new since your last visit`),
  allRead: "All read",
  sub: "Requests, deadlines and title alerts in one place. Opening this page marks them all as read.",
  statNew: "new",
  statAll: "in total",
  filter: "Filter",
  filters: { alle: "All", anfragen: "Loans and swaps", fristen: "Deadlines", alarme: "Title alerts", weiteres: "More" },
  days: { today: "Today", yesterday: "Yesterday", week: "This week", earlier: "Earlier" },
  empty: "Nothing yet.",
  emptyText: "Requests for your books, return deadlines and title alerts from your wishlist will appear here.",
  searchBooks: "Search books",
  newSection: "New",
  newSr: "New: ",
  noneOfKind: "No notifications of this kind.",
  showAll: "Show all",
};

export const NOTIF: Record<Locale, M> = { de, fr, it, en };
