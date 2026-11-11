/**
 * QR-Übergabe (PRD 4.3): Die abgebende Person zeigt einen Code mit einmaligem Token,
 * 10 Minuten gültig. Darunter sechs Ziffern als Ersatz, falls die Kamera nicht will.
 */
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import { hashToken, randomToken, sixDigits } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/auth/session";
import { getLoan, type LoanRow } from "./core";
import { executeHandover, executeReturn } from "./service";
import { executePassOn } from "./passon";
import { logEvent } from "./core";

export type Direction = "handover" | "return" | "swap_owner" | "swap_borrower" | "pass_on";

/** Wer zeigt den Code für welche Richtung? */
function showerFor(loan: LoanRow, direction: Direction, prev?: LoanRow | null) {
  switch (direction) {
    case "handover":
    case "swap_owner":
      return loan.owner_id;
    case "return":
    case "swap_borrower":
      return loan.borrower_id;
    case "pass_on":
      return prev?.borrower_id ?? null;
  }
}

function scannerFor(loan: LoanRow, direction: Direction) {
  switch (direction) {
    case "handover":
    case "swap_owner":
    case "pass_on":
      return loan.borrower_id;
    case "return":
    case "swap_borrower":
      return loan.owner_id;
  }
}

/** Welche Richtung passt zum aktuellen Stand? */
export function directionFor(loan: LoanRow, userId: string, prev?: LoanRow | null): Direction | null {
  if (loan.status === "accepted") {
    if (loan.kind === "swap") {
      if (userId === loan.owner_id && !loan.swap_scan_owner_at) return "swap_owner";
      if (userId === loan.borrower_id && !loan.swap_scan_borrower_at) return "swap_borrower";
      return null;
    }
    if (loan.received_from_loan_id && prev && prev.borrower_id === userId && prev.status === "active") return "pass_on";
    if (userId === loan.owner_id && !loan.received_from_loan_id) return "handover";
    return null;
  }
  if ((loan.status === "active" || loan.status === "disputed") && userId === loan.borrower_id && loan.kind === "lend") return "return";
  return null;
}

export async function createToken(user: SessionUser, loanId: string) {
  return sql.begin(async (tx) => {
    const loan = await getLoan(tx, loanId);
    if (!loan) throw err.notFound();
    const prev = loan.received_from_loan_id ? await getLoan(tx, loan.received_from_loan_id) : null;
    const direction = directionFor(loan, user.id, prev);
    if (!direction || showerFor(loan, direction, prev) !== user.id)
      throw err.conflict("no_code", "Für diesen Schritt zeigt die andere Person den Code.");

    const token = randomToken(18);
    const code = sixDigits();
    // Ältere, nicht eingelöste Codes desselben Schritts werden ungültig
    await tx`update handover_tokens set valid_until = now() where loan_id = ${loanId} and direction = ${direction}
              and redeemed_at is null and valid_until > now()`;
    const [row] = await tx<{ valid_until: Date }[]>`
      insert into handover_tokens (loan_id, direction, token_hash, code_hash, created_by, valid_until)
      values (${loanId}, ${direction}, ${hashToken(token)}, ${hashToken(`${loanId}:${code}`)}, ${user.id}, now() + interval '10 minutes')
      returning valid_until`;
    return { url: `${env.appUrl}/h/${token}`, token, code, direction, validUntil: row.valid_until };
  });
}

type TokenRow = { id: string; loan_id: string; direction: Direction; valid_until: Date; redeemed_at: Date | null; created_by: string; attempts: number };

/** Einlösen per Scan (Token aus dem QR-Code) */
export async function redeemToken(user: SessionUser, token: string) {
  return sql.begin(async (tx) => {
    const [t] = await tx<TokenRow[]>`
      select id, loan_id, direction, valid_until, redeemed_at, created_by, attempts from handover_tokens
       where token_hash = ${hashToken(token)} for update`;
    if (!t) throw err.notFound("Dieser Code ist unbekannt. Bitte die andere Person, den Code neu zu öffnen.");
    return redeem(tx, user, t, "scan");
  });
}

