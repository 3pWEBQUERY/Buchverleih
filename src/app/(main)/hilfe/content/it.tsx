import Link from "next/link";
import { DocCompare, DocSection, DocSub, DocTable } from "@/components/doc";
import type { HelpContent } from "./types";

/** Aiuto in italiano */
export const HELP_IT: HelpContent = {
  title: "Come funziona",
  description: "Come funzionano prestito, consegna, scadenze, scambio e casi su Leihregal.",
  eyebrow: "Aiuto",
  heading: ["Come ", "funziona."],
  lead: "Prendi in prestito gratis libri dagli scaffali vicino a te. Ogni prestito ha passi e scadenze fissi. Così ognuno sa in ogni momento a chi tocca.",
  toc: [
    ["ablauf", "Un prestito passo per passo"],
    ["uebergabe", "Consegna e restituzione"],
    ["fristen", "Scadenze e promemoria"],
    ["verlaengern", "Prolungare e richiamare"],
    ["termin", "Prestito prenotato e calendario"],
    ["weitergabe", "Passaggio diretto"],
    ["tausch", "Scambiare e regalare"],
    ["stufen", "Livelli di fiducia e limiti"],
    ["schaden", "Segni di lettura o danno"],
    ["streitfall", "Quando un libro non torna"],
    ["treffen", "Incontrarsi in sicurezza"],
    ["alter", "Età minima"],
  ],
  quick: {
    eyebrow: "Avvio rapido",
    title: "Il primo libro in quattro passi",
    note: "I dettagli sono più in basso.",
    steps: [
      ["01", "Trovare", "Cerca per titolo, autore o ISBN – oppure sfoglia gli scaffali entro 5 km.", "/suche", "Trova libri"],
      ["02", "Richiedere", "Scegli esemplare e periodo. Chi presta risponde entro 72 ore.", "#ablauf", "Lo svolgimento"],
      ["03", "Consegnare", "Vi incontrate, una scansione del codice QR conferma la consegna. Da qui decorre la scadenza.", "#uebergabe", "Consegna"],
      ["04", "Restituire", "La durata standard è di 28 giorni. Te lo ricordiamo, e prolungare richiede un tocco.", "#fristen", "Scadenze"],
    ],
  },
  body: (
    <>
      <DocSection id="ablauf" title="Un prestito passo per passo">
        <ol>
          <li><strong>Richiedere.</strong> Scegli un esemplare e un periodo nel calendario dei prestiti, da oggi o più avanti. È possibile un breve messaggio.</li>
          <li><strong>Risposta.</strong> Chi presta accetta o rifiuta, senza motivazione. Senza risposta, la richiesta scade dopo 72 ore.</li>
          <li><strong>Fissare un appuntamento.</strong> Nella chat della pratica proponete luogo e ora. Una proposta si accetta con un tocco.</li>
          <li><strong>Consegna.</strong> Una scansione del codice QR conferma la consegna. Da qui decorre il periodo di prestito.</li>
          <li><strong>Annotare lo stato.</strong> Entro 24 ore puoi segnalare difetti con una foto. Dopo vale lo stato indicato nell’annuncio.</li>
          <li><strong>Leggere.</strong> Te lo ricordiamo 5 giorni e 1 giorno prima della scadenza.</li>
          <li><strong>Restituzione.</strong> Di nuovo con una scansione. Chi ha prestato controlla il libro e può segnalare un danno entro 48 ore.</li>
          <li><strong>Conclusione.</strong> Senza segnalazioni il prestito è concluso e il libro di nuovo disponibile. Entrambi possono dire con un tocco: «Volentieri di nuovo» o «Ci sono stati problemi».</li>
        </ol>
        <p>Decide chi presta: chi prende in prestito, per quanto tempo e dove avviene la consegna. La piattaforma fissa solo standard e limiti massimi.</p>
      </DocSection>

      <DocSection id="uebergabe" title="Consegna e restituzione">
        <p>
          Chi consegna il libro apre la pratica e mostra un codice QR. Chi lo riceve lo scansiona con la fotocamera nel browser.
          Il codice vale 10 minuti. Sotto ci sono sei cifre: se la fotocamera non collabora, le inserisci a mano.
        </p>
        <p>Se nessuna scansione funziona, ci sono tre vie:</p>
        <DocTable head={["Via", "Svolgimento", "Garanzia"]} rows={[
          ["Segnalazione unilaterale", "Una parte tocca «Consegnato» o «Restituito». All’altra viene chiesta una conferma.", "48 ore per opporsi, poi la segnalazione vale. Promemoria dopo 24 ore."],
          ["Deposito", "Cassetta del latte, bucalettere o androne: chi consegna lascia il libro e carica una foto del deposito. L’altra parte conferma il ritiro.", "Foto con data e ora, 48 ore per opporsi. Solo se chi presta consente il deposito."],
          ["Nessun incontro", "Nessuno segnala niente, l’appuntamento passa.", "La pratica resta aperta e scade 7 giorni dopo l’inizio previsto."],
        ]} />
        <p>
          Il termine di opposizione protegge anche te che prendi in prestito: chi non conferma una restituzione avvenuta non può tenere aperto il prestito.
        </p>
        <p>
          <strong>Luoghi di consegna.</strong> Chi presta definisce fino a tre luoghi, per esempio «Stazione di Bülach, chiosco». Prima dell’accettazione vedi solo questa denominazione.
          Il luogo esatto appare nella pratica solo dopo l’accettazione. Leihregal non mostra mai un indirizzo.
        </p>
      </DocSection>

      <DocSection id="fristen" title="Scadenze e promemoria">
        <p>La maggior parte delle restituzioni in ritardo sono dimenticanze, non cattiva volontà. Per questo si procede con calma, con promemoria invece di sanzioni.</p>
        <DocTable head={["Momento", "Cosa succede"]} rows={[
          ["5 giorni prima", "Promemoria con i pulsanti «Prolunga» e «Pianifica la restituzione»."],
          ["1 giorno prima", "Secondo promemoria."],
          ["Scadenza", "Stato «in ritardo». Avviso a entrambi, proposta di data nella chat."],
          ["+ 3 giorni", "Promemoria via e-mail. La tolleranza finisce, il prestito conta come non puntuale."],
          ["+ 7 giorni", "Nessuna nuova richiesta finché il libro non torna. Chi presta può aprire un caso."],
          ["+ 21 giorni", "Il caso viene aperto automaticamente."],
        ]} />
        <p>Ogni azione in sospeso ha una scadenza e una conseguenza fissa. Niente resta in sospeso.</p>
      </DocSection>

      <DocSection id="verlaengern" title="Prolungare e richiamare">
        <DocTable head={["Regola", "Standard", "A scelta di chi presta"]} rows={[
          ["Durata del prestito", "28 giorni", "14, 28, 42 o 56 giorni, per scaffale o per libro"],
          ["Proroga", "1 × di 14 giorni, automatica se dopo il calendario è libero", "Solo su richiesta, fino a 2 proroghe"],
          ["Con prestito successivo", "Al massimo fino al margine prima del prestito successivo", "–"],
          ["Richiamo", "Al più presto dopo 14 giorni, restituzione entro 7 giorni", "Non disattivabile: il libro resta suo"],
          ["Restituire prima", "In qualsiasi momento", "–"],
        ]} />
      </DocSection>

      <DocSection id="termin" title="Prestito prenotato e calendario">
        <p>
          Puoi prenotare un libro per più tardi, anche se al momento è in prestito. Ogni esemplare ha un calendario dei prestiti:
          ogni prestito è una barra su una linea del tempo. Tocchi direttamente un periodo libero e la richiesta si apre con quella data.
        </p>
        <ul>
          <li>Si può prenotare fino a 90 giorni prima, a seconda del libro da 30 a 180 giorni.</li>
          <li>Tra due prestiti ci sono 3 giorni di margine per la restituzione e la consegna successiva.</li>
          <li>La consegna è possibile da 3 giorni prima a 7 giorni dopo l’inizio previsto.</li>
          <li>Gli altri vedono solo libero o occupato, nessun nome.</li>
        </ul>
        <p>
          Se il libro torna prima, ti viene proposto di iniziare prima. Se la restituzione prima del tuo prestito è in ritardo, scegli:
          spostare il periodo, prendere in prestito per meno tempo o annullare senza svantaggi.
        </p>
        <p>
          Puoi annullare in qualsiasi momento fino alla consegna. Meno di 48 ore prima dell’inizio, nei tuoi numeri conta come un prestito non puntuale.
        </p>
      </DocSection>

      <DocSection id="weitergabe" title="Passaggio diretto">
        <p>
          Se due prestiti si susseguono, il libro può passare direttamente dalla prima alla seconda persona, senza tornare da chi presta.
          Si risparmiano due incontri. Succede solo se tutti e tre hanno acconsentito.
        </p>
        <ol>
          <li>A chi presta viene chiesto se vuole il passaggio diretto. Può fissarlo in anticipo per ogni libro: mai, su richiesta, sempre.</li>
          <li>Poi acconsentono le due persone che prendono in prestito. Il passaggio vale solo con tre consensi.</li>
          <li>Luogo e ora li concordate in tre nella chat di consegna.</li>
          <li>Una scansione chiude il primo prestito e avvia il secondo nello stesso momento.</li>
          <li>Chi riceve il libro annota lo stato con una foto entro 24 ore. Qui è obbligatorio: dei difetti che non segnali rispondi tu.</li>
        </ol>
        <p>
          Ogni prestito resta un accordo con chi presta. La prima persona risponde fino alla scansione, la seconda dalla scansione.
          Leihregal non trasmette mai numero di telefono né indirizzo. Se il passaggio salta, il libro torna normalmente e la scadenza si prolunga di 3 giorni.
        </p>
      </DocSection>

      <DocSection id="tausch" title="Scambiare e regalare">
        <p>Scambio e regalo sono cambi di proprietà definitivi. Funzionano come un prestito, solo senza restituzione.</p>
        <DocSub>Scambio 1:1</DocSub>
        <p>
          Richiedi un libro da scambiare e offri da 1 a 5 libri del tuo scaffale. L’altra parte ne sceglie uno o rifiuta.
          Alla consegna ognuno scansiona il codice dell’altro, entrambe le scansioni entro 10 minuti. Non ci sono conguagli né punti:
          se un tascabile contro un libro illustrato è equo lo decidete voi.
        </p>
        <DocSub>Regalare</DocSub>
        <p>
          Richiesta, accettazione, consegna con scansione, fatto. Con più richieste scegli liberamente. I libri ricevuti in regalo si possono regalare o scambiare di nuovo al più presto dopo 30 giorni.
        </p>
        <DocSub>Tenere invece di restituire</DocSub>
        <p>Se un libro preso in prestito ti piace, puoi proporre di tenerlo e dare in cambio uno dei tuoi libri. Se chi presta accetta, il prestito diventa uno scambio.</p>
      </DocSection>

      <DocSection id="stufen" title="Livelli di fiducia e limiti">
        <p>I nuovi membri possono prendere in prestito subito, ma poco. Questo limita gli abusi senza escludere le persone oneste.</p>
        <DocTable head={["Livello", "Requisito", "Prestiti da sconosciuti", "Richieste aperte"]} rows={[
          ["Nuovo", "E-mail e numero di cellulare confermati", "2 alla volta", "3"],
          ["Affidabile", "3 prestiti conclusi, tutti puntuali", "5 alla volta", "6"],
          ["Di fiducia", "10 prestiti conclusi, nessuna perdita in 12 mesi", "10 alla volta", "10"],
        ]} />
        <ul>
          <li>I prestiti all’interno di una cerchia non contano per il limite.</li>
          <li>Chi presta può fissare per scaffale: «tutti», «da Affidabile» o «solo le mie cerchie».</li>
          <li>Sul tuo profilo ci sono il livello e tre numeri: prestati, presi in prestito, restituiti puntuali. Niente stelle, niente punti.</li>
        </ul>
      </DocSection>

      <DocSection id="schaden" title="Segni di lettura o danno">
        <p>
          <strong>I normali segni di lettura non sono un danno.</strong> Un libro che è stato letto si vede. Il confronto avviene sempre con lo stato dell’annuncio
          e con la nota sullo stato registrata alla consegna.
        </p>
        <DocCompare
          left={{ title: "Segno di lettura – nessun danno", items: [
            "Piega di lettura sul dorso di un tascabile",
            "Angoli e bordi leggermente consumati",
            "Copertina un po’ ondulata o sfregata",
            "Pagine ingiallite dalla luce e dal tempo",
            "Qualche leggera piega agli angoli delle pagine",
            "Impronta di un segnalibro",
          ] }}
          right={{ title: "Danno", items: [
            "Macchia d’acqua o di caffè, pagine ondulate",
            "Pagine strappate, tagliate o mancanti",
            "Pagine che si staccano dalla rilegatura",
            "Nuove sottolineature, note o evidenziatore",
            "Copertina strappata, sovraccoperta mancante",
            "Bruciature o muffa, forte odore di fumo, segni di morsi",
          ] }}
        />
        <DocSub>Se è successo qualcosa</DocSub>
        <p>
          Chi presta segnala un danno entro 48 ore dalla restituzione, con una foto. Tu scegli una di tre risposte:
          sostituzione con un esemplare uguale, sostituzione con un altro libro a scelta di chi presta, oppure contestazione.
          In caso di contestazione decide la moderazione sulla base delle foto e dello storico.
        </p>
      </DocSection>

      <DocSection id="streitfall" title="Quando un libro non torna">
        <p>
          Al più tardi 21 giorni dopo la scadenza viene aperto un caso. Da lì vale uno svolgimento fisso. Chi ha preso in prestito ha tre possibilità:
          indicare una data di restituzione, offrire una sostituzione o proporre di tenere il libro e darne in cambio uno proprio.
        </p>
        <DocTable head={["Giorno dall’apertura", "Cosa succede"]} rows={[
          ["0", "Il caso è aperto. Le tre possibilità sono nella pratica."],
          ["7", "Senza reazione: secondo sollecito via e-mail e SMS."],
          ["14", "Senza reazione: prestiti e scambi vengono bloccati. La moderazione esamina il caso."],
          ["30", "Il caso viene chiuso come «perso». Il libro lascia lo scaffale. La perdita resta visibile sul profilo per 24 mesi."],
        ]} />
        <p>
          Una perdita si può sistemare anche dopo: se il libro torna o viene sostituito, la voce e il blocco spariscono.
          Leihregal non può recuperare libri né pagare danni. Si assicura che il percorso sia uguale e prevedibile per entrambi.
        </p>
      </DocSection>

      <DocSection id="treffen" title="Incontrarsi in sicurezza">
        <ul>
          <li>Incontratevi in luoghi pubblici: stazione, biblioteca, caffè. Di giorno, se possibile.</li>
          <li>Il deposito è un’alternativa senza incontro, se chi presta lo consente.</li>
          <li>Prima dell’accettazione nessuno vede un luogo esatto. Leihregal non mostra mai un indirizzo.</li>
          <li>Numero di telefono o indirizzo li condividi solo se vuoi, tu stesso nella chat.</li>
          <li>Se qualcosa non ti convince: segnala la persona o bloccala con un tocco. Chi è bloccato non vede più il tuo scaffale.</li>
        </ul>
        <p>Più dettagli nelle <Link href="/regeln">regole</Link>.</p>
      </DocSection>

      <DocSection id="alter" title="Età minima">
        <p>
          Per un conto tuo devi avere almeno 16 anni. I libri per bambini li prendono in prestito i genitori. Così gli incontri tra sconosciuti e bambini sono esclusi.
        </p>
      </DocSection>
    </>
  ),
};
