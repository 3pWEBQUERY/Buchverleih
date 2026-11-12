import type { Locale } from "../locale";

const de = {
  skip: "Zum Inhalt",
  home: "Leihregal, Start",
  description: "Bücher aus Regalen in deiner Nähe leihen, tauschen und verschenken. Kostenlos unter Privatpersonen.",
  addBook: "Buch erfassen",
  nav: { main: "Hauptnavigation", start: "Start", loans: "Vorgänge", shelf: "Mein Regal", shelfShort: "Regal", circles: "Kreise", wishlist: "Wunschliste", notifications: "Benachrichtigungen", moderation: "Moderation", profile: "Profil", search: "Suche", calendar: "Verleihkalender", settings: "Einstellungen", help: "Hilfe", privacy: "Datenschutz", imprint: "Impressum", legal: "Rechtliches", more: "Weitere Seiten" },
  searchPlaceholder: "Titel, Autorin, ISBN",
  publicNav: { find: "Bücher finden", how: "So funktioniert es", login: "Anmelden" },
  footer: {
    claim: "Bücher aus Regalen in deiner Nähe. Kostenlos unter Privatpersonen, mit festen Fristen und einer Bestätigung bei jeder Übergabe.",
    discover: "Entdecken", find: "Bücher finden", addBook: "Buch einstellen", newCircle: "Kreis gründen",
    help: "Hilfe", how: "So funktioniert es", damage: "Schaden und Verlust", rules: "Regeln",
    legal: "Rechtliches", terms: "Nutzungsbedingungen", privacy: "Datenschutz", imprint: "Impressum",
    beta: "Leihregal · Beta Zürich und Zürcher Unterland", eu: "Daten in der EU gespeichert",
    legalNote: "",
  },
};
type M = typeof de;

const fr: M = {
  skip: "Aller au contenu",
  home: "Leihregal, accueil",
  description: "Emprunter, échanger et donner des livres des étagères près de chez toi. Gratuit entre particuliers.",
  addBook: "Ajouter un livre",
  nav: { main: "Navigation principale", start: "Accueil", loans: "Transactions", shelf: "Mon étagère", shelfShort: "Étagère", circles: "Cercles", wishlist: "Liste d’envies", notifications: "Notifications", moderation: "Modération", profile: "Profil", search: "Recherche", calendar: "Calendrier des prêts", settings: "Paramètres", help: "Aide", privacy: "Confidentialité", imprint: "Mentions légales", legal: "Informations légales", more: "Autres pages" },
  searchPlaceholder: "Titre, auteur·e, ISBN",
  publicNav: { find: "Trouver des livres", how: "Comment ça marche", login: "Se connecter" },
  footer: {
    claim: "Des livres des étagères près de chez toi. Gratuit entre particuliers, avec des délais fixes et une confirmation à chaque remise.",
    discover: "Découvrir", find: "Trouver des livres", addBook: "Proposer un livre", newCircle: "Créer un cercle",
    help: "Aide", how: "Comment ça marche", damage: "Dommages et pertes", rules: "Règles",
    legal: "Informations légales", terms: "Conditions d’utilisation", privacy: "Confidentialité", imprint: "Mentions légales",
    beta: "Leihregal · Bêta Zurich et Unterland zurichois", eu: "Données stockées dans l’UE",
    legalNote: "Les textes juridiques font foi en allemand.",
  },
};

const it: M = {
  skip: "Vai al contenuto",
  home: "Leihregal, home",
  description: "Prendere in prestito, scambiare e regalare libri dagli scaffali vicino a te. Gratis tra privati.",
  addBook: "Aggiungi libro",
  nav: { main: "Navigazione principale", start: "Home", loans: "Pratiche", shelf: "Il mio scaffale", shelfShort: "Scaffale", circles: "Cerchie", wishlist: "Lista dei desideri", notifications: "Notifiche", moderation: "Moderazione", profile: "Profilo", search: "Ricerca", calendar: "Calendario dei prestiti", settings: "Impostazioni", help: "Aiuto", privacy: "Privacy", imprint: "Note legali", legal: "Informazioni legali", more: "Altre pagine" },
  searchPlaceholder: "Titolo, autore, ISBN",
  publicNav: { find: "Trova libri", how: "Come funziona", login: "Accedi" },
  footer: {
    claim: "Libri dagli scaffali vicino a te. Gratis tra privati, con scadenze fisse e una conferma a ogni consegna.",
    discover: "Scopri", find: "Trova libri", addBook: "Aggiungi un libro", newCircle: "Crea una cerchia",
    help: "Aiuto", how: "Come funziona", damage: "Danni e perdite", rules: "Regole",
    legal: "Informazioni legali", terms: "Condizioni d’uso", privacy: "Privacy", imprint: "Note legali",
    beta: "Leihregal · Beta Zurigo e Unterland zurighese", eu: "Dati conservati nell’UE",
    legalNote: "I testi giuridici fanno fede in tedesco.",
  },
};

export const SHELL: Record<Locale, M> = { de, fr, it };