/** Einlösen per sechs Ziffern */
export async function redeemCode(user: SessionUser, loanId: string, code: string) {
  return sql.begin(async (tx) => {
    const tokens = await tx<TokenRow[]>`
      select id, loan_id, direction, valid_until, redeemed_at, created_by, attempts from handover_tokens
       where loan_id = ${loanId} and redeemed_at is null and valid_until > now() for update`;
    if (!tokens.length) throw err.conflict("no_code", "Es ist gerade kein Code offen. Bitte die andere Person, den Code anzuzeigen.");
    const [hit] = await tx<TokenRow[]>`
      select id, loan_id, direction, valid_until, redeemed_at, created_by, attempts from handover_tokens
       where loan_id = ${loanId} and code_hash = ${hashToken(`${loanId}:${code.replace(/\D/g, "")}`)}
         and redeemed_at is null and valid_until > now() and attempts < 5`;
    if (!hit) {
      await tx`update handover_tokens set attempts = attempts + 1 where id in ${tx(tokens.map((t) => t.id))}`;
      throw err.invalid("Die Ziffern stimmen nicht. Prüfe sie und versuche es erneut.");
    }
    return redeem(tx, user, hit, "code");
  });
}

async function redeem(tx: postgres.TransactionSql, user: SessionUser, t: TokenRow, method: "scan" | "code") {
  if (t.redeemed_at) throw err.conflict("used", "Dieser Code wurde bereits verwendet.");
  if (t.valid_until < new Date()) throw err.conflict("expired", "Dieser Code ist abgelaufen. Bitte die andere Person, ihn neu zu öffnen.");
  const loan = await getLoan(tx, t.loan_id, true);
  if (!loan) throw err.notFound();
  if (scannerFor(loan, t.direction) !== user.id || t.created_by === user.id)
    throw err.forbidden("Diesen Code muss die andere beteiligte Person scannen.");

  await tx`update handover_tokens set redeemed_at = now(), redeemed_by = ${user.id} where id = ${t.id}`;

  switch (t.direction) {
    case "handover": {
      const role = user.id === loan.owner_id ? "owner" : "borrower";
      const l = await executeHandover(tx, loan.id, "handover", { role, id: user.id }, method);
      return { loanId: l.id, status: l.status, direction: t.direction };
    }
    case "return": {
      const l = await executeReturn(tx, loan.id, "return", { role: "owner", id: user.id });
      return { loanId: l.id, status: l.status, direction: t.direction };
    }
    case "pass_on": {
      const r = await executePassOn(tx, loan.received_from_loan_id!, loan.id, t.created_by, user.id);
      return { loanId: r.started_loan, status: "active", direction: t.direction };
    }
    case "swap_owner":
    case "swap_borrower": {
      // Beide Scans müssen innert 10 Minuten erfolgen (5.1)
      const col = t.direction === "swap_owner" ? "swap_scan_owner_at" : "swap_scan_borrower_at";
      const other = t.direction === "swap_owner" ? loan.swap_scan_borrower_at : loan.swap_scan_owner_at;
      if (other && other > new Date(Date.now() - 10 * 60_000)) {
        await tx`update loans set ${tx(col)} = now() where id = ${loan.id}`;
        const role = user.id === loan.owner_id ? "owner" : "borrower";
        const l = await executeHandover(tx, loan.id, "handover", { role, id: user.id }, method);
        return { loanId: l.id, status: l.status, direction: t.direction };
      }
      const otherCol = t.direction === "swap_owner" ? "swap_scan_borrower_at" : "swap_scan_owner_at";
      // Ein älterer erster Scan zählt nicht mehr; beide beginnen von vorn
      await tx`update loans set ${tx(col)} = now(), ${tx(otherCol)} = null where id = ${loan.id}`;
      await logEvent(tx, loan.id, user.id, "swap_scan", "accepted", "accepted", { direction: t.direction });
      return { loanId: loan.id, status: "accepted", direction: t.direction, waitingForOther: true };
    }
  }
}
