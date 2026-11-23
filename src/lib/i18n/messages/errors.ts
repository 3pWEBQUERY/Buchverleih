/**
 * Fehlermeldungen des Servers in vier Sprachen. Der Code wirft weiterhin deutsche Meldungen;
 * die API übersetzt sie beim Antworten (src/lib/api.ts). Schlüssel ist der deutsche Text, genau so,
 * wie er im Code steht. Meldungen mit Zahlen oder Namen stehen in ERROR_PATTERNS.
 * Unbekannte Meldungen bleiben deutsch.
 */
import type { Locale } from "../locale";

type FrItEn = [fr: string, it: string, en: string];

export const ERRORS: Record<string, FrItEn> = {
  // Allgemein (errors.ts, api.ts)
  "Der E-Mail-Versand ist noch nicht eingerichtet. Bitte versuche es später erneut.": ["L’envoi d’e-mails n’est pas encore configuré. Réessaie plus tard.", "L’invio di e-mail non è ancora configurato. Riprova più tardi.", "Sending emails isn’t set up yet. Please try again later."],
  "Dieses Gerät ist noch mit einem anderen Konto verbunden. Melde es dort zuerst ab.": ["Cet appareil est encore lié à un autre compte. Déconnecte-le d’abord de ce compte.", "Questo dispositivo è ancora collegato a un altro conto. Esci prima da quel conto.", "This device is still linked to another account. Sign out of that account first."],
  "Bitte melde dich an.": ["Connecte-toi, s’il te plaît.", "Accedi, per favore.", "Please sign in."],
  "Dafür fehlt dir die Berechtigung.": ["Tu n’as pas l’autorisation pour cela.", "Non hai l’autorizzazione per farlo.", "You don’t have permission to do that."],
  "Nicht gefunden.": ["Introuvable.", "Non trovato.", "Not found."],
  "Zu viele Versuche. Warte einen Moment und versuche es erneut.": ["Trop de tentatives. Attends un instant et réessaie.", "Troppi tentativi. Aspetta un momento e riprova.", "Too many attempts. Wait a moment and try again."],
  "Dieser Schritt ist nicht mehr möglich. Lade die Seite neu, um den aktuellen Stand zu sehen.": ["Cette étape n’est plus possible. Recharge la page pour voir l’état actuel.", "Questo passo non è più possibile. Ricarica la pagina per vedere lo stato attuale.", "This step is no longer possible. Reload the page to see the latest state."],
  "Diese Anfrage kommt nicht von Leihregal.": ["Cette requête ne provient pas de Leihregal.", "Questa richiesta non proviene da Leihregal.", "This request doesn’t come from Leihregal."],
  "Die Anfrage ist zu gross.": ["La requête est trop volumineuse.", "La richiesta è troppo grande.", "The request is too large."],
  "Die Anfrage konnte nicht gelesen werden.": ["La requête n’a pas pu être lue.", "Non è stato possibile leggere la richiesta.", "The request couldn’t be read."],
  "Dieser Zeitraum ist im Verleihkalender bereits belegt. Wähle einen freien Zeitraum.": ["Cette période est déjà occupée dans le calendrier des prêts. Choisis une période libre.", "Questo periodo è già occupato nel calendario dei prestiti. Scegli un periodo libero.", "These dates are already taken in the lending calendar. Choose free dates."],
  "Das gibt es bereits. Lade die Seite neu, um den aktuellen Stand zu sehen.": ["Cela existe déjà. Recharge la page pour voir l’état actuel.", "Esiste già. Ricarica la pagina per vedere lo stato attuale.", "That already exists. Reload the page to see the latest state."],
  "Dieses Datum gibt es nicht. Prüfe die Eingabe.": ["Cette date n’existe pas. Vérifie la saisie.", "Questa data non esiste. Controlla l’inserimento.", "This date doesn’t exist. Check what you entered."],
  "Dieser Schritt verletzt eine Regel des Vorgangs. Lade die Seite neu.": ["Cette étape enfreint une règle de la transaction. Recharge la page.", "Questo passo viola una regola della pratica. Ricarica la pagina.", "This step breaks a rule of the loan. Reload the page."],
  "Etwas ist schiefgelaufen. Versuche es in einem Moment erneut.": ["Quelque chose s’est mal passé. Réessaie dans un instant.", "Qualcosa è andato storto. Riprova tra un momento.", "Something went wrong. Try again in a moment."],
  "Ungültige Eingabe.": ["Saisie invalide.", "Inserimento non valido.", "Invalid input."],
  // Eigene Meldungen in Eingabeprüfungen
  "ungültige ID": ["ID invalide", "ID non valido", "invalid ID"],
  "Datum im Format JJJJ-MM-TT": ["Date au format AAAA-MM-JJ", "Data nel formato AAAA-MM-GG", "Date in the format YYYY-MM-DD"],
  "Dieses Datum gibt es nicht": ["Cette date n’existe pas", "Questa data non esiste", "This date doesn’t exist"],
  "Nur Fotos (JPEG, PNG, WebP, HEIC)": ["Seulement des photos (JPEG, PNG, WebP, HEIC)", "Solo foto (JPEG, PNG, WebP, HEIC)", "Photos only (JPEG, PNG, WebP, HEIC)"],

  // Anmeldung, Konto, Telefon
  "Einmal-Passwörter vergeben nur Admins.": ["Seuls les admins créent des mots de passe à usage unique.", "Solo gli admin creano password monouso.", "Only admins can issue one-time passwords."],
  "Das Passwort braucht mindestens 8 Zeichen.": ["Le mot de passe doit comporter au moins 8 caractères.", "La password deve avere almeno 8 caratteri.", "The password needs at least 8 characters."],
  "Das Passwort ist zu lang.": ["Le mot de passe est trop long.", "La password è troppo lunga.", "The password is too long."],
  "Zu dieser E-Mail-Adresse gibt es schon ein Konto. Melde dich an.": ["Un compte existe déjà pour cette adresse e-mail. Connecte-toi.", "Esiste già un conto per questo indirizzo e-mail. Accedi.", "There’s already an account for this email address. Sign in."],
  "E-Mail-Adresse oder Passwort stimmt nicht.": ["L’adresse e-mail ou le mot de passe est incorrect.", "L’indirizzo e-mail o la password non sono corretti.", "The email address or password isn’t right."],
  "Diese E-Mail-Adresse sieht unvollständig aus.": ["Cette adresse e-mail semble incomplète.", "Questo indirizzo e-mail sembra incompleto.", "This email address looks incomplete."],
  "Dieser Link ist abgelaufen oder wurde schon verwendet. Fordere einen neuen an.": ["Ce lien a expiré ou a déjà été utilisé. Demandes-en un nouveau.", "Questo link è scaduto o è già stato usato. Richiedine uno nuovo.", "This link has expired or has already been used. Request a new one."],
  "Die Anfrage ist abgelaufen. Versuche es erneut.": ["La demande a expiré. Réessaie.", "La richiesta è scaduta. Riprova.", "The request has expired. Try again."],
  "Der Passkey konnte nicht bestätigt werden.": ["La clé d’accès n’a pas pu être confirmée.", "Non è stato possibile confermare la passkey.", "The passkey couldn’t be confirmed."],
  "Dieser Passkey ist bei Leihregal nicht bekannt. Melde dich per E-Mail-Link an.": ["Cette clé d’accès n’est pas connue de Leihregal. Connecte-toi avec un lien par e-mail.", "Questa passkey non è nota a Leihregal. Accedi con il link via e-mail.", "Leihregal doesn’t know this passkey. Sign in with an email link."],
  "Gib eine Mobilnummer ein, zum Beispiel 079 123 45 67.": ["Saisis un numéro de mobile, par exemple 079 123 45 67.", "Inserisci un numero di cellulare, per esempio 079 123 45 67.", "Enter a mobile number, for example 079 123 45 67."],
  "Diese Nummer kann nicht verwendet werden. Melde dich bei der Moderation, wenn du das für einen Fehler hältst.": ["Ce numéro ne peut pas être utilisé. Contacte la modération si tu penses que c’est une erreur.", "Questo numero non può essere usato. Contatta la moderazione se pensi che sia un errore.", "This number can’t be used. Contact moderation if you think this is a mistake."],
  "Diese Nummer gehört bereits zu einem anderen Konto. Eine Nummer, ein Konto.": ["Ce numéro appartient déjà à un autre compte. Un numéro, un compte.", "Questo numero appartiene già a un altro conto. Un numero, un conto.", "This number already belongs to another account. One number, one account."],
  "Die SMS konnte gerade nicht gesendet werden. Versuch es in ein paar Minuten nochmals.": ["Le SMS n’a pas pu être envoyé pour le moment. Réessaie dans quelques minutes.", "Al momento non è stato possibile inviare l’SMS. Riprova tra qualche minuto.", "The SMS couldn’t be sent just now. Try again in a few minutes."],
  "Das bisherige Passwort stimmt nicht.": ["Le mot de passe actuel est incorrect.", "La password attuale non è corretta.", "The current password is incorrect."],
  "Tauschen und Verschenken ist gerade ausgeschaltet.": ["L’échange et le don sont désactivés pour le moment.", "Scambi e regali sono disattivati al momento.", "Swapping and giving away are switched off right now."],
  "Die direkte Weitergabe ist gerade ausgeschaltet.": ["La transmission directe est désactivée pour le moment.", "Il passaggio diretto è disattivato al momento.", "Direct pass-on is switched off right now."],
  "Die Wunschliste ist gerade ausgeschaltet.": ["La liste d’envies est désactivée pour le moment.", "La lista dei desideri è disattivata al momento.", "The wishlist is switched off right now."],
  "Die Karte ist gerade ausgeschaltet.": ["La carte est désactivée pour le moment.", "La mappa è disattivata al momento.", "The map is switched off right now."],
  "Versand ist gerade ausgeschaltet.": ["L’envoi est désactivé pour le moment.", "La spedizione è disattivata al momento.", "Shipping is switched off right now."],
  "Die Datei enthält keine Bücher.": ["Le fichier ne contient aucun livre.", "Il file non contiene libri.", "The file doesn’t contain any books."],
  "Diese Datei kennen wir nicht. Lade den CSV-Export aus Goodreads oder StoryGraph hoch.": ["Nous ne reconnaissons pas ce fichier. Charge l’export CSV de Goodreads ou StoryGraph.", "Non riconosciamo questo file. Carica l’esportazione CSV di Goodreads o StoryGraph.", "We don’t recognise this file. Upload the CSV export from Goodreads or StoryGraph."],
  "Bücher für die Kreisbibliothek erfassen nur Admins des Kreises.": ["Seuls les admins du cercle ajoutent des livres à la bibliothèque du cercle.", "Solo gli admin della cerchia aggiungono libri alla biblioteca della cerchia.", "Only the circle’s admins can add books to the circle library."],
  "Das geht erst, wenn keine Anfrage und keine Leihe zu diesem Buch läuft.": ["Ce n’est possible que lorsqu’aucune demande ni aucun prêt n’est en cours pour ce livre.", "È possibile solo quando non ci sono richieste né prestiti in corso per questo libro.", "That’s only possible when there’s no open request or loan for this book."],
  "Bei einer Weitergabe gehört ein Foto zur Zustandsnotiz.": ["Pour une transmission, une photo fait partie de la note d’état.", "In un passaggio diretto la nota sullo stato richiede una foto.", "For a pass-on, the condition note needs a photo."],
  "Dieses Gebiet gibt es nicht.": ["Ce territoire n’existe pas.", "Questo territorio non esiste.", "This area does not exist."],
  "Der Code ist abgelaufen. Fordere einen neuen an.": ["Le code a expiré. Demandes-en un nouveau.", "Il codice è scaduto. Richiedine uno nuovo.", "The code has expired. Request a new one."],
  "Zu viele Versuche. Fordere einen neuen Code an.": ["Trop de tentatives. Demande un nouveau code.", "Troppi tentativi. Richiedi un nuovo codice.", "Too many attempts. Request a new code."],
  "Der Code stimmt nicht. Prüfe die sechs Ziffern aus der SMS.": ["Le code est incorrect. Vérifie les six chiffres du SMS.", "Il codice non è corretto. Controlla le sei cifre dell’SMS.", "The code isn’t right. Check the six digits from the SMS."],
  "Dein Konto ist gesperrt. Antworte auf die E-Mail der Moderation, um das zu klären.": ["Ton compte est bloqué. Réponds à l’e-mail de la modération pour clarifier la situation.", "Il tuo conto è bloccato. Rispondi all’e-mail della moderazione per chiarire.", "Your account is blocked. Reply to the email from moderation to sort this out."],
  "Schliesse zuerst die Anmeldung ab.": ["Termine d’abord l’inscription.", "Completa prima la registrazione.", "Finish signing up first."],
  "Gib deinen Vornamen ein.": ["Saisis ton prénom.", "Inserisci il tuo nome.", "Enter your first name."],
  "Gib dein Geburtsdatum ein.": ["Saisis ta date de naissance.", "Inserisci la tua data di nascita.", "Enter your date of birth."],
  "Für ein eigenes Konto brauchst du mindestens 16 Jahre. Kinderbücher leihen deine Eltern.": ["Il faut avoir au moins 16 ans pour avoir son propre compte. Les livres pour enfants, ce sont tes parents qui les empruntent.", "Per avere un conto tuo devi avere almeno 16 anni. I libri per bambini li prendono in prestito i tuoi genitori.", "You need to be at least 16 to have your own account. Your parents can borrow children’s books."],
  "Leihregal ist in deiner Gemeinde noch nicht offen. Wir haben dich auf die Warteliste gesetzt und schreiben dir, sobald es losgeht.": ["Leihregal n’est pas encore ouvert dans ta commune. Nous t’avons inscrit·e sur la liste d’attente et t’écrirons dès le lancement.", "Leihregal non è ancora aperto nel tuo comune. Ti abbiamo messo in lista d’attesa e ti scriveremo appena si parte.", "Leihregal is not open in your municipality yet. We have put you on the waiting list and will write to you as soon as it opens."],
  "Leihregal ist in dieser Gemeinde noch nicht offen. Wir haben dich auf die Warteliste gesetzt und schreiben dir, sobald es losgeht.": ["Leihregal n’est pas encore ouvert dans cette commune. Nous t’avons inscrit·e sur la liste d’attente et t’écrirons dès le lancement.", "Leihregal non è ancora aperto in questo comune. Ti abbiamo messo in lista d’attesa e ti scriveremo appena si parte.", "Leihregal is not open in this municipality yet. We have put you on the waiting list and will write to you as soon as it opens."],
  "Diese Postleitzahl kennen wir nicht. Prüfe die vier Ziffern.": ["Nous ne connaissons pas ce NPA. Vérifie les quatre chiffres.", "Non conosciamo questo NPA. Controlla le quattro cifre.", "We don’t know this postcode. Check the four digits."],
  "Leihregal ist in deiner Region noch nicht offen. Trag dich auf die Warteliste ein, wir melden uns.": ["Leihregal n’est pas encore ouvert dans ta région. Inscris-toi sur la liste d’attente, nous te contacterons.", "Leihregal non è ancora aperto nella tua regione. Iscriviti alla lista d’attesa, ti contatteremo.", "Leihregal isn’t open in your region yet. Join the waiting list and we’ll be in touch."],
  "Leihregal ist in dieser Region noch nicht offen. Trag dich auf die Warteliste ein, wir melden uns.": ["Leihregal n’est pas encore ouvert dans cette région. Inscris-toi sur la liste d’attente, nous te contacterons.", "Leihregal non è ancora aperto in questa regione. Iscriviti alla lista d’attesa, ti contatteremo.", "Leihregal isn’t open in this region yet. Join the waiting list and we’ll be in touch."],
  "Gib eine vierstellige Postleitzahl ein.": ["Saisis un numéro postal à quatre chiffres.", "Inserisci un numero postale di quattro cifre.", "Enter a four-digit postcode."],
  "Dieses Bild können wir nicht verwenden. Lade es erneut hoch.": ["Nous ne pouvons pas utiliser cette image. Téléverse-la à nouveau.", "Non possiamo usare questa immagine. Caricala di nuovo.", "We can’t use this image. Upload it again."],
  "Das geht nicht beim eigenen Konto.": ["Ce n’est pas possible avec ton propre compte.", "Non è possibile con il tuo conto.", "You can’t do that with your own account."],

  // Voraussetzungen für Anfragen (trust.ts)
  "Vervollständige zuerst dein Profil.": ["Complète d’abord ton profil.", "Completa prima il tuo profilo.", "Complete your profile first."],
  "Bestätige zuerst deine E-Mail-Adresse.": ["Confirme d’abord ton adresse e-mail.", "Conferma prima il tuo indirizzo e-mail.", "Confirm your email address first."],
  "Bestätige zuerst deine Mobilnummer. Das dauert eine Minute und schützt alle vor Mehrfachkonten.": ["Confirme d’abord ton numéro de mobile. Cela prend une minute et protège tout le monde contre les comptes multiples.", "Conferma prima il tuo numero di cellulare. Ci vuole un minuto e protegge tutti dai conti multipli.", "Confirm your mobile number first. It takes a minute and protects everyone from multiple accounts."],
  "Leihen und Tauschen sind wegen eines offenen Falls gesperrt. Sobald der Fall gelöst ist, geht es wieder.": ["Les prêts et échanges sont bloqués à cause d’un litige ouvert. Dès qu’il est résolu, ce sera de nouveau possible.", "Prestiti e scambi sono bloccati a causa di un caso aperto. Appena il caso è risolto, sarà di nuovo possibile.", "Lending and swapping are blocked because of an open case. Once the case is resolved, they’re possible again."],
  "Du hast ein Buch, das seit über 7 Tagen überfällig ist. Nach der Rückgabe kannst du wieder anfragen.": ["Tu as un livre en retard depuis plus de 7 jours. Après le retour, tu pourras de nouveau faire des demandes.", "Hai un libro in ritardo da oltre 7 giorni. Dopo la restituzione potrai di nuovo fare richieste.", "You have a book that’s more than 7 days overdue. Once it’s returned, you can make requests again."],

  // Kreise, Chat, Push, Uploads
  "Diesen Kreis gibt es nicht, oder du bist kein Mitglied.": ["Ce cercle n’existe pas, ou tu n’en es pas membre.", "Questa cerchia non esiste, oppure non ne fai parte.", "This circle doesn’t exist, or you’re not a member."],
  "Dieser Einladungslink ist ungültig oder wurde erneuert.": ["Ce lien d’invitation est invalide ou a été renouvelé.", "Questo link d’invito non è valido o è stato rinnovato.", "This invitation link is invalid or has been renewed."],
  "Nur Admins des Kreises können das ändern.": ["Seuls les admins du cercle peuvent modifier cela.", "Solo gli admin della cerchia possono modificarlo.", "Only the circle’s admins can change this."],
  "Du bist die einzige Admin-Person. Mach zuerst jemand anderen zum Admin, dann kannst du austreten.": ["Tu es la seule personne admin. Nomme d’abord quelqu’un d’autre admin, ensuite tu pourras quitter le cercle.", "Sei l’unica persona admin. Nomina prima qualcun altro admin, poi potrai uscire.", "You’re the only admin. Make someone else an admin first, then you can leave."],
  "Die Nachricht ist leer.": ["Le message est vide.", "Il messaggio è vuoto.", "The message is empty."],
  "Der Termin liegt in der Vergangenheit.": ["Ce rendez-vous est dans le passé.", "L’appuntamento è nel passato.", "This time is in the past."],
  "Dieser Chat ist geschlossen.": ["Ce chat est fermé.", "Questa chat è chiusa.", "This chat is closed."],
  "Gib entweder einen Vorgang oder einen Übergabe-Chat an.": ["Indique soit une transaction, soit un chat de remise.", "Indica una pratica oppure una chat di consegna.", "Give either a loan or a handover chat."],
  "Zwischen euch besteht eine Blockierung. Nachrichten sind nicht möglich.": ["Un blocage existe entre vous. Les messages ne sont pas possibles.", "Tra voi esiste un blocco. I messaggi non sono possibili.", "One of you has blocked the other. Messages aren’t possible."],
  "Dieser Vorschlag ist nicht mehr offen.": ["Cette proposition n’est plus ouverte.", "Questa proposta non è più aperta.", "This suggestion is no longer open."],
  "Ungültiger Push-Endpunkt.": ["Point de terminaison push invalide.", "Endpoint push non valido.", "Invalid push endpoint."],
  "Fotos sind gerade nicht möglich. Versuche es später erneut.": ["Les photos ne sont pas possibles pour le moment. Réessaie plus tard.", "Le foto al momento non sono possibili. Riprova più tardi.", "Photos aren’t possible right now. Try again later."],
  "Die Datei ist zu gross oder leer.": ["Le fichier est trop volumineux ou vide.", "Il file è troppo grande o vuoto.", "The file is too large or empty."],
  "Unbekanntes Ziel.": ["Destination inconnue.", "Destinazione sconosciuta.", "Unknown target."],

  // Moderation
  "Personen mit gleicher oder höherer Rolle kannst du nicht moderieren.": ["Tu ne peux pas modérer des personnes ayant un rôle égal ou supérieur.", "Non puoi moderare persone con un ruolo uguale o superiore.", "You can’t moderate people with the same or a higher role."],
  "Rollen vergeben nur Admins.": ["Seuls les admins attribuent des rôles.", "Solo gli admin assegnano i ruoli.", "Only admins can assign roles."],
  "Die eigene Rolle kannst du nicht ändern.": ["Tu ne peux pas modifier ton propre rôle.", "Non puoi modificare il tuo ruolo.", "You can’t change your own role."],
  "Admins lassen sich hier nicht ändern.": ["Les admins ne peuvent pas être modifiés ici.", "Gli admin non si possono modificare qui.", "Admins can’t be changed here."],
  "Gesperrte Konten können nicht moderieren.": ["Les comptes bloqués ne peuvent pas modérer.", "I conti bloccati non possono moderare.", "Blocked accounts can’t moderate."],
  "Regionen und Funktionen schalten nur Admins.": ["Seuls les admins activent les régions et les fonctions.", "Solo gli admin attivano regioni e funzioni.", "Only admins can switch regions and features on or off."],

  // Regal und Exemplare
  "Diese Ausgabe gibt es nicht.": ["Cette édition n’existe pas.", "Questa edizione non esiste.", "This edition doesn’t exist."],
  "Dieses Buch ist nicht in deinem Regal.": ["Ce livre n’est pas sur ton étagère.", "Questo libro non è nel tuo scaffale.", "This book isn’t on your shelf."],
  "Geschenkte Bücher kannst du frühestens 30 Tage nach Erhalt weiterverschenken oder tauschen.": ["Tu peux redonner ou échanger un livre reçu en cadeau au plus tôt 30 jours après l’avoir reçu.", "Puoi regalare di nuovo o scambiare un libro ricevuto in regalo solo 30 giorni dopo averlo ricevuto.", "You can give away or swap books you received as a gift 30 days after receiving them at the earliest."],
  "Dieses Buch ist gerade verliehen oder gebucht. Entfernen geht nach Abschluss der Vorgänge.": ["Ce livre est actuellement prêté ou réservé. Tu pourras le retirer une fois les transactions terminées.", "Questo libro è attualmente in prestito o prenotato. Potrai rimuoverlo quando le pratiche saranno concluse.", "This book is on loan or booked right now. You can remove it once the loans are complete."],
  "Das Foto ist noch nicht hochgeladen.": ["La photo n’est pas encore téléversée.", "La foto non è ancora caricata.", "The photo hasn’t been uploaded yet."],
  "Du kannst höchstens drei Übergabeorte festlegen. Entferne zuerst einen.": ["Tu peux définir au maximum trois lieux de remise. Supprimes-en d’abord un.", "Puoi definire al massimo tre luoghi di consegna. Rimuovine prima uno.", "You can set up to three handover places. Remove one first."],
  "Das Ende muss nach dem Beginn liegen.": ["La fin doit être après le début.", "La fine deve essere dopo l’inizio.", "The end has to be after the start."],
  "Diese ISBN ist ungültig. Prüfe die Ziffern unter dem Strichcode.": ["Cet ISBN est invalide. Vérifie les chiffres sous le code-barres.", "Questo ISBN non è valido. Controlla le cifre sotto il codice a barre.", "This ISBN is invalid. Check the digits under the barcode."],
  "Diese ISBN ist ungültig.": ["Cet ISBN est invalide.", "Questo ISBN non è valido.", "This ISBN is invalid."],

  // Übergabe-Codes
  "Für diesen Schritt zeigt die andere Person den Code.": ["Pour cette étape, c’est l’autre personne qui montre le code.", "Per questo passo il codice lo mostra l’altra persona.", "For this step, the other person shows the code."],
  "Dieser Code ist unbekannt. Bitte die andere Person, den Code neu zu öffnen.": ["Ce code est inconnu. Demande à l’autre personne de rouvrir le code.", "Questo codice è sconosciuto. Chiedi all’altra persona di riaprire il codice.", "This code is unknown. Ask the other person to open the code again."],
  "Es ist gerade kein Code offen. Bitte die andere Person, den Code anzuzeigen.": ["Aucun code n’est ouvert pour le moment. Demande à l’autre personne d’afficher le code.", "Al momento nessun codice è aperto. Chiedi all’altra persona di mostrare il codice.", "No code is open right now. Ask the other person to show the code."],
  "Die Ziffern stimmen nicht. Prüfe sie und versuche es erneut.": ["Les chiffres sont incorrects. Vérifie-les et réessaie.", "Le cifre non sono corrette. Controllale e riprova.", "The digits aren’t right. Check them and try again."],
  "Dieser Code wurde bereits verwendet.": ["Ce code a déjà été utilisé.", "Questo codice è già stato usato.", "This code has already been used."],
  "Dieser Code ist abgelaufen. Bitte die andere Person, ihn neu zu öffnen.": ["Ce code a expiré. Demande à l’autre personne de le rouvrir.", "Questo codice è scaduto. Chiedi all’altra persona di riaprirlo.", "This code has expired. Ask the other person to open it again."],
  "Diesen Code muss die andere beteiligte Person scannen.": ["Ce code doit être scanné par l’autre personne concernée.", "Questo codice deve essere scansionato dall’altra persona coinvolta.", "The other person involved has to scan this code."],

  // Vorgänge
  "Diesen Vorgang gibt es nicht.": ["Cette transaction n’existe pas.", "Questa pratica non esiste.", "This loan doesn’t exist."],
  "Die Übergabe ist frühestens 3 Tage vor dem geplanten Beginn möglich.": ["La remise est possible au plus tôt 3 jours avant le début prévu.", "La consegna è possibile al più presto 3 giorni prima dell’inizio previsto.", "The handover is possible 3 days before the planned start at the earliest."],
  "Das Buch ist bis zum geplanten Beginn noch gebucht.": ["Le livre est encore réservé jusqu’au début prévu.", "Il libro è ancora prenotato fino all’inizio previsto.", "The book is still booked until the planned start."],
  "Die Übergabe ist bereits gemeldet.": ["La remise est déjà signalée.", "La consegna è già stata segnalata.", "The handover has already been reported."],
  "Für dieses Buch ist keine Ablage erlaubt.": ["Le dépôt n’est pas autorisé pour ce livre.", "Per questo libro il deposito non è consentito.", "Drop-offs aren’t allowed for this book."],
  "Es gibt keine Meldung der anderen Seite zu bestätigen.": ["Il n’y a aucune déclaration de l’autre partie à confirmer.", "Non c’è nessuna segnalazione dell’altra parte da confermare.", "There’s no report from the other side to confirm."],
  "Es gibt keine Meldung der anderen Seite.": ["Il n’y a aucune déclaration de l’autre partie.", "Non c’è nessuna segnalazione dell’altra parte.", "There’s no report from the other side."],
  "Das Buch wurde zurückgerufen. Eine Verlängerung ist nicht mehr möglich.": ["Le livre a été rappelé. Une prolongation n’est plus possible.", "Il libro è stato richiamato. Una proroga non è più possibile.", "The book has been recalled. An extension is no longer possible."],
  "Die Leihfrist ist abgelaufen. Bring das Buch zurück oder sprich dich im Chat ab.": ["La durée du prêt est écoulée. Rapporte le livre ou mets-toi d’accord dans le chat.", "La durata del prestito è scaduta. Riporta il libro o accordati nella chat.", "The loan period has ended. Bring the book back or arrange something in the chat."],
  "Für diese Leihe sind keine weiteren Verlängerungen möglich.": ["Aucune autre prolongation n’est possible pour ce prêt.", "Per questo prestito non sono possibili altre proroghe.", "No further extensions are possible for this loan."],
  "Direkt danach ist das Buch gebucht. Eine Verlängerung ist nicht möglich.": ["Le livre est réservé juste après. Une prolongation n’est pas possible.", "Subito dopo il libro è prenotato. Una proroga non è possibile.", "The book is booked straight afterwards. An extension isn’t possible."],
  "Du hast die Verlängerung bereits angefragt.": ["Tu as déjà demandé la prolongation.", "Hai già chiesto la proroga.", "You’ve already requested the extension."],
  "Es liegt keine Anfrage für eine Verlängerung vor.": ["Il n’y a aucune demande de prolongation.", "Non c’è nessuna richiesta di proroga.", "There’s no request for an extension."],
  "Du hast das Buch zurückgerufen. Eine Verlängerung passt nicht dazu.": ["Tu as rappelé le livre. Une prolongation n’est pas compatible.", "Hai richiamato il libro. Una proroga non è compatibile.", "You’ve recalled the book. An extension doesn’t fit with that."],
  "Direkt danach ist das Buch gebucht.": ["Le livre est réservé juste après.", "Subito dopo il libro è prenotato.", "The book is booked straight afterwards."],
  "Ein Rückruf ist frühestens nach 14 Tagen Leihdauer möglich.": ["Un rappel est possible au plus tôt après 14 jours de prêt.", "Un richiamo è possibile solo dopo 14 giorni di prestito.", "A recall is possible after 14 days of the loan at the earliest."],
  "Dieses Buch ist nicht mehr verfügbar.": ["Ce livre n’est plus disponible.", "Questo libro non è più disponibile.", "This book is no longer available."],
  "Das ist dein eigenes Buch.": ["C’est ton propre livre.", "È un tuo libro.", "This is your own book."],
  "Das ist ein Beispielbuch aus dem Demo-Bestand. Anfragen sind hier nicht möglich. Such dir ein Buch eines echten Mitglieds.": ["C’est un livre d’exemple de la démo. Les demandes ne sont pas possibles ici. Choisis le livre d’un vrai membre.", "È un libro di esempio della demo. Qui le richieste non sono possibili. Scegli un libro di un membro reale.", "This is a sample book from the demo collection. Requests aren’t possible here. Choose a book from a real member."],
  "Dieses Regal ist gerade pausiert. Anfragen sind später wieder möglich.": ["Cette étagère est en pause. Les demandes seront de nouveau possibles plus tard.", "Questo scaffale è in pausa. Le richieste saranno di nuovo possibili più tardi.", "This shelf is paused right now. Requests will be possible again later."],
  "Dieses Buch wird so nicht angeboten.": ["Ce livre n’est pas proposé de cette manière.", "Questo libro non è offerto in questo modo.", "This book isn’t offered that way."],
  "Dieses Buch wurde kürzlich verschenkt und kann noch nicht weitergegeben werden.": ["Ce livre a été donné récemment et ne peut pas encore être transmis.", "Questo libro è stato regalato di recente e non può ancora essere passato ad altri.", "This book was given away recently and can’t be passed on yet."],
  "Der Beginn liegt in der Vergangenheit.": ["Le début est dans le passé.", "L’inizio è nel passato.", "The start is in the past."],
  "Für dieses Buch sind schon alle möglichen Termine gebucht. Versuche es nach der nächsten Rückgabe.": ["Toutes les dates possibles sont déjà réservées pour ce livre. Réessaie après le prochain retour.", "Per questo libro tutte le date possibili sono già prenotate. Riprova dopo la prossima restituzione.", "All possible dates for this book are already booked. Try again after the next return."],
  "Biete 1 bis 5 deiner Bücher zum Tausch an.": ["Propose 1 à 5 de tes livres à l’échange.", "Offri da 1 a 5 dei tuoi libri per lo scambio.", "Offer 1 to 5 of your books for the swap."],
  "Biete nur eigene Bücher an, die zum Tausch stehen.": ["Ne propose que tes propres livres disponibles à l’échange.", "Offri solo libri tuoi disponibili per lo scambio.", "Only offer your own books that are available to swap."],
  "Wähle einen deiner Übergabeorte.": ["Choisis l’un de tes lieux de remise.", "Scegli uno dei tuoi luoghi di consegna.", "Choose one of your handover places."],
  "Dieses Buch ist nicht mehr in deinem Regal. Die Anfrage lässt sich nicht annehmen.": ["Ce livre n’est plus sur ton étagère. La demande ne peut pas être acceptée.", "Questo libro non è più nel tuo scaffale. La richiesta non può essere accettata.", "This book is no longer on your shelf. The request can’t be accepted."],
  "Wähle eines der angebotenen Bücher.": ["Choisis l’un des livres proposés.", "Scegli uno dei libri offerti.", "Choose one of the books offered."],
  "Dieses Tauschbuch ist nicht mehr verfügbar. Wähle ein anderes.": ["Ce livre d’échange n’est plus disponible. Choisis-en un autre.", "Questo libro di scambio non è più disponibile. Scegline un altro.", "This swap book is no longer available. Choose another one."],
  "Für dieses Buch sind schon alle möglichen Termine gebucht.": ["Toutes les dates possibles sont déjà réservées pour ce livre.", "Per questo libro tutte le date possibili sono già prenotate.", "All possible dates for this book are already booked."],
  "Der Zeitraum ist inzwischen belegt. Lehne die Anfrage ab oder bitte um einen anderen Zeitraum.": ["La période est désormais occupée. Refuse la demande ou demande une autre période.", "Il periodo nel frattempo è occupato. Rifiuta la richiesta o chiedi un altro periodo.", "These dates have been taken in the meantime. Decline the request or ask for other dates."],
  "Für diesen Vorgang steht keine Weitergabe an.": ["Aucune transmission n’est prévue pour cette transaction.", "Per questa pratica non è previsto alcun passaggio.", "No pass-on is pending for this loan."],
  "Wähle einen Tag vor dem bisherigen Beginn.": ["Choisis un jour avant le début prévu jusqu’ici.", "Scegli un giorno prima dell’inizio previsto finora.", "Choose a day before the current start."],
  "Dieser Tag ist nicht mehr frei.": ["Ce jour n’est plus libre.", "Questo giorno non è più libero.", "This day is no longer free."],
  "Wähle einen gültigen Zeitraum.": ["Choisis une période valide.", "Scegli un periodo valido.", "Choose valid dates."],
  "Dieser Zeitraum ist nicht frei.": ["Cette période n’est pas libre.", "Questo periodo non è libero.", "These dates aren’t free."],
  "Ein Buch dieses Tauschs gehört inzwischen jemand anderem. Der Vorgang lässt sich so nicht abschliessen.": ["Un livre de cet échange appartient désormais à quelqu’un d’autre. La transaction ne peut pas être terminée ainsi.", "Un libro di questo scambio nel frattempo appartiene a un’altra persona. La pratica non può essere conclusa così.", "A book in this swap now belongs to someone else. The swap can’t be completed like this."],
  "Diese Fotos gehören nicht zu diesem Vorgang.": ["Ces photos n’appartiennent pas à cette transaction.", "Queste foto non appartengono a questa pratica.", "These photos don’t belong to this loan."],
  "Lade die Fotos neu hoch und versuche es nochmals.": ["Téléverse à nouveau les photos et réessaie.", "Carica di nuovo le foto e riprova.", "Upload the photos again and try once more."],

  // Fälle, Tausch, Bewertung
  "Einen Fall kannst du ab 7 Tagen Verzug eröffnen, oder ab 3 Tagen, wenn jemand auf das Buch wartet.": ["Tu peux ouvrir un litige à partir de 7 jours de retard, ou dès 3 jours si quelqu’un attend le livre.", "Puoi aprire un caso dopo 7 giorni di ritardo, oppure dopo 3 giorni se qualcuno aspetta il libro.", "You can open a case once a book is 7 days overdue, or 3 days if someone is waiting for it."],
  "Diesen offenen Fall gibt es nicht.": ["Ce litige ouvert n’existe pas.", "Questo caso aperto non esiste.", "This open case doesn’t exist."],
  "Diese Antwort passt nicht zu diesem Fall.": ["Cette réponse ne correspond pas à ce litige.", "Questa risposta non corrisponde a questo caso.", "This answer doesn’t fit this case."],
  "Wähle eines deiner Bücher.": ["Choisis l’un de tes livres.", "Scegli uno dei tuoi libri.", "Choose one of your books."],
  "Dieser Fall ist bereits geschlossen.": ["Ce litige est déjà clos.", "Questo caso è già chiuso.", "This case is already closed."],
  "Diesen Fall gibt es nicht.": ["Ce litige n’existe pas.", "Questo caso non esiste.", "This case doesn’t exist."],
  "Wähle eines deiner Bücher, das gerade nicht verliehen oder gebucht ist.": ["Choisis l’un de tes livres qui n’est ni prêté ni réservé en ce moment.", "Scegli uno dei tuoi libri che al momento non è in prestito né prenotato.", "Choose one of your books that isn’t on loan or booked right now."],
  "Es liegt kein Tauschangebot vor.": ["Il n’y a aucune offre d’échange.", "Non c’è nessuna offerta di scambio.", "There’s no swap offer."],
  "Du hast diesen Vorgang bereits bewertet.": ["Tu as déjà évalué cette transaction.", "Hai già valutato questa pratica.", "You’ve already rated this loan."],
  "Für diesen Vorgang ist keine Bewertung mehr möglich.": ["Il n’est plus possible d’évaluer cette transaction.", "Per questa pratica non è più possibile una valutazione.", "Rating this loan is no longer possible."],
  "Der gebuchte Zeitraum ist vorbei und das Buch ist danach schon gebucht. Storniere den Vorgang und frag für einen neuen Zeitraum an.": ["La période réservée est passée et le livre est déjà réservé ensuite. Annule la transaction et fais une demande pour une nouvelle période.", "Il periodo prenotato è passato e il libro è già prenotato subito dopo. Annulla la pratica e richiedi un nuovo periodo.", "The booked dates have passed and the book is already booked afterwards. Cancel the loan and request new dates."],
  "Dieser Übergabeort gehört zu einem offenen Vorgang. Du kannst ihn entfernen, sobald der Vorgang abgeschlossen ist.": ["Ce lieu de remise est lié à une transaction en cours. Tu pourras le supprimer une fois la transaction terminée.", "Questo luogo di consegna è legato a una pratica aperta. Potrai rimuoverlo quando la pratica sarà conclusa.", "This handover place belongs to an open loan. You can remove it once the loan is complete."],
  "Möglich sind Mobilnummern aus der Schweiz und Liechtenstein.": ["Seuls les numéros de mobile de Suisse et du Liechtenstein sont possibles.", "Sono possibili solo numeri di cellulare svizzeri e del Liechtenstein.", "Only mobile numbers from Switzerland and Liechtenstein are possible."],
  "Das angebotene Buch ist inzwischen verliehen oder gebucht. Der Tausch ist so nicht mehr möglich.": ["Le livre proposé est entre-temps prêté ou réservé. L’échange n’est plus possible ainsi.", "Il libro offerto nel frattempo è in prestito o prenotato. Lo scambio così non è più possibile.", "The book offered is now on loan or booked. The swap is no longer possible like this."],
  // Gemeinschaft: Pinnwand, Zettel im Buch
  "Das Datum liegt in der Vergangenheit.": ["La date est dans le passé.", "La data è nel passato.", "The date is in the past."],
  "Das ist dein eigener Zettel.": ["C’est ton propre billet.", "È il tuo biglietto.", "This is your own note."],
  "Der Kommentar darf höchstens 500 Zeichen lang sein.": ["Le commentaire ne peut pas dépasser 500 caractères.", "Il commento può avere al massimo 500 caratteri.", "The comment can be at most 500 characters long."],
  "Der Kommentar ist leer.": ["Le commentaire est vide.", "Il commento è vuoto.", "The comment is empty."],
  "Der Ort darf höchstens 120 Zeichen lang sein.": ["Le lieu ne peut pas dépasser 120 caractères.", "Il luogo può avere al massimo 120 caratteri.", "The place can be at most 120 characters long."],
  "Der Text darf höchstens 280 Zeichen lang sein.": ["Le texte ne peut pas dépasser 280 caractères.", "Il testo può avere al massimo 280 caratteri.", "The text can be at most 280 characters long."],
  "Der Text darf höchstens 500 Zeichen lang sein.": ["Le texte ne peut pas dépasser 500 caractères.", "Il testo può avere al massimo 500 caratteri.", "The text can be at most 500 characters long."],
  "Der Zettel darf höchstens 200 Zeichen lang sein.": ["Le mot ne peut pas dépasser 200 caractères.", "Il biglietto può avere al massimo 200 caratteri.", "The note can be at most 200 characters long."],
  "Der Zettel ist leer.": ["Le mot est vide.", "Il biglietto è vuoto.", "The note is empty."],
  "Diesen Kommentar gibt es nicht mehr.": ["Ce commentaire n’existe plus.", "Questo commento non esiste più.", "This comment no longer exists."],
  "Diesen Titel gibt es nicht.": ["Ce titre n’existe pas.", "Questo titolo non esiste.", "This title doesn’t exist."],
  "Diesen Zettel gibt es nicht mehr.": ["Ce billet n’existe plus.", "Questo biglietto non esiste più.", "This note no longer exists."],
  "Diesen Zettel hat die Moderation ausgeblendet.": ["Ce mot a été masqué par la modération.", "Questo biglietto è stato nascosto dalla moderazione.", "Moderation has hidden this note."],
  "Einen Zettel im Buch hinterlässt nur, wer es geliehen hat.": ["Seule la personne qui a emprunté le livre peut y laisser un mot.", "Solo chi ha preso in prestito il libro può lasciarvi un biglietto.", "Only the person who borrowed the book can leave a note in it."],
  "Empfehlen kannst du nur eigene Bücher aus dem Regal dieses Kreises.": ["Tu ne peux recommander que tes propres livres de l’étagère de ce cercle.", "Puoi consigliare solo i tuoi libri dallo scaffale di questa cerchia.", "You can only recommend your own books from this circle’s shelf."],
  "Schreib einen Satz dazu.": ["Ajoute une phrase.", "Aggiungi una frase.", "Add a sentence."],
  "Wähle ein eigenes Exemplar dieses Titels.": ["Choisis l’un de tes exemplaires de ce titre.", "Scegli un tuo esemplare di questo titolo.", "Choose your own copy of this title."],
  "Du suchst diesen Titel in diesem Kreis schon.": ["Tu cherches déjà ce titre dans ce cercle.", "Stai già cercando questo titolo in questa cerchia.", "You’re already looking for this title in this circle."],
  "Ankündigungen schreiben nur Admins des Kreises.": ["Seuls les admins du cercle peuvent publier des annonces.", "Solo gli admin della cerchia possono pubblicare annunci.", "Only the circle’s admins can post announcements."],
  "Zettel anderer entfernen nur Admins des Kreises.": ["Seuls les admins du cercle peuvent retirer les billets des autres.", "Solo gli admin della cerchia possono rimuovere i biglietti degli altri.", "Only the circle’s admins can remove other people’s notes."],
  "Kommentare anderer entfernen nur Admins des Kreises.": ["Seuls les admins du cercle peuvent retirer les commentaires des autres.", "Solo gli admin della cerchia possono rimuovere i commenti degli altri.", "Only the circle’s admins can remove other people’s comments."],
  "Ein Angebot geht nur auf einen Suchzettel.": ["Une offre n’est possible que sur un billet de recherche.", "Un’offerta è possibile solo su un biglietto di ricerca.", "You can only make an offer on a search note."],
  "Dein Regal ist gerade pausiert. Hebe die Pause auf, dann kannst du das Buch anbieten.": ["Ton étagère est en pause. Lève la pause, ensuite tu pourras proposer le livre.", "Il tuo scaffale è in pausa. Togli la pausa, poi potrai offrire il libro.", "Your shelf is paused right now. End the pause, then you can offer the book."],
  "Dieses Exemplar wird gerade nicht angeboten oder ist für die suchende Person nicht sichtbar. Ändere das zuerst im Regal.": ["Cet exemplaire n’est pas proposé en ce moment ou n’est pas visible pour la personne qui le cherche. Modifie d’abord cela dans ton étagère.", "Questo esemplare al momento non è offerto o non è visibile per la persona che lo cerca. Modifica prima questo nello scaffale.", "This copy isn’t offered right now or isn’t visible to the person looking for it. Change that on your shelf first."],
  "Zu dieser Leihe gibt es schon einen Zettel.": ["Il y a déjà un mot pour ce prêt.", "Per questo prestito c’è già un biglietto.", "There’s already a note for this loan."],
  "Ein Zettel im Buch ist erst nach dem Abschluss und nur während der Bewertungsfrist möglich.": ["Un mot dans le livre n’est possible qu’après la clôture et seulement pendant le délai d’évaluation.", "Un biglietto nel libro è possibile solo dopo la conclusione e solo entro il termine di valutazione.", "A note in the book is only possible after the loan is complete and only during the rating period."],
};

