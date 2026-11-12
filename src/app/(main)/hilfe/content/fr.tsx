import Link from "next/link";
import { DocCompare, DocSection, DocSub, DocTable } from "@/components/doc";
import type { HelpContent } from "./types";

/** Aide en français */
export const HELP_FR: HelpContent = {
  title: "Comment ça marche",
  description: "Comment se déroulent le prêt, la remise, les délais, l’échange et les litiges sur Leihregal.",
  eyebrow: "Aide",
  heading: ["Comment ça ", "marche."],
  lead: "Tu empruntes gratuitement des livres sur les étagères près de chez toi. Chaque prêt suit des étapes et des délais fixes. Ainsi, chacun sait à tout moment à qui c’est le tour.",
  toc: [
    ["ablauf", "Un prêt étape par étape"],
    ["uebergabe", "Remise et retour"],
    ["fristen", "Délais et rappels"],
    ["verlaengern", "Prolonger et rappeler"],
    ["termin", "Prêt réservé et calendrier des prêts"],
    ["weitergabe", "Transmission directe"],
    ["tausch", "Échanger et donner"],
    ["stufen", "Niveaux de confiance et limites"],
    ["schaden", "Traces de lecture ou dommage"],
    ["streitfall", "Quand un livre ne revient pas"],
    ["treffen", "Se rencontrer en sécurité"],
    ["alter", "Âge minimum"],
  ],
  quick: {
    eyebrow: "Démarrage rapide",
    title: "Ton premier livre en quatre étapes",
    note: "Les détails figurent plus bas.",
    steps: [
      ["01", "Trouver", "Cherche par titre, auteur·e ou ISBN – ou parcours les étagères dans un rayon de 5 km.", "/suche", "Trouver des livres"],
      ["02", "Demander", "Choisis l’exemplaire et la période. La personne qui prête répond dans les 72 heures.", "#ablauf", "Le déroulement"],
      ["03", "Remettre", "Vous vous rencontrez, un scan du code QR confirme la remise. Le délai commence alors.", "#uebergabe", "Remise"],
      ["04", "Rendre", "La durée standard est de 28 jours. Nous te le rappelons, et prolonger se fait d’un geste.", "#fristen", "Délais"],
    ],
  },
  body: (
    <>
      <DocSection id="ablauf" title="Un prêt étape par étape">
        <ol>
          <li><strong>Demander.</strong> Tu choisis un exemplaire et une période dans le calendrier des prêts, dès aujourd’hui ou plus tard. Un court message est possible.</li>
          <li><strong>Réponse.</strong> La personne qui prête accepte ou refuse, sans justification. Sans réponse, la demande expire après 72 heures.</li>
          <li><strong>Fixer un rendez-vous.</strong> Dans le chat de la transaction, vous proposez un lieu et une heure. Une proposition s’accepte d’un geste.</li>
          <li><strong>Remise.</strong> Un scan du code QR confirme la remise. Le délai de prêt commence alors.</li>
          <li><strong>Noter l’état.</strong> Dans les 24 heures, tu peux signaler des défauts avec photo. Ensuite, c’est l’état indiqué dans l’annonce qui vaut.</li>
          <li><strong>Lire.</strong> Nous te le rappelons 5 jours et 1 jour avant l’échéance.</li>
          <li><strong>Retour.</strong> À nouveau avec un scan. La personne qui a prêté vérifie le livre et peut signaler un dommage dans les 48 heures.</li>
          <li><strong>Clôture.</strong> Sans signalement, le prêt est terminé et le livre de nouveau disponible. Chacun peut dire d’un geste : « Volontiers à nouveau » ou « Il y a eu un problème ».</li>
        </ol>
        <p>C’est la personne qui prête qui décide : qui emprunte, pour combien de temps et où se fait la remise. La plateforme fixe seulement des standards et des plafonds.</p>
      </DocSection>

      <DocSection id="uebergabe" title="Remise et retour">
        <p>
          La personne qui remet le livre ouvre la transaction et affiche un code QR. La personne qui le reçoit le scanne avec la caméra dans le navigateur.
          Le code est valable 10 minutes. En dessous figurent six chiffres : si la caméra ne veut pas, tu les saisis.
        </p>
        <p>Si aucun scan ne fonctionne, il existe trois possibilités :</p>
        <DocTable head={["Possibilité", "Déroulement", "Garantie"]} rows={[
          ["Déclaration unilatérale", "Une partie touche « Remis » ou « Rendu ». L’autre est invitée à confirmer.", "48 heures pour s’opposer, ensuite la déclaration est valable. Rappel après 24 heures."],
          ["Dépôt", "Boîte à lait, boîte aux lettres ou entrée de l’immeuble : la personne qui remet dépose le livre et ajoute une photo du dépôt. L’autre confirme le retrait.", "Photo horodatée, 48 heures pour s’opposer. Seulement si la personne qui prête autorise le dépôt."],
          ["Pas de rencontre", "Personne ne déclare rien, le rendez-vous passe.", "La transaction reste ouverte et expire 7 jours après le début prévu."],
        ]} />
        <p>
          Le délai d’opposition te protège aussi en tant qu’emprunteuse ou emprunteur : qui ne confirme pas un retour effectué ne peut pas garder le prêt ouvert.
        </p>
        <p>
          <strong>Lieux de remise.</strong> La personne qui prête définit jusqu’à trois lieux, par exemple « Gare de Bülach, kiosque ». Avant l’acceptation, tu ne vois que cette désignation.
          La transaction n’affiche le lieu exact qu’après l’acceptation. Leihregal n’affiche jamais d’adresse.
        </p>
      </DocSection>

      <DocSection id="fristen" title="Délais et rappels">
        <p>La plupart des retours tardifs sont des oublis, pas de la mauvaise volonté. C’est pourquoi tout va lentement, avec des rappels plutôt que des sanctions.</p>
        <DocTable head={["Moment", "Ce qui se passe"]} rows={[
          ["5 jours avant", "Rappel avec les boutons « Prolonger » et « Planifier le retour »."],
          ["1 jour avant", "Deuxième rappel."],
          ["Échéance", "Statut « en retard ». Avis aux deux parties, proposition de date dans le chat."],
          ["+ 3 jours", "Rappel par e-mail. Le délai de grâce prend fin, le prêt compte comme en retard."],
          ["+ 7 jours", "Plus de nouvelles demandes jusqu’au retour du livre. La personne qui prête peut ouvrir un litige."],
          ["+ 21 jours", "Le litige est ouvert automatiquement."],
        ]} />
        <p>Chaque action en suspens a un délai et une conséquence fixe. Rien ne reste bloqué.</p>
      </DocSection>

      <DocSection id="verlaengern" title="Prolonger et rappeler">
        <DocTable head={["Règle", "Standard", "Au choix de la personne qui prête"]} rows={[
          ["Durée du prêt", "28 jours", "14, 28, 42 ou 56 jours, par étagère ou par livre"],
          ["Prolongation", "1 × de 14 jours, automatiquement si le calendrier est libre ensuite", "Seulement sur demande, jusqu’à 2 prolongations"],
          ["Avec prêt suivant", "Au plus jusqu’à la marge avant le prêt suivant", "–"],
          ["Rappel", "Au plus tôt après 14 jours, retour dans les 7 jours", "Impossible à désactiver : c’est son livre"],
          ["Rendre plus tôt", "À tout moment", "–"],
        ]} />
      </DocSection>

      <DocSection id="termin" title="Prêt réservé et calendrier des prêts">
        <p>
          Tu peux réserver un livre pour plus tard, même s’il est actuellement prêté. Chaque exemplaire a un calendrier des prêts :
          chaque prêt apparaît comme une barre sur une ligne du temps. Tu touches directement une période libre, la demande s’ouvre avec cette date.
        </p>
        <ul>
          <li>On peut réserver jusqu’à 90 jours à l’avance, selon le livre de 30 à 180 jours.</li>
          <li>Entre deux prêts, il y a 3 jours de marge pour le retour et la remise suivante.</li>
          <li>La remise est possible de 3 jours avant à 7 jours après le début prévu.</li>
          <li>Les autres ne voient que libre ou réservé, aucun nom.</li>
        </ul>
        <p>
          Si le livre revient plus tôt, on te propose de commencer plus tôt. Si le retour avant ton prêt est en retard, tu choisis :
          décaler la période, emprunter moins longtemps ou annuler sans pénalité.
        </p>
        <p>
          Tu peux annuler à tout moment jusqu’à la remise. Moins de 48 heures avant le début, cela compte dans tes chiffres comme un prêt en retard.
        </p>
      </DocSection>

      <DocSection id="weitergabe" title="Transmission directe">
        <p>
          Quand deux prêts se suivent, le livre peut passer directement de la première à la deuxième personne, sans repasser par la personne qui prête.
          Cela économise deux rencontres. Cela ne se fait que si les trois ont donné leur accord.
        </p>
        <ol>
          <li>On demande à la personne qui prête si elle veut transmettre directement. Elle peut le fixer à l’avance par livre : jamais, sur demande, toujours.</li>
          <li>Ensuite, les deux emprunteurs donnent leur accord. La transmission n’est valable qu’avec trois accords.</li>
          <li>Le lieu et l’heure se fixent à trois dans le chat de remise.</li>
          <li>Un scan termine le premier prêt et lance le second au même moment.</li>
          <li>La personne qui reprend le livre note l’état avec photo dans les 24 heures. C’est obligatoire ici : les défauts que tu ne signales pas sont sous ta responsabilité.</li>
        </ol>
        <p>
          Chaque prêt reste un accord avec la personne qui prête. La première personne est responsable jusqu’au scan, la seconde à partir du scan.
          Leihregal ne transmet jamais numéro de téléphone ni adresse. Si la transmission échoue, le livre revient normalement, le délai est prolongé de 3 jours.
        </p>
      </DocSection>

      <DocSection id="tausch" title="Échanger et donner">
        <p>L’échange et le don sont des changements de propriétaire définitifs. Ils se déroulent comme un prêt, mais sans retour.</p>
        <DocSub>Échange 1:1</DocSub>
        <p>
          Tu demandes un livre à échanger et proposes 1 à 5 livres de ton étagère. L’autre partie en choisit un ou refuse.
          À la remise, chaque partie scanne le code de l’autre, les deux scans dans les 10 minutes. Il n’y a ni compensation ni points :
          c’est à vous de juger si un livre de poche contre un beau livre est équitable.
        </p>
        <DocSub>Donner</DocSub>
        <p>
          Demande, acceptation, remise avec scan, terminé. S’il y a plusieurs demandes, tu choisis librement. Les livres reçus en cadeau peuvent être redonnés ou échangés au plus tôt après 30 jours.
        </p>
        <DocSub>Garder au lieu de rendre</DocSub>
        <p>Si un livre emprunté te plaît, tu peux proposer de le garder et de donner un de tes livres en échange. Si la personne qui prête accepte, le prêt devient un échange.</p>
      </DocSection>

      <DocSection id="stufen" title="Niveaux de confiance et limites">
        <p>Les nouveaux membres peuvent emprunter tout de suite, mais peu. Cela limite les abus sans exclure les personnes honnêtes.</p>
        <DocTable head={["Niveau", "Condition", "Prêts chez des inconnus", "Demandes ouvertes"]} rows={[
          ["Nouveau", "E-mail et numéro de mobile confirmés", "2 à la fois", "3"],
          ["Confirmé", "3 prêts terminés, tous à l’heure", "5 à la fois", "6"],
          ["De confiance", "10 prêts terminés, aucune perte en 12 mois", "10 à la fois", "10"],
        ]} />
        <ul>
          <li>Les prêts au sein d’un cercle ne comptent pas dans la limite.</li>
          <li>La personne qui prête peut fixer par étagère : « tout le monde », « dès Confirmé » ou « seulement mes cercles ».</li>
          <li>Ton profil affiche le niveau et trois chiffres : prêtés, empruntés, rendus à temps. Pas d’étoiles, pas de points.</li>
        </ul>
      </DocSection>

      <DocSection id="schaden" title="Traces de lecture ou dommage">
        <p>
          <strong>Les traces de lecture normales ne sont pas un dommage.</strong> Un livre qui a été lu en porte les marques. La comparaison se fait toujours avec l’état indiqué dans l’annonce
          et avec la note d’état prise lors de la remise.
        </p>
        <DocCompare
          left={{ title: "Trace de lecture – pas un dommage", items: [
            "Pli de lecture au dos d’un livre de poche",
            "Coins et bords légèrement émoussés",
            "Couverture un peu gondolée ou frottée",
            "Pages jaunies par la lumière et l’âge",
            "Quelques légers plis aux coins des pages",
            "Marque d’un marque-page",
          ] }}
          right={{ title: "Dommage", items: [
            "Tache d’eau ou de café, pages gondolées",
            "Pages déchirées, arrachées ou manquantes",
            "Pages qui se détachent de la reliure",
            "Nouveaux soulignements, notes ou surligneur",
            "Couverture déchirée, jaquette manquante",
            "Taches de brûlure ou de moisissure, forte odeur de fumée, traces de morsure",
          ] }}
        />
        <DocSub>Si quelque chose est arrivé</DocSub>
        <p>
          La personne qui prête signale un dommage dans les 48 heures suivant le retour, avec photo. Tu choisis l’une des trois réponses :
          remplacement par un exemplaire identique, remplacement par un autre livre au choix de la personne qui prête, ou contestation.
          En cas de contestation, la modération décide sur la base des photos et de l’historique.
        </p>
      </DocSection>

      <DocSection id="streitfall" title="Quand un livre ne revient pas">
        <p>
          Au plus tard 21 jours après l’échéance, un litige est ouvert. Dès lors, un déroulement fixe s’applique. La personne qui emprunte a trois possibilités :
          indiquer une date de retour, proposer un remplacement ou proposer de garder le livre et d’en donner un des siens.
        </p>
        <DocTable head={["Jour depuis l’ouverture", "Ce qui se passe"]} rows={[
          ["0", "Le litige est ouvert. Les trois possibilités figurent dans la transaction."],
          ["7", "Sans réaction : deuxième rappel par e-mail et SMS."],
          ["14", "Sans réaction : les prêts et échanges sont bloqués. La modération examine le cas."],
          ["30", "Le litige est clos comme « perdu ». Le livre quitte l’étagère. La perte reste visible sur le profil pendant 24 mois."],
        ]} />
        <p>
          Une perte peut être réglée après coup : si le livre revient ou est remplacé, l’inscription et le blocage disparaissent.
          Leihregal ne peut pas récupérer de livre ni payer de dommage. Il veille à ce que le chemin soit le même et prévisible pour les deux.
        </p>
      </DocSection>

      <DocSection id="treffen" title="Se rencontrer en sécurité">
        <ul>
          <li>Retrouvez-vous dans des lieux publics : gare, bibliothèque, café. En journée si possible.</li>
          <li>Le dépôt est une alternative sans rencontre, si la personne qui prête l’autorise.</li>
          <li>Avant l’acceptation, personne ne voit de lieu exact. Leihregal n’affiche jamais d’adresse.</li>
          <li>Tu ne partages ton numéro ou ton adresse que si tu le veux, toi-même dans le chat.</li>
          <li>Si quelque chose te semble bizarre : signale la personne ou bloque-la d’un geste. Les personnes bloquées ne voient plus ton étagère.</li>
        </ul>
        <p>Plus de détails dans les <Link href="/regeln">règles</Link>.</p>
      </DocSection>

      <DocSection id="alter" title="Âge minimum">
        <p>
          Pour avoir ton propre compte, tu dois avoir au moins 16 ans. Les livres pour enfants sont empruntés par les parents. Ainsi, les rencontres entre inconnus et enfants sont exclues.
        </p>
      </DocSection>
    </>
  ),
};
