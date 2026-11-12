/**
 * Fehlermeldungen des Servers in drei Sprachen. Der Code wirft weiterhin deutsche Meldungen;
 * die API übersetzt sie beim Antworten (src/lib/api.ts). Schlüssel ist der deutsche Text, genau so,
 * wie er im Code steht. Meldungen mit Zahlen oder Namen stehen in ERROR_PATTERNS.
 * Unbekannte Meldungen bleiben deutsch.
 */
import type { Locale } from "../locale";

type FrIt = [fr: string, it: string];

export const ERRORS: Record<string, FrIt> = {
  // Allgemein (errors.ts, api.ts)
  "Der E-Mail-Versand ist noch nicht eingerichtet. Bitte versuche es später erneut.": ["L’envoi d’e-mails n’est pas encore configuré. Réessaie plus tard.", "L’invio di e-mail non è ancora configurato. Riprova più tardi."],
  "Dieses Gerät ist noch mit einem anderen Konto verbunden. Melde es dort zuerst ab.": ["Cet appareil est encore lié à un autre compte. Déconnecte-le d’abord de ce compte.", "Questo dispositivo è ancora collegato a un altro conto. Esci prima da quel conto."],
  "Bitte melde dich an.": ["Connecte-toi, s’il te plaît.", "Accedi, per favore."],
  "Dafür fehlt dir die Berechtigung.": ["Tu n’as pas l’autorisation pour cela.", "Non hai l’autorizzazione per farlo."],
  "Nicht gefunden.": ["Introuvable.", "Non trovato."],
  "Zu viele Versuche. Warte einen Moment und versuche es erneut.": ["Trop de tentatives. Attends un instant et réessaie.", "Troppi tentativi. Aspetta un momento e riprova."],
  "Dieser Schritt ist nicht mehr möglich. Lade die Seite neu, um den aktuellen Stand zu sehen.": ["Cette étape n’est plus possible. Recharge la page pour voir l’état actuel.", "Questo passo non è più possibile. Ricarica la pagina per vedere lo stato attuale."],
  "Diese Anfrage kommt nicht von Leihregal.": ["Cette requête ne provient pas de Leihregal.", "Questa richiesta non proviene da Leihregal."],
  "Die Anfrage ist zu gross.": ["La requête est trop volumineuse.", "La richiesta è troppo grande."],
  "Die Anfrage konnte nicht gelesen werden.": ["La requête n’a pas pu être lue.", "Non è stato possibile leggere la richiesta."],
  "Dieser Zeitraum ist im Verleihkalender bereits belegt. Wähle einen freien Zeitraum.": ["Cette période est déjà occupée dans le calendrier des prêts. Choisis une période libre.", "Questo periodo è già occupato nel calendario dei prestiti. Scegli un periodo libero."],
  "Das gibt es bereits. Lade die Seite neu, um den aktuellen Stand zu sehen.": ["Cela existe déjà. Recharge la page pour voir l’état actuel.", "Esiste già. Ricarica la pagina per vedere lo stato attuale."],
  "Dieses Datum gibt es nicht. Prüfe die Eingabe.": ["Cette date n’existe pas. Vérifie la saisie.", "Questa data non esiste. Controlla l’inserimento."],
  "Dieser Schritt verletzt eine Regel des Vorgangs. Lade die Seite neu.": ["Cette étape enfreint une règle de la transaction. Recharge la page.", "Questo passo viola una regola della pratica. Ricarica la pagina."],
  "Etwas ist schiefgelaufen. Versuche es in einem Moment erneut.": ["Quelque chose s’est mal passé. Réessaie dans un instant.", "Qualcosa è andato storto. Riprova tra un momento."],
  "Ungültige Eingabe.": ["Saisie invalide.", "Inserimento non valido."],
  // Eigene Meldungen in Eingabeprüfungen
  "ungültige ID": ["ID invalide", "ID non valido"],
  "Datum im Format JJJJ-MM-TT": ["Date au format AAAA-MM-JJ", "Data nel formato AAAA-MM-GG"],
  "Dieses Datum gibt es nicht": ["Cette date n’existe pas", "Questa data non esiste"],
  "Nur Fotos (JPEG, PNG, WebP, HEIC)": ["Seulement des photos (JPEG, PNG, WebP, HEIC)", "Solo foto (JPEG, PNG, WebP, HEIC)"],

  // Anmeldung, Konto, Telefon
  "Diese E-Mail-Adresse sieht unvollständig aus.": ["Cette adresse e-mail semble incomplète.", "Questo indirizzo e-mail sembra incompleto."],
  "Dieser Link ist abgelaufen oder wurde schon verwendet. Fordere einen neuen an.": ["Ce lien a expiré ou a déjà été utilisé. Demandes-en un nouveau.", "Questo link è scaduto o è già stato usato. Richiedine uno nuovo."],
  "Die Anfrage ist abgelaufen. Versuche es erneut.": ["La demande a expiré. Réessaie.", "La richiesta è scaduta. Riprova."],
  "Der Passkey konnte nicht bestätigt werden.": ["La clé d’accès n’a pas pu être confirmée.", "Non è stato possibile confermare la passkey."],
  "Dieser Passkey ist bei Leihregal nicht bekannt. Melde dich per E-Mail-Link an.": ["Cette clé d’accès n’est pas connue de Leihregal. Connecte-toi avec un lien par e-mail.", "Questa passkey non è nota a Leihregal. Accedi con il link via e-mail."],
  "Gib eine Mobilnummer ein, zum Beispiel 079 123 45 67.": ["Saisis un numéro de mobile, par exemple 079 123 45 67.", "Inserisci un numero di cellulare, per esempio 079 123 45 67."],
  "Diese Nummer kann nicht verwendet werden. Melde dich bei der Moderation, wenn du das für einen Fehler hältst.": ["Ce numéro ne peut pas être utilisé. Contacte la modération si tu penses que c’est une erreur.", "Questo numero non può essere usato. Contatta la moderazione se pensi che sia un errore."],
  "Diese Nummer gehört bereits zu einem anderen Konto. Eine Nummer, ein Konto.": ["Ce numéro appartient déjà à un autre compte. Un numéro, un compte.", "Questo numero appartiene già a un altro conto. Un numero, un conto."],
  "Der Code ist abgelaufen. Fordere einen neuen an.": ["Le code a expiré. Demandes-en un nouveau.", "Il codice è scaduto. Richiedine uno nuovo."],
  "Zu viele Versuche. Fordere einen neuen Code an.": ["Trop de tentatives. Demande un nouveau code.", "Troppi tentativi. Richiedi un nuovo codice."],
  "Der Code stimmt nicht. Prüfe die sechs Ziffern aus der SMS.": ["Le code est incorrect. Vérifie les six chiffres du SMS.", "Il codice non è corretto. Controlla le sei cifre dell’SMS."],
  "Dein Konto ist gesperrt. Antworte auf die E-Mail der Moderation, um das zu klären.": ["Ton compte est bloqué. Réponds à l’e-mail de la modération pour clarifier la situation.", "Il tuo conto è bloccato. Rispondi all’e-mail della moderazione per chiarire."],
  "Schliesse zuerst die Anmeldung ab.": ["Termine d’abord l’inscription.", "Completa prima la registrazione."],
  "Gib deinen Vornamen ein.": ["Saisis ton prénom.", "Inserisci il tuo nome."],
  "Gib dein Geburtsdatum ein.": ["Saisis ta date de naissance.", "Inserisci la tua data di nascita."],
  "Für ein eigenes Konto brauchst du mindestens 16 Jahre. Kinderbücher leihen deine Eltern.": ["Il faut avoir au moins 16 ans pour avoir son propre compte. Les livres pour enfants, ce sont tes parents qui les empruntent.", "Per avere un conto tuo devi avere almeno 16 anni. I libri per bambini li prendono in prestito i tuoi genitori."],
  "Leihregal ist in deiner Region noch nicht offen. Trag dich auf die Warteliste ein, wir melden uns.": ["Leihregal n’est pas encore ouvert dans ta région. Inscris-toi sur la liste d’attente, nous te contacterons.", "Leihregal non è ancora aperto nella tua regione. Iscriviti alla lista d’attesa, ti contatteremo."],
  "Leihregal ist in dieser Region noch nicht offen. Trag dich auf die Warteliste ein, wir melden uns.": ["Leihregal n’est pas encore ouvert dans cette région. Inscris-toi sur la liste d’attente, nous te contacterons.", "Leihregal non è ancora aperto in questa regione. Iscriviti alla lista d’attesa, ti contatteremo."],
  "Gib eine vierstellige Postleitzahl ein.": ["Saisis un numéro postal à quatre chiffres.", "Inserisci un numero postale di quattro cifre."],
  "Dieses Bild können wir nicht verwenden. Lade es erneut hoch.": ["Nous ne pouvons pas utiliser cette image. Téléverse-la à nouveau.", "Non possiamo usare questa immagine. Caricala di nuovo."],
  "Das geht nicht beim eigenen Konto.": ["Ce n’est pas possible avec ton propre compte.", "Non è possibile con il tuo conto."],

  // Voraussetzungen für Anfragen (trust.ts)
  "Vervollständige zuerst dein Profil.": ["Complète d’abord ton profil.", "Completa prima il tuo profilo."],
  "Bestätige zuerst deine E-Mail-Adresse.": ["Confirme d’abord ton adresse e-mail.", "Conferma prima il tuo indirizzo e-mail."],
  "Bestätige zuerst deine Mobilnummer. Das dauert eine Minute und schützt alle vor Mehrfachkonten.": ["Confirme d’abord ton numéro de mobile. Cela prend une minute et protège tout le monde contre les comptes multiples.", "Conferma prima il tuo numero di cellulare. Ci vuole un minuto e protegge tutti dai conti multipli."],
  "Leihen und Tauschen sind wegen eines offenen Falls gesperrt. Sobald der Fall gelöst ist, geht es wieder.": ["Les prêts et échanges sont bloqués à cause d’un litige ouvert. Dès qu’il est résolu, ce sera de nouveau possible.", "Prestiti e scambi sono bloccati a causa di un caso aperto. Appena il caso è risolto, sarà di nuovo possibile."],
  "Du hast ein Buch, das seit über 7 Tagen überfällig ist. Nach der Rückgabe kannst du wieder anfragen.": ["Tu as un livre en retard depuis plus de 7 jours. Après le retour, tu pourras de nouveau faire des demandes.", "Hai un libro in ritardo da oltre 7 giorni. Dopo la restituzione potrai di nuovo fare richieste."],

  // Kreise, Chat, Push, Uploads
  "Diesen Kreis gibt es nicht, oder du bist kein Mitglied.": ["Ce cercle n’existe pas, ou tu n’en es pas membre.", "Questa cerchia non esiste, oppure non ne fai parte."],
  "Dieser Einladungslink ist ungültig oder wurde erneuert.": ["Ce lien d’invitation est invalide ou a été renouvelé.", "Questo link d’invito non è valido o è stato rinnovato."],
  "Nur Admins des Kreises können das ändern.": ["Seuls les admins du cercle peuvent modifier cela.", "Solo gli admin della cerchia possono modificarlo."],
  "Du bist die einzige Admin-Person. Mach zuerst jemand anderen zum Admin, dann kannst du austreten.": ["Tu es la seule personne admin. Nomme d’abord quelqu’un d’autre admin, ensuite tu pourras quitter le cercle.", "Sei l’unica persona admin. Nomina prima qualcun altro admin, poi potrai uscire."],
  "Die Nachricht ist leer.": ["Le message est vide.", "Il messaggio è vuoto."],
  "Der Termin liegt in der Vergangenheit.": ["Ce rendez-vous est dans le passé.", "L’appuntamento è nel passato."],
  "Dieser Chat ist geschlossen.": ["Ce chat est fermé.", "Questa chat è chiusa."],
  "Zwischen euch besteht eine Blockierung. Nachrichten sind nicht möglich.": ["Un blocage existe entre vous. Les messages ne sont pas possibles.", "Tra voi esiste un blocco. I messaggi non sono possibili."],
  "Dieser Vorschlag ist nicht mehr offen.": ["Cette proposition n’est plus ouverte.", "Questa proposta non è più aperta."],
  "Ungültiger Push-Endpunkt.": ["Point de terminaison push invalide.", "Endpoint push non valido."],
  "Fotos sind gerade nicht möglich. Versuche es später erneut.": ["Les photos ne sont pas possibles pour le moment. Réessaie plus tard.", "Le foto al momento non sono possibili. Riprova più tardi."],
  "Die Datei ist zu gross oder leer.": ["Le fichier est trop volumineux ou vide.", "Il file è troppo grande o vuoto."],
  "Unbekanntes Ziel.": ["Destination inconnue.", "Destinazione sconosciuta."],

  // Moderation
  "Personen mit gleicher oder höherer Rolle kannst du nicht moderieren.": ["Tu ne peux pas modérer des personnes ayant un rôle égal ou supérieur.", "Non puoi moderare persone con un ruolo uguale o superiore."],
  "Rollen vergeben nur Admins.": ["Seuls les admins attribuent des rôles.", "Solo gli admin assegnano i ruoli."],
  "Die eigene Rolle kannst du nicht ändern.": ["Tu ne peux pas modifier ton propre rôle.", "Non puoi modificare il tuo ruolo."],
  "Admins lassen sich hier nicht ändern.": ["Les admins ne peuvent pas être modifiés ici.", "Gli admin non si possono modificare qui."],
  "Gesperrte Konten können nicht moderieren.": ["Les comptes bloqués ne peuvent pas modérer.", "I conti bloccati non possono moderare."],
  "Regionen und Funktionen schalten nur Admins.": ["Seuls les admins activent les régions et les fonctions.", "Solo gli admin attivano regioni e funzioni."],

  // Regal und Exemplare
  "Diese Ausgabe gibt es nicht.": ["Cette édition n’existe pas.", "Questa edizione non esiste."],
  "Dieses Buch ist nicht in deinem Regal.": ["Ce livre n’est pas sur ton étagère.", "Questo libro non è nel tuo scaffale."],
  "Geschenkte Bücher kannst du frühestens 30 Tage nach Erhalt weiterverschenken oder tauschen.": ["Tu peux redonner ou échanger un livre reçu en cadeau au plus tôt 30 jours après l’avoir reçu.", "Puoi regalare di nuovo o scambiare un libro ricevuto in regalo solo 30 giorni dopo averlo ricevuto."],
  "Dieses Buch ist gerade verliehen oder gebucht. Entfernen geht nach Abschluss der Vorgänge.": ["Ce livre est actuellement prêté ou réservé. Tu pourras le retirer une fois les transactions terminées.", "Questo libro è attualmente in prestito o prenotato. Potrai rimuoverlo quando le pratiche saranno concluse."],
  "Das Foto ist noch nicht hochgeladen.": ["La photo n’est pas encore téléversée.", "La foto non è ancora caricata."],
  "Du kannst höchstens drei Übergabeorte festlegen. Entferne zuerst einen.": ["Tu peux définir au maximum trois lieux de remise. Supprimes-en d’abord un.", "Puoi definire al massimo tre luoghi di consegna. Rimuovine prima uno."],
  "Das Ende muss nach dem Beginn liegen.": ["La fin doit être après le début.", "La fine deve essere dopo l’inizio."],
  "Diese ISBN ist ungültig. Prüfe die Ziffern unter dem Strichcode.": ["Cet ISBN est invalide. Vérifie les chiffres sous le code-barres.", "Questo ISBN non è valido. Controlla le cifre sotto il codice a barre."],
  "Diese ISBN ist ungültig.": ["Cet ISBN est invalide.", "Questo ISBN non è valido."],

  // Übergabe-Codes
  "Für diesen Schritt zeigt die andere Person den Code.": ["Pour cette étape, c’est l’autre personne qui montre le code.", "Per questo passo il codice lo mostra l’altra persona."],
  "Dieser Code ist unbekannt. Bitte die andere Person, den Code neu zu öffnen.": ["Ce code est inconnu. Demande à l’autre personne de rouvrir le code.", "Questo codice è sconosciuto. Chiedi all’altra persona di riaprire il codice."],
  "Es ist gerade kein Code offen. Bitte die andere Person, den Code anzuzeigen.": ["Aucun code n’est ouvert pour le moment. Demande à l’autre personne d’afficher le code.", "Al momento nessun codice è aperto. Chiedi all’altra persona di mostrare il codice."],
  "Die Ziffern stimmen nicht. Prüfe sie und versuche es erneut.": ["Les chiffres sont incorrects. Vérifie-les et réessaie.", "Le cifre non sono corrette. Controllale e riprova."],
  "Dieser Code wurde bereits verwendet.": ["Ce code a déjà été utilisé.", "Questo codice è già stato usato."],
  "Dieser Code ist abgelaufen. Bitte die andere Person, ihn neu zu öffnen.": ["Ce code a expiré. Demande à l’autre personne de le rouvrir.", "Questo codice è scaduto. Chiedi all’altra persona di riaprirlo."],
  "Diesen Code muss die andere beteiligte Person scannen.": ["Ce code doit être scanné par l’autre personne concernée.", "Questo codice deve essere scansionato dall’altra persona coinvolta."],

  // Vorgänge
  "Diesen Vorgang gibt es nicht.": ["Cette transaction n’existe pas.", "Questa pratica non esiste."],
  "Die Übergabe ist frühestens 3 Tage vor dem geplanten Beginn möglich.": ["La remise est possible au plus tôt 3 jours avant le début prévu.", "La consegna è possibile al più presto 3 giorni prima dell’inizio previsto."],
  "Das Buch ist bis zum geplanten Beginn noch gebucht.": ["Le livre est encore réservé jusqu’au début prévu.", "Il libro è ancora prenotato fino all’inizio previsto."],
  "Die Übergabe ist bereits gemeldet.": ["La remise est déjà signalée.", "La consegna è già stata segnalata."],
  "Für dieses Buch ist keine Ablage erlaubt.": ["Le dépôt n’est pas autorisé pour ce livre.", "Per questo libro il deposito non è consentito."],
  "Es gibt keine Meldung der anderen Seite zu bestätigen.": ["Il n’y a aucune déclaration de l’autre partie à confirmer.", "Non c’è nessuna segnalazione dell’altra parte da confermare."],
  "Es gibt keine Meldung der anderen Seite.": ["Il n’y a aucune déclaration de l’autre partie.", "Non c’è nessuna segnalazione dell’altra parte."],
  "Das Buch wurde zurückgerufen. Eine Verlängerung ist nicht mehr möglich.": ["Le livre a été rappelé. Une prolongation n’est plus possible.", "Il libro è stato richiamato. Una proroga non è più possibile."],
  "Die Leihfrist ist abgelaufen. Bring das Buch zurück oder sprich dich im Chat ab.": ["La durée du prêt est écoulée. Rapporte le livre ou mets-toi d’accord dans le chat.", "La durata del prestito è scaduta. Riporta il libro o accordati nella chat."],
  "Für diese Leihe sind keine weiteren Verlängerungen möglich.": ["Aucune autre prolongation n’est possible pour ce prêt.", "Per questo prestito non sono possibili altre proroghe."],
  "Direkt danach ist das Buch gebucht. Eine Verlängerung ist nicht möglich.": ["Le livre est réservé juste après. Une prolongation n’est pas possible.", "Subito dopo il libro è prenotato. Una proroga non è possibile."],
  "Du hast die Verlängerung bereits angefragt.": ["Tu as déjà demandé la prolongation.", "Hai già chiesto la proroga."],
  "Es liegt keine Anfrage für eine Verlängerung vor.": ["Il n’y a aucune demande de prolongation.", "Non c’è nessuna richiesta di proroga."],
  "Du hast das Buch zurückgerufen. Eine Verlängerung passt nicht dazu.": ["Tu as rappelé le livre. Une prolongation n’est pas compatible.", "Hai richiamato il libro. Una proroga non è compatibile."],
  "Direkt danach ist das Buch gebucht.": ["Le livre est réservé juste après.", "Subito dopo il libro è prenotato."],
  "Ein Rückruf ist frühestens nach 14 Tagen Leihdauer möglich.": ["Un rappel est possible au plus tôt après 14 jours de prêt.", "Un richiamo è possibile solo dopo 14 giorni di prestito."],
  "Dieses Buch ist nicht mehr verfügbar.": ["Ce livre n’est plus disponible.", "Questo libro non è più disponibile."],
  "Das ist dein eigenes Buch.": ["C’est ton propre livre.", "È un tuo libro."],
  "Das ist ein Beispielbuch aus dem Demo-Bestand. Anfragen sind hier nicht möglich. Such dir ein Buch eines echten Mitglieds.": ["C’est un livre d’exemple de la démo. Les demandes ne sont pas possibles ici. Choisis le livre d’un vrai membre.", "È un libro di esempio della demo. Qui le richieste non sono possibili. Scegli un libro di un membro reale."],
  "Dieses Regal ist gerade pausiert. Anfragen sind später wieder möglich.": ["Cette étagère est en pause. Les demandes seront de nouveau possibles plus tard.", "Questo scaffale è in pausa. Le richieste saranno di nuovo possibili più tardi."],
  "Dieses Buch wird so nicht angeboten.": ["Ce livre n’est pas proposé de cette manière.", "Questo libro non è offerto in questo modo."],
  "Dieses Buch wurde kürzlich verschenkt und kann noch nicht weitergegeben werden.": ["Ce livre a été donné récemment et ne peut pas encore être transmis.", "Questo libro è stato regalato di recente e non può ancora essere passato ad altri."],
  "Der Beginn liegt in der Vergangenheit.": ["Le début est dans le passé.", "L’inizio è nel passato."],
  "Für dieses Buch sind schon alle möglichen Termine gebucht. Versuche es nach der nächsten Rückgabe.": ["Toutes les dates possibles sont déjà réservées pour ce livre. Réessaie après le prochain retour.", "Per questo libro tutte le date possibili sono già prenotate. Riprova dopo la prossima restituzione."],
  "Biete 1 bis 5 deiner Bücher zum Tausch an.": ["Propose 1 à 5 de tes livres à l’échange.", "Offri da 1 a 5 dei tuoi libri per lo scambio."],
  "Biete nur eigene Bücher an, die zum Tausch stehen.": ["Ne propose que tes propres livres disponibles à l’échange.", "Offri solo libri tuoi disponibili per lo scambio."],
  "Wähle einen deiner Übergabeorte.": ["Choisis l’un de tes lieux de remise.", "Scegli uno dei tuoi luoghi di consegna."],
  "Dieses Buch ist nicht mehr in deinem Regal. Die Anfrage lässt sich nicht annehmen.": ["Ce livre n’est plus sur ton étagère. La demande ne peut pas être acceptée.", "Questo libro non è più nel tuo scaffale. La richiesta non può essere accettata."],
  "Wähle eines der angebotenen Bücher.": ["Choisis l’un des livres proposés.", "Scegli uno dei libri offerti."],
  "Dieses Tauschbuch ist nicht mehr verfügbar. Wähle ein anderes.": ["Ce livre d’échange n’est plus disponible. Choisis-en un autre.", "Questo libro di scambio non è più disponibile. Scegline un altro."],
  "Für dieses Buch sind schon alle möglichen Termine gebucht.": ["Toutes les dates possibles sont déjà réservées pour ce livre.", "Per questo libro tutte le date possibili sono già prenotate."],
  "Der Zeitraum ist inzwischen belegt. Lehne die Anfrage ab oder bitte um einen anderen Zeitraum.": ["La période est désormais occupée. Refuse la demande ou demande une autre période.", "Il periodo nel frattempo è occupato. Rifiuta la richiesta o chiedi un altro periodo."],
  "Für diesen Vorgang steht keine Weitergabe an.": ["Aucune transmission n’est prévue pour cette transaction.", "Per questa pratica non è previsto alcun passaggio."],
  "Wähle einen Tag vor dem bisherigen Beginn.": ["Choisis un jour avant le début prévu jusqu’ici.", "Scegli un giorno prima dell’inizio previsto finora."],
  "Dieser Tag ist nicht mehr frei.": ["Ce jour n’est plus libre.", "Questo giorno non è più libero."],
  "Wähle einen gültigen Zeitraum.": ["Choisis une période valide.", "Scegli un periodo valido."],
  "Dieser Zeitraum ist nicht frei.": ["Cette période n’est pas libre.", "Questo periodo non è libero."],
  "Ein Buch dieses Tauschs gehört inzwischen jemand anderem. Der Vorgang lässt sich so nicht abschliessen.": ["Un livre de cet échange appartient désormais à quelqu’un d’autre. La transaction ne peut pas être terminée ainsi.", "Un libro di questo scambio nel frattempo appartiene a un’altra persona. La pratica non può essere conclusa così."],
  "Diese Fotos gehören nicht zu diesem Vorgang.": ["Ces photos n’appartiennent pas à cette transaction.", "Queste foto non appartengono a questa pratica."],
  "Lade die Fotos neu hoch und versuche es nochmals.": ["Téléverse à nouveau les photos et réessaie.", "Carica di nuovo le foto e riprova."],

  // Fälle, Tausch, Bewertung
  "Einen Fall kannst du ab 7 Tagen Verzug eröffnen, oder ab 3 Tagen, wenn jemand auf das Buch wartet.": ["Tu peux ouvrir un litige à partir de 7 jours de retard, ou dès 3 jours si quelqu’un attend le livre.", "Puoi aprire un caso dopo 7 giorni di ritardo, oppure dopo 3 giorni se qualcuno aspetta il libro."],
  "Diesen offenen Fall gibt es nicht.": ["Ce litige ouvert n’existe pas.", "Questo caso aperto non esiste."],
  "Diese Antwort passt nicht zu diesem Fall.": ["Cette réponse ne correspond pas à ce litige.", "Questa risposta non corrisponde a questo caso."],
  "Wähle eines deiner Bücher.": ["Choisis l’un de tes livres.", "Scegli uno dei tuoi libri."],
  "Dieser Fall ist bereits geschlossen.": ["Ce litige est déjà clos.", "Questo caso è già chiuso."],
  "Diesen Fall gibt es nicht.": ["Ce litige n’existe pas.", "Questo caso non esiste."],
  "Wähle eines deiner Bücher, das gerade nicht verliehen oder gebucht ist.": ["Choisis l’un de tes livres qui n’est ni prêté ni réservé en ce moment.", "Scegli uno dei tuoi libri che al momento non è in prestito né prenotato."],
  "Es liegt kein Tauschangebot vor.": ["Il n’y a aucune offre d’échange.", "Non c’è nessuna offerta di scambio."],
  "Du hast diesen Vorgang bereits bewertet.": ["Tu as déjà évalué cette transaction.", "Hai già valutato questa pratica."],
  "Für diesen Vorgang ist keine Bewertung mehr möglich.": ["Il n’est plus possible d’évaluer cette transaction.", "Per questa pratica non è più possibile una valutazione."],
  "Der gebuchte Zeitraum ist vorbei und das Buch ist danach schon gebucht. Storniere den Vorgang und frag für einen neuen Zeitraum an.": ["La période réservée est passée et le livre est déjà réservé ensuite. Annule la transaction et fais une demande pour une nouvelle période.", "Il periodo prenotato è passato e il libro è già prenotato subito dopo. Annulla la pratica e richiedi un nuovo periodo."],
  "Möglich sind Mobilnummern aus der Schweiz und Liechtenstein.": ["Seuls les numéros de mobile de Suisse et du Liechtenstein sont possibles.", "Sono possibili solo numeri di cellulare svizzeri e del Liechtenstein."],
  "Das angebotene Buch ist inzwischen verliehen oder gebucht. Der Tausch ist so nicht mehr möglich.": ["Le livre proposé est entre-temps prêté ou réservé. L’échange n’est plus possible ainsi.", "Il libro offerto nel frattempo è in prestito o prenotato. Lo scambio così non è più possibile."],
};

