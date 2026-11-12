/** Rückfall-Meldungen im Browser, wenn der Server keine (übersetzte) Meldung liefert */
import type { Locale } from "../locale";

export const CLIENT_ERRORS: Record<Locale, { generic: string; upload: string }> = {
  de: {
    generic: "Etwas ist schiefgelaufen. Versuche es erneut.",
    upload: "Das Foto konnte nicht hochgeladen werden. Prüfe die Verbindung und versuche es erneut.",
  },
  fr: {
    generic: "Une erreur s’est produite. Réessaie.",
    upload: "La photo n’a pas pu être envoyée. Vérifie la connexion et réessaie.",
  },
  it: {
    generic: "Qualcosa è andato storto. Riprova.",
    upload: "Non è stato possibile caricare la foto. Controlla la connessione e riprova.",
  },
};
