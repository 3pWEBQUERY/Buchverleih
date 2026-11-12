import Link from "next/link";
import { DocSection } from "@/components/doc";
import type { RulesContent } from "./types";

/** Règles en français */
export const RULES_FR: RulesContent = {
  title: "Règles",
  description: "Règles de la communauté Leihregal : prêter gratuitement, être ponctuel, rester respectueux.",
  eyebrow: "Communauté",
  heading: ["Règles. ", "Courtes et pour tout le monde."],
  lead: "Leihregal fonctionne parce que des personnes se confient leurs livres. Ces règles entretiennent cette confiance. Elles sont courtes et valent pour tout le monde.",
  toc: [
    ["kostenlos", "Prêter est gratuit"],
    ["preise", "Pas de prix dans le chat"],
    ["puenktlich", "Être ponctuel"],
    ["sorgfalt", "Prendre soin des livres"],
    ["respekt", "Respect dans le chat"],
    ["fotos", "Photos et photo de profil"],
    ["konto", "Une personne, un compte"],
    ["melden", "Signaler et bloquer"],
    ["folgen", "Quand quelqu’un enfreint les règles"],
  ],
  summary: {
    eyebrow: "En bref",
    title: "Quatre choses sur lesquelles tout le monde compte",
    items: [
      ["Gratuit", "Prêter, échanger, donner. Jamais vendre, pas de prix dans le chat.", "#kostenlos"],
      ["Ponctuel", "Respecter les rendez-vous, rendre les livres à temps, répondre aux demandes.", "#puenktlich"],
      ["Soigneux", "Lire le livre d’un autre comme il se doit : sans notes, sans le passer à d’autres.", "#sorgfalt"],
      ["Respectueux", "Écrire aimablement, accepter un non, se retrouver en public.", "#respekt"],
    ],
  },
  body: (
    <>
      <DocSection id="kostenlos" title="Prêter est gratuit">
        <p>
          Ici, les livres sont prêtés, échangés ou donnés, jamais vendus. Pas de frais, pas de caution, pas de pourboire comme condition.
          Qui veut vendre des livres n’est pas au bon endroit. Les vendeurs commerciaux sont exclus.
        </p>
        <p>
          Ce n’est pas seulement une attitude : dès que de l’argent circule pour un prêt, juridiquement ce n’en est plus un.
        </p>
      </DocSection>

      <DocSection id="preise" title="Pas de prix dans le chat">
        <p>
          Le chat sert au lieu, à l’heure et au livre. N’indique pas de prix et ne fais pas d’offres d’achat, même pas « juste au cas où ».
          Leihregal signale automatiquement les messages contenant des prix pour vérification par la modération.
        </p>
      </DocSection>

      <DocSection id="puenktlich" title="Être ponctuel">
        <ul>
          <li>Viens au rendez-vous convenu. Si tu ne peux pas, annule tôt ou propose une nouvelle date.</li>
          <li>Rends les livres avant la fin du délai de prêt, ou prolonge à temps.</li>
          <li>Réponds aux demandes dans les trois jours. Refuser, c’est correct ; le silence fait perdre du temps aux autres.</li>
        </ul>
        <p>La ponctualité figure en chiffres sur ton profil. C’est ce sur quoi les autres comptent.</p>
      </DocSection>

      <DocSection id="sorgfalt" title="Prendre soin des livres">
        <p>
          Lis le livre comme on lit le livre de quelqu’un d’autre : pas de notes, pas de soulignements, pas dans la baignoire.
          Les traces de lecture normales ne posent pas de problème. Ce qui compte comme dommage figure dans l’<Link href="/hilfe#schaden">aide</Link>.
        </p>
        <p>
          Tu ne passes pas un livre emprunté à d’autres. La seule exception est la transmission directe, si la personne qui prête l’a expressément acceptée.
        </p>
      </DocSection>

      <DocSection id="respekt" title="Respect dans le chat">
        <p>
          Écris comme tu parlerais à une personne inconnue à la gare. Pas d’insultes, pas de drague, pas d’insistance.
          Un non est un non, même sans justification.
        </p>
        <p>
          Tu ne partages ton numéro et ton adresse que si tu le veux. Ne les demande pas. Retrouvez-vous dans des lieux publics.
        </p>
      </DocSection>

      <DocSection id="fotos" title="Photos et photo de profil">
        <p>
          Les photos montrent des livres : la couverture, l’état, un défaut, le dépôt lors de la remise. Pas de personnes, pas de publicité, rien qui ne concerne pas le livre.
        </p>
        <p>
          La seule exception est ta photo de profil. Elle est facultative et te montre, toi ou quelque chose qui te représente. Pas d’autres personnes sans leur accord,
          pas de publicité, rien de choquant. La modération retire les photos de profil inappropriées.
        </p>
      </DocSection>

      <DocSection id="konto" title="Une personne, un compte">
        <p>
          Chaque compte appartient à une personne de 16 ans ou plus, avec son propre numéro de mobile. Un numéro, un compte. Les comptes secondaires sont bloqués.
        </p>
      </DocSection>

      <DocSection id="melden" title="Signaler et bloquer">
        <p>
          Si quelque chose ne va pas, signale-le : un message, une photo, un profil ou un livre. La modération voit chaque signalement.
          Elle ne lit le chat d’une transaction qu’en cas de signalement ou de litige ouvert, et chaque accès est enregistré.
        </p>
        <p>
          Bloquer se fait d’un geste. Les personnes bloquées ne voient plus ton étagère et ne peuvent pas te faire de demande.
          Tu peux lever le blocage à tout moment dans les <Link href="/einstellungen#blockiert">paramètres</Link>.
        </p>
      </DocSection>

      <DocSection id="folgen" title="Quand quelqu’un enfreint les règles">
        <p>
          La modération décide sur la base de l’historique et des photos. Selon le cas, elle rappelle à l’ordre, bloque les prêts ou bloque le compte.
          En cas de blocage du compte, le numéro de mobile est aussi bloqué. Qui estime un blocage injustifié répond à l’e-mail qui l’a annoncé.
        </p>
      </DocSection>
    </>
  ),
};
