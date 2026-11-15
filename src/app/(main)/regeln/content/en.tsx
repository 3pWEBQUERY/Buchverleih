import Link from "next/link";
import { DocSection } from "@/components/doc";
import type { RulesContent } from "./types";

/** Rules in English */
export const RULES_EN: RulesContent = {
  title: "Rules",
  description: "Leihregal’s community rules: borrow for free, be on time, stay respectful.",
  eyebrow: "Community",
  heading: ["Rules. ", "Short and for everyone."],
  lead: "Leihregal works because people trust each other with their books. These rules keep that trust. They’re short, and they apply to everyone.",
  toc: [
    ["kostenlos", "Borrowing is free"],
    ["preise", "No prices in the chat"],
    ["puenktlich", "Be on time"],
    ["sorgfalt", "Take care of books"],
    ["respekt", "Respect in the chat"],
    ["fotos", "Photos and profile picture"],
    ["konto", "One person, one account"],
    ["melden", "Reporting and blocking"],
    ["folgen", "When someone breaks the rules"],
  ],
  summary: {
    eyebrow: "In short",
    title: "Four things everyone can rely on",
    items: [
      ["Free", "Lend, swap, give away. Never sell, no prices in the chat.", "#kostenlos"],
      ["On time", "Keep to arrangements, return books in time, reply to requests.", "#puenktlich"],
      ["Careful", "Read someone else’s book as it’s meant to be read: no notes, no passing it on.", "#sorgfalt"],
      ["Respectful", "Write kindly, accept a no, meet in public.", "#respekt"],
    ],
  },
  body: (
    <>
      <DocSection id="kostenlos" title="Borrowing is free">
        <p>
          Books here are lent, swapped or given away, never sold. No fee, no deposit, no tip as a condition.
          If you want to sell books, this isn’t the place. Commercial sellers are excluded.
        </p>
        <p>
          This isn’t just a principle: as soon as money changes hands for a loan, it’s legally no longer a loan.
        </p>
      </DocSection>

      <DocSection id="preise" title="No prices in the chat">
        <p>
          The chat is for the place, the time and the book. Don’t mention prices or make offers to buy, not even “just to be safe”.
          Leihregal automatically flags messages with prices for review by moderation.
        </p>
      </DocSection>

      <DocSection id="puenktlich" title="Be on time">
        <ul>
          <li>Turn up at the agreed time. If you can’t, cancel early or suggest a new time.</li>
          <li>Return books by the end of the loan period, or extend in good time.</li>
          <li>Reply to requests within three days. Declining is fine, silence costs others time.</li>
        </ul>
        <p>Punctuality appears as a figure on your profile. It’s what others rely on.</p>
      </DocSection>

      <DocSection id="sorgfalt" title="Take care of books">
        <p>
          Read the book the way you’d read someone else’s: no notes, no underlining, not in the bath.
          Normal signs of reading are no problem. What counts as damage is explained in the <Link href="/hilfe#schaden">help</Link>.
        </p>
        <p>
          Don’t pass a borrowed book on to others. The only exception is passing on directly, when the lender has explicitly agreed.
        </p>
      </DocSection>

      <DocSection id="respekt" title="Respect in the chat">
        <p>
          Write the way you’d talk to a stranger at the station. No insults, no harassment, no pressure.
          No means no, even without a reason.
        </p>
        <p>
          You only share your phone number and address if you want to. Don’t ask for them. Meet in public places.
        </p>
      </DocSection>

      <DocSection id="fotos" title="Photos and profile picture">
        <p>
          Photos show books: the cover, the condition, a flaw, the drop-off at the handover. No people, no advertising, nothing that isn’t about the book.
        </p>
        <p>
          The only exception is your profile picture. It’s optional and shows you or something that stands for you. No other people without their consent,
          no advertising, nothing offensive. Moderation removes unsuitable profile pictures.
        </p>
      </DocSection>

      <DocSection id="konto" title="One person, one account">
        <p>
          Every account belongs to one person aged 16 or over, with their own mobile number. One number, one account. Second accounts are blocked.
        </p>
      </DocSection>

      <DocSection id="melden" title="Reporting and blocking">
        <p>
          If something isn’t right, report it: a message, a photo, a profile or a book. Moderation sees every report.
          It only reads a loan’s chat when there’s a report or an open case, and every access is logged.
        </p>
        <p>
          Blocking takes one tap. People you block can no longer see your shelf or send you requests.
          You can undo it any time in <Link href="/einstellungen#blockiert">settings</Link>.
        </p>
      </DocSection>

      <DocSection id="folgen" title="When someone breaks the rules">
        <p>
          Moderation decides based on the history and the photos. Depending on the case, it sends a reminder, blocks lending or blocks the account.
          When an account is blocked, the mobile number is blocked too. If you think a block is wrong, reply to the email that told you about it.
        </p>
      </DocSection>
    </>
  ),
};
