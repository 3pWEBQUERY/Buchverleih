import Link from "next/link";
import { DocSection } from "@/components/doc";
import type { RulesContent } from "./types";

/** Regole in italiano */
export const RULES_IT: RulesContent = {
  title: "Regole",
  description: "Regole della comunità Leihregal: prestare gratis, essere puntuali, restare rispettosi.",
  eyebrow: "Comunità",
  heading: ["Regole. ", "Brevi e per tutti."],
  lead: "Leihregal funziona perché le persone si affidano a vicenda i propri libri. Queste regole mantengono la fiducia. Sono brevi e valgono per tutti.",
  toc: [
    ["kostenlos", "Prestare è gratis"],
    ["preise", "Niente prezzi nella chat"],
    ["puenktlich", "Essere puntuali"],
    ["sorgfalt", "Cura dei libri"],
    ["respekt", "Rispetto nella chat"],
    ["fotos", "Foto e immagine del profilo"],
    ["konto", "Una persona, un conto"],
    ["melden", "Segnalare e bloccare"],
    ["folgen", "Quando qualcuno infrange le regole"],
  ],
  summary: {
    eyebrow: "In breve",
    title: "Quattro cose su cui tutti contano",
    items: [
      ["Gratis", "Prestare, scambiare, regalare. Mai vendere, niente prezzi nella chat.", "#kostenlos"],
      ["Puntuali", "Rispettare gli appuntamenti, restituire i libri in tempo, rispondere alle richieste.", "#puenktlich"],
      ["Con cura", "Leggere il libro di un altro come si deve: senza note, senza passarlo ad altri.", "#sorgfalt"],
      ["Rispettosi", "Scrivere con gentilezza, accettare un no, incontrarsi in pubblico.", "#respekt"],
    ],
  },
  body: (
    <>
      <DocSection id="kostenlos" title="Prestare è gratis">
        <p>
          Qui i libri vengono prestati, scambiati o regalati, mai venduti. Nessuna tariffa, nessuna cauzione, nessuna mancia come condizione.
          Chi vuole vendere libri è nel posto sbagliato. I venditori commerciali sono esclusi.
        </p>
        <p>
          Non è solo un atteggiamento: appena per un prestito circola denaro, giuridicamente non è più un prestito.
        </p>
      </DocSection>

      <DocSection id="preise" title="Niente prezzi nella chat">
        <p>
          La chat serve per luogo, ora e libro. Non indicare prezzi e non fare offerte d’acquisto, nemmeno «solo per sicurezza».
          Leihregal segnala automaticamente i messaggi con prezzi perché la moderazione li verifichi.
        </p>
      </DocSection>

      <DocSection id="puenktlich" title="Essere puntuali">
        <ul>
          <li>Vieni all’appuntamento concordato. Se non puoi, disdici per tempo o proponi una nuova data.</li>
          <li>Restituisci i libri entro la fine del prestito, oppure prolunga in tempo.</li>
          <li>Rispondi alle richieste entro tre giorni. Rifiutare va bene, il silenzio fa perdere tempo agli altri.</li>
        </ul>
        <p>La puntualità è indicata come numero sul tuo profilo. È ciò su cui gli altri contano.</p>
      </DocSection>

      <DocSection id="sorgfalt" title="Cura dei libri">
        <p>
          Leggi il libro come si legge il libro di un altro: niente note, niente sottolineature, non nella vasca da bagno.
          I normali segni di lettura non sono un problema. Cosa conta come danno lo trovi nell’<Link href="/hilfe#schaden">aiuto</Link>.
        </p>
        <p>
          Un libro preso in prestito non lo passi ad altri. L’unica eccezione è il passaggio diretto, se chi presta l’ha esplicitamente accettato.
        </p>
      </DocSection>

      <DocSection id="respekt" title="Rispetto nella chat">
        <p>
          Scrivi come parleresti a una persona sconosciuta in stazione. Niente insulti, niente avances, niente insistenze.
          Un no è un no, anche senza motivazione.
        </p>
        <p>
          Numero di telefono e indirizzo li condividi solo se vuoi. Non chiederli. Incontratevi in luoghi pubblici.
        </p>
      </DocSection>

      <DocSection id="fotos" title="Foto e immagine del profilo">
        <p>
          Le foto mostrano libri: la copertina, lo stato, un difetto, il deposito alla consegna. Niente persone, niente pubblicità, niente che non riguardi il libro.
        </p>
        <p>
          L’unica eccezione è la tua immagine del profilo. È facoltativa e mostra te o qualcosa che ti rappresenta. Niente altre persone senza il loro consenso,
          niente pubblicità, niente di sconveniente. La moderazione rimuove le immagini del profilo inadatte.
        </p>
      </DocSection>

      <DocSection id="konto" title="Una persona, un conto">
        <p>
          Ogni conto appartiene a una persona dai 16 anni in su, con un proprio numero di cellulare. Un numero, un conto. I conti secondari vengono bloccati.
        </p>
      </DocSection>

      <DocSection id="melden" title="Segnalare e bloccare">
        <p>
          Se qualcosa non va, segnalalo: un messaggio, una foto, un profilo o un libro. La moderazione vede ogni segnalazione.
          Legge la chat di una pratica solo in caso di segnalazione o di un caso aperto, e ogni accesso viene registrato.
        </p>
        <p>
          Bloccare richiede un tocco. Le persone bloccate non vedono più il tuo scaffale e non possono farti richieste.
          Puoi togliere il blocco in qualsiasi momento nelle <Link href="/einstellungen#blockiert">impostazioni</Link>.
        </p>
      </DocSection>

      <DocSection id="folgen" title="Quando qualcuno infrange le regole">
        <p>
          La moderazione decide in base allo storico e alle foto. A seconda del caso richiama, blocca i prestiti o blocca il conto.
          Con il blocco del conto viene bloccato anche il numero di cellulare. Chi ritiene ingiusto un blocco risponde all’e-mail con cui è stato comunicato.
        </p>
      </DocSection>
    </>
  ),
};