type Pattern = { re: RegExp; fr: (m: RegExpMatchArray) => string; it: (m: RegExpMatchArray) => string; en: (m: RegExpMatchArray) => string };

/** Meldungen mit eingesetzten Werten (Zahlen, Namen) */
export const ERROR_PATTERNS: Pattern[] = [
  {
    re: /^Du hast (\d+) offene Anfragen, das ist deine Grenze\. Warte auf Antworten oder ziehe eine Anfrage zurück\.$/,
    fr: (m) => `Tu as ${m[1]} demandes ouvertes, c’est ta limite. Attends les réponses ou retire une demande.`,
    it: (m) => `Hai ${m[1]} richieste aperte, è il tuo limite. Aspetta le risposte o ritira una richiesta.`,
    en: (m) => `You have ${m[1]} open requests, which is your limit. Wait for replies or withdraw a request.`,
  },
  {
    re: /^Du hast (\d+) Leihen bei anderen Mitgliedern laufen oder gebucht\. Mit deiner Stufe sind (\d+) gleichzeitig möglich\. Leihen in Kreisen zählen nicht dazu\.$/,
    fr: (m) => `Tu as ${m[1]} prêts en cours ou réservés chez d’autres membres. Avec ton niveau, ${m[2]} sont possibles en même temps. Les prêts dans les cercles ne comptent pas.`,
    it: (m) => `Hai ${m[1]} prestiti in corso o prenotati presso altri membri. Con il tuo livello ne sono possibili ${m[2]} alla volta. I prestiti nelle cerchie non contano.`,
    en: (m) => `You have ${m[1]} loans running or booked with other members. Your level allows ${m[2]} at a time. Loans in circles don’t count.`,
  },
  {
    re: /^(.+) hat gerade schon (\d+) Leihen laufen oder gebucht, mehr sind mit der aktuellen Stufe nicht möglich\. Die Anfrage kann erst später angenommen werden\.$/,
    fr: (m) => `${m[1]} a déjà ${m[2]} prêts en cours ou réservés, son niveau actuel n’en permet pas davantage. La demande ne pourra être acceptée que plus tard.`,
    it: (m) => `${m[1]} ha già ${m[2]} prestiti in corso o prenotati, con il livello attuale non ne sono possibili altri. La richiesta potrà essere accettata solo più tardi.`,
    en: (m) => `${m[1]} already has ${m[2]} loans running or booked, and their current level doesn’t allow more. The request can only be accepted later.`,
  },
  {
    re: /^Du hast noch einen offenen Vorgang\. Schliesse ihn ab, dann kannst du dein Konto löschen\.$/,
    fr: () => "Tu as encore une transaction ouverte. Termine-la, ensuite tu pourras supprimer ton compte.",
    it: () => "Hai ancora una pratica aperta. Concludila, poi potrai eliminare il tuo conto.",
    en: () => "You still have an open loan. Complete it, then you can delete your account.",
  },
  {
    re: /^Du hast noch (\d+) offene Vorgänge\. Schliesse sie ab, dann kannst du dein Konto löschen\.$/,
    fr: (m) => `Tu as encore ${m[1]} transactions ouvertes. Termine-les, ensuite tu pourras supprimer ton compte.`,
    it: (m) => `Hai ancora ${m[1]} pratiche aperte. Concludile, poi potrai eliminare il tuo conto.`,
    en: (m) => `You still have ${m[1]} open loans. Complete them, then you can delete your account.`,
  },
  {
    re: /^Du kannst bis zu (\d+) Titelalarme setzen\.$/,
    fr: (m) => `Tu peux définir jusqu’à ${m[1]} alertes de titres.`,
    it: (m) => `Puoi impostare fino a ${m[1]} avvisi di titoli.`,
    en: (m) => `You can set up to ${m[1]} title alerts.`,
  },
  {
    re: /^Dieses Buch lässt sich höchstens (\d+) Tage im Voraus buchen\.$/,
    fr: (m) => `Ce livre peut être réservé au maximum ${m[1]} jours à l’avance.`,
    it: (m) => `Questo libro si può prenotare al massimo ${m[1]} giorni in anticipo.`,
    en: (m) => `This book can be booked at most ${m[1]} days in advance.`,
  },
  {
    re: /^Die Leihfrist für dieses Buch beträgt höchstens (\d+) Tage\.$/,
    fr: (m) => `La durée de prêt de ce livre est de ${m[1]} jours au maximum.`,
    it: (m) => `La durata del prestito di questo libro è al massimo di ${m[1]} giorni.`,
    en: (m) => `The loan period for this book is at most ${m[1]} days.`,
  },
  {
    re: /^Die Leihfrist beträgt höchstens (\d+) Tage\.$/,
    fr: (m) => `La durée de prêt est de ${m[1]} jours au maximum.`,
    it: (m) => `La durata del prestito è al massimo di ${m[1]} giorni.`,
    en: (m) => `The loan period is at most ${m[1]} days.`,
  },
];

/** Übersetzt eine deutsche Server-Meldung; Unbekanntes bleibt deutsch */
export function translateError(msg: string, l: Locale): string {
  if (l === "de" || !msg) return msg;
  const i = { fr: 0, it: 1, en: 2 }[l];
  const hit = ERRORS[msg];
  if (hit) return hit[i];
  for (const p of ERROR_PATTERNS) {
    const m = msg.match(p.re);
    if (m) return p[l](m);
  }
  return msg;
}
