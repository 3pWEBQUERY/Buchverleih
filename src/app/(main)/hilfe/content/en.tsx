import Link from "next/link";
import { DocCompare, DocSection, DocSub, DocTable } from "@/components/doc";
import type { HelpContent } from "./types";

/** Help in English */
export const HELP_EN: HelpContent = {
  title: "How it works",
  description: "How borrowing, handover, deadlines, swaps and cases work on Leihregal.",
  eyebrow: "Help",
  heading: ["How it ", "works."],
  lead: "You borrow books from shelves near you, for free. Every loan has fixed steps and deadlines, so both sides always know whose turn it is.",
  toc: [
    ["ablauf", "A loan step by step"],
    ["uebergabe", "Handover and return"],
    ["fristen", "Deadlines and reminders"],
    ["verlaengern", "Extending and recalling"],
    ["termin", "Booking ahead and the lending calendar"],
    ["weitergabe", "Passing on directly"],
    ["tausch", "Swapping and giving away"],
    ["stufen", "Trust levels and limits"],
    ["schaden", "Signs of reading or damage"],
    ["streitfall", "When a book doesn’t come back"],
    ["treffen", "Meeting safely"],
    ["alter", "Minimum age"],
  ],
  quick: {
    eyebrow: "Quick start",
    title: "Your first book in four steps",
    note: "The details are further down.",
    steps: [
      ["01", "Find", "Search by title, author or ISBN, or browse the shelves within 5 km.", "/suche", "Find books"],
      ["02", "Request", "Choose a copy and the dates. The lender replies within 72 hours.", "#ablauf", "How it goes"],
      ["03", "Hand over", "You meet, and a scan of the QR code confirms the handover. From then on, the loan period runs.", "#uebergabe", "Handover"],
      ["04", "Return", "The standard is 28 days. We remind you, and extending takes one tap.", "#fristen", "Deadlines"],
    ],
  },
  body: (
    <>
      <DocSection id="ablauf" title="A loan step by step">
        <ol>
          <li><strong>Request.</strong> You choose a copy and dates in the lending calendar, from today or later. You can add a short message.</li>
          <li><strong>Reply.</strong> The lender accepts or declines, without giving a reason. Without a reply, the request expires after 72 hours.</li>
          <li><strong>Arrange a time.</strong> In the loan’s chat, you suggest a place and time. A suggestion can be accepted with one tap.</li>
          <li><strong>Handover.</strong> A scan of the QR code confirms the handover. From then on, the loan period runs.</li>
          <li><strong>Note the condition.</strong> Within 24 hours you can note any flaws with a photo. After that, the condition in the listing applies.</li>
          <li><strong>Read.</strong> We remind you 5 days and 1 day before the end.</li>
          <li><strong>Return.</strong> Again with a scan. The lender checks the book and can report damage within 48 hours.</li>
          <li><strong>Done.</strong> Without a report, the loan is complete and the book is available again. Both of you can say with one tap: “Happy to again” or “There were problems”.</li>
        </ol>
        <p>The lender decides who borrows, for how long and where the handover happens. The platform only sets standards and upper limits.</p>
      </DocSection>

      <DocSection id="uebergabe" title="Handover and return">
        <p>
          The person handing over opens the loan and shows a QR code. The person receiving scans it with the camera in the browser.
          The code is valid for 10 minutes. Below it are six digits: if the camera won’t work, type them in.
        </p>
        <p>If scanning doesn’t work, there are three ways:</p>
        <DocTable head={["Way", "How it works", "Safeguard"]} rows={[
          ["Report from one side", "One side taps “Handed over” or “Returned”. The other is asked to confirm.", "48 hours to object, after which the report stands. Reminder after 24 hours."],
          ["Drop-off", "Milk box, letterbox or hallway: the person handing over leaves the book and uploads a photo of the drop-off. The other confirms they’ve collected it.", "Photo with timestamp, 48 hours to object. Only if the lender allows drop-offs."],
          ["No meeting", "Nobody reports anything, and the date passes.", "The loan stays open and expires 7 days after the planned start."],
        ]} />
        <p>
          The time to object protects you as a borrower too: anyone who doesn’t confirm a return that has happened can’t keep the loan open.
        </p>
        <p>
          <strong>Handover places.</strong> The lender sets up to three places, such as “Bülach station, kiosk”. Before acceptance, you only see this name.
          The loan shows the exact place only after acceptance. Leihregal never shows an address.
        </p>
      </DocSection>

      <DocSection id="fristen" title="Deadlines and reminders">
        <p>Most late returns are forgetfulness, not bad intent. That’s why things move slowly, with reminders instead of penalties.</p>
        <DocTable head={["When", "What happens"]} rows={[
          ["5 days before", "Reminder with the buttons “Extend” and “Plan return”."],
          ["1 day before", "Second reminder."],
          ["Due date", "Status “overdue”. A note to both, and a suggested time in the chat."],
          ["+ 3 days", "Reminder by email. The grace period ends, and the loan counts as late."],
          ["+ 7 days", "No new requests until the book is back. The lender can open a case."],
          ["+ 21 days", "The case is opened automatically."],
        ]} />
        <p>Every open action has a deadline and a fixed consequence. Nothing is left hanging.</p>
      </DocSection>

      <DocSection id="verlaengern" title="Extending and recalling">
        <DocTable head={["Rule", "Standard", "The lender can choose"]} rows={[
          ["Loan period", "28 days", "14, 28, 42 or 56 days, per shelf or book"],
          ["Extension", "Once by 14 days, automatically, if the calendar is free afterwards", "Only on request, up to 2 extensions"],
          ["With a following loan", "At most until the buffer before the next loan", "–"],
          ["Recall", "After 14 days at the earliest, return within 7 days", "Can’t be switched off: it’s still their book"],
          ["Return early", "Any time", "–"],
        ]} />
      </DocSection>

      <DocSection id="termin" title="Booking ahead and the lending calendar">
        <p>
          You can book a book for later, even if it’s on loan right now. Every copy has a lending calendar:
          each loan sits as a bar on a timeline. Tap a free period directly, and the request opens with those dates.
        </p>
        <ul>
          <li>You can book up to 90 days ahead, or 30 to 180 days depending on the book.</li>
          <li>There’s a 3-day buffer between two loans for the return and the next handover.</li>
          <li>The handover can happen from 3 days before to 7 days after the planned start.</li>
          <li>Others only see free and taken, no names.</li>
        </ul>
        <p>
          If the book comes back early, you’re offered an earlier start. If the return before your loan is late, you choose:
          move your dates, borrow for a shorter time, or cancel at no cost to you.
        </p>
        <p>
          You can cancel any time until the handover. Less than 48 hours before the start, it counts in your figures like a late loan.
        </p>
      </DocSection>

      <DocSection id="weitergabe" title="Passing on directly">
        <p>
          When two loans follow each other, the book can go straight from the first person to the second, without going back to the lender.
          That saves two meetings. It only happens if all three have agreed.
        </p>
        <ol>
          <li>The lender is asked whether they want to pass it on directly. They can set this in advance for each book: never, on request, always.</li>
          <li>Then both borrowers agree. The pass-on only stands with all three agreements.</li>
          <li>You arrange the place and time together in the handover chat.</li>
          <li>One scan ends the first loan and starts the second at the same moment.</li>
          <li>The person taking over notes the condition with a photo within 24 hours. Here it’s required: you’re responsible for any flaws you don’t report.</li>
        </ol>
        <p>
          Every loan remains an agreement with the lender. The first person is responsible until the scan, the second from the scan onwards.
          Leihregal never passes on phone numbers or addresses. If the pass-on falls through, the book goes back as usual, and the loan period is extended by 3 days.
        </p>
      </DocSection>

      <DocSection id="tausch" title="Swapping and giving away">
        <p>Swaps and gifts are permanent changes of ownership. They work like a loan, just without the return.</p>
        <DocSub>Swap 1:1</DocSub>
        <p>
          You request a swap book and offer 1 to 5 books from your shelf. The other side chooses one of them or declines.
          At the handover, each side scans the other’s code, both scans within 10 minutes. There’s no balancing of value and no points:
          whether a paperback for an illustrated book is fair is up to you.
        </p>
        <DocSub>Giving away</DocSub>
        <p>
          Request, acceptance, handover with a scan, done. If there are several requests, you choose freely. Books received as a gift can only be given away again or swapped after 30 days.
        </p>
        <DocSub>Keeping instead of returning</DocSub>
        <p>If you like a book you’ve borrowed, you can offer to keep it and give one of your books in return. If the lender accepts, the loan becomes a swap.</p>
      </DocSection>

      <DocSection id="stufen" title="Trust levels and limits">
        <p>New members can borrow straight away, but only a little. That limits misuse without locking out honest people.</p>
        <DocTable head={["Level", "Requirement", "Loans from strangers", "Open requests"]} rows={[
          ["New", "Email and mobile number confirmed", "2 at a time", "3"],
          ["Proven", "3 completed loans, all on time", "5 at a time", "6"],
          ["Trusted", "10 completed loans, no loss in 12 months", "10 at a time", "10"],
        ]} />
        <ul>
          <li>Loans within a circle don’t count towards the limit.</li>
          <li>The lender can set for each shelf: “everyone”, “from Proven” or “only my circles”.</li>
          <li>Your profile shows your level and three figures: lent, borrowed, returned on time. No stars, no points.</li>
        </ul>
      </DocSection>

      <DocSection id="schaden" title="Signs of reading or damage">
        <p>
          <strong>Normal signs of reading aren’t damage.</strong> A book that has been read looks like it. The comparison is always with the condition in the listing
          and with the condition note made at the handover.
        </p>
        <DocCompare
          left={{ title: "Sign of reading – not damage", items: [
            "Reading crease in the spine of a paperback",
            "Slightly bumped corners and edges",
            "Cover a little wavy or rubbed",
            "Pages yellowed by light and age",
            "A few light folds at page corners",
            "Mark left by a bookmark",
          ] }}
          right={{ title: "Damage", items: [
            "Water or coffee stain, wavy pages",
            "Torn, cut-out or missing pages",
            "Pages coming loose from the binding",
            "New underlining, notes or highlighter",
            "Torn cover, missing dust jacket",
            "Burn or mould marks, strong smell of smoke, bite marks",
          ] }}
        />
        <DocSub>If something did happen</DocSub>
        <p>
          The lender reports damage within 48 hours of the return, with a photo. You choose one of three answers:
          replace it with an identical copy, replace it with another book of the lender’s choice, or object.
          If you object, moderation decides based on the photos and the history.
        </p>
      </DocSection>

      <DocSection id="streitfall" title="When a book doesn’t come back">
        <p>
          A case is opened 21 days after the deadline at the latest. From then on, a fixed process applies. The borrower has three options:
          name a return date, offer a replacement, or suggest keeping the book and giving one of their own in return.
        </p>
        <DocTable head={["Day from opening", "What happens"]} rows={[
          ["0", "The case is open. The three options are in the loan."],
          ["7", "No response: second reminder by email and SMS."],
          ["14", "No response: lending and swapping are blocked. Moderation reviews the case."],
          ["30", "The case is closed as “lost”. The book leaves the shelf. The loss stays visible on the profile for 24 months."],
        ]} />
        <p>
          A loss can be cleared afterwards: if the book comes back or is replaced, the entry and the block disappear.
          Leihregal can’t fetch a book back or pay for damage. It makes sure the process is the same and predictable for both sides.
        </p>
      </DocSection>

      <DocSection id="treffen" title="Meeting safely">
        <ul>
          <li>Meet in public places: a station, a library, a café. In daylight, if you can.</li>
          <li>A drop-off is an alternative without meeting, if the lender allows it.</li>
          <li>Before acceptance, nobody sees an exact place. Leihregal never shows an address.</li>
          <li>You only share your phone number or address if you want to, even in the chat.</li>
          <li>If something feels wrong, report the person or block them with one tap. People you block can no longer see your shelf.</li>
        </ul>
        <p>More on this in the <Link href="/regeln">rules</Link>.</p>
      </DocSection>

      <DocSection id="alter" title="Minimum age">
        <p>
          You need to be at least 16 to have your own account. Parents borrow children’s books. That keeps meetings between strangers and children out of the picture.
        </p>
      </DocSection>
    </>
  ),
};