type Pattern = { re: RegExp; fr: (m: RegExpMatchArray) => string; it: (m: RegExpMatchArray) => string };

/** Meldungen mit eingesetzten Werten (Zahlen, Namen) */
export const ERROR_PATTERNS: Pattern[] = [
  {
    re: /^Du hast (\d+) offene Anfragen, das ist deine Grenze\. Warte auf Antworten oder ziehe eine Anfrage zurück\.$/,
    fr: (m) => `Tu as ${m[1]} demandes ouvertes, c’est ta limite. Attends les réponses ou retire une demande.`,
    it: (m) => `Hai ${m[1]} richieste aperte, è il tuo limite. Aspetta le risposte o ritira una richiesta.`,
  },
  {
    re: /^Du hast (\d+) Leihen bei anderen Mitgliedern laufen oder gebucht\. Mit deiner Stufe sind (\d+) gleichzeitig möglich\. Leihen in Kreisen zählen nicht dazu\.$/,
    fr: (m) => `Tu as ${m[1]} prêts en cours ou réservés chez d’autres membres. Avec ton niveau, ${m[2]} sont possibles en même temps. Les prêts dans les cercles ne comptent pas.`,
    it: (m) => `Hai ${m[1]} prestiti in corso o prenotati presso altri membri. Con il tuo livello ne sono possibili ${m[2]} alla volta. I prestiti nelle cerchie non contano.`,
  },
  {
    re: /^(.+) hat gerade schon (\d+) Leihen laufen oder gebucht, mehr sind mit der aktuellen Stufe nicht möglich\. Die Anfrage kann erst später angenommen werden\.$/,
    fr: (m) => `${m[1]} a déjà ${m[2]} prêts en cours ou réservés, son niveau actuel n’en permet pas davantage. La demande ne pourra être acceptée que plus tard.`,
    it: (m) => `${m[1]} ha già ${m[2]} prestiti in corso o prenotati, con il livello attuale non ne sono possibili altri. La richiesta potrà essere accettata solo più tardi.`,
  },
  {
    re: /^Du hast noch einen offenen Vorgang\. Schliesse ihn ab, dann kannst du dein Konto löschen\.$/,
    fr: () => "Tu as encore une transaction ouverte. Termine-la, ensuite tu pourras supprimer ton compte.",
    it: () => "Hai ancora una pratica aperta. Concludila, poi potrai eliminare il tuo conto.",
  },
  {
    re: /^Du hast noch (\d+) offene Vorgänge\. Schliesse sie ab, dann kannst du dein Konto löschen\.$/,
    fr: (m) => `Tu as encore ${m[1]} transactions ouvertes. Termine-les, ensuite tu pourras supprimer ton compte.`,
    it: (m) => `Hai ancora ${m[1]} pratiche aperte. Concludile, poi potrai eliminare il tuo conto.`,
  },
  {
    re: /^Du kannst bis zu (\d+) Titelalarme setzen\.$/,
    fr: (m) => `Tu peux définir jusqu’à ${m[1]} alertes de titres.`,
    it: (m) => `Puoi impostare fino a ${m[1]} avvisi di titoli.`,
  },
  {
    re: /^Dieses Buch lässt sich höchstens (\d+) Tage im Voraus buchen\.$/,
    fr: (m) => `Ce livre peut être réservé au maximum ${m[1]} jours à l’avance.`,
    it: (m) => `Questo libro si può prenotare al massimo ${m[1]} giorni in anticipo.`,
  },
  {
    re: /^Die Leihfrist für dieses Buch beträgt höchstens (\d+) Tage\.$/,
    fr: (m) => `La durée de prêt de ce livre est de ${m[1]} jours au maximum.`,
    it: (m) => `La durata del prestito di questo libro è al massimo di ${m[1]} giorni.`,
  },
  {
    re: /^Die Leihfrist beträgt höchstens (\d+) Tage\.$/,
    fr: (m) => `La durée de prêt est de ${m[1]} jours au maximum.`,
    it: (m) => `La durata del prestito è al massimo di ${m[1]} giorni.`,
  },
];

/** Übersetzt eine deutsche Server-Meldung; Unbekanntes bleibt deutsch */
export function translateError(msg: string, l: Locale): string {
  if (l === "de" || !msg) return msg;
  const i = l === "fr" ? 0 : 1;
  const hit = ERRORS[msg];
  if (hit) return hit[i];
  for (const p of ERROR_PATTERNS) {
    const m = msg.match(p.re);
    if (m) return l === "fr" ? p.fr(m) : p.it(m);
  }
  return msg;
}
