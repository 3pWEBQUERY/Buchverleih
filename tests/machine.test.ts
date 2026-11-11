/**
 * Ein Test pro erlaubtem und pro verbotenem Wechsel (PRD 10.4).
 * Die Erwartung ist unabhängig von der Implementierung als Tabelle notiert.
 */
import { describe, expect, it } from "vitest";
import { ACTORS, ACTIONS, LOAN_STATUSES, OFFER_KINDS, can, type Action, type Actor, type LoanStatus, type OfferKind } from "@/lib/loans/machine";

type Row = [Action, LoanStatus[], Actor[], OfferKind[], LoanStatus | { lend: LoanStatus; other: LoanStatus }];
const L: OfferKind[] = ["lend"];
const A: OfferKind[] = ["lend", "swap", "gift"];

const EXPECTED: Row[] = [
  ["accept", ["requested"], ["owner"], A, "accepted"],
  ["auto_accept", ["requested"], ["system"], A, "accepted"],
  ["decline", ["requested"], ["owner"], A, "declined"],
  ["withdraw", ["requested"], ["borrower"], A, "withdrawn"],
  ["expire_request", ["requested"], ["system"], A, "expired"],
  ["cancel", ["accepted"], ["owner", "borrower"], A, "cancelled"],
  ["expire_handover", ["accepted"], ["system"], A, "expired"],
  ["report_handover", ["accepted"], ["owner", "borrower"], A, "accepted"],
  ["dropoff", ["accepted"], ["owner"], ["lend", "gift"], "accepted"],
  ["object_handover", ["accepted"], ["owner", "borrower"], A, "accepted"],
  ["swap_scan", ["accepted"], ["owner", "borrower"], ["swap"], "accepted"],
  ["handover", ["accepted"], ["owner", "borrower"], A, { lend: "active", other: "completed" }],
  ["confirm_handover", ["accepted"], ["owner", "borrower"], A, { lend: "active", other: "completed" }],
  ["handover_report_lapse", ["accepted"], ["system"], A, { lend: "active", other: "completed" }],
  ["condition_note", ["active"], ["borrower"], L, "active"],
  ["extend", ["active"], ["borrower"], L, "active"],
  ["request_extension", ["active"], ["borrower"], L, "active"],
  ["grant_extension", ["active"], ["owner"], L, "active"],
  ["recall", ["active"], ["owner"], L, "active"],
  ["offer_swap", ["active"], ["borrower"], L, "active"],
  ["convert_to_swap", ["active", "disputed"], ["owner"], L, "completed"],
  ["return", ["active", "disputed"], ["owner"], L, "returned"],
  ["report_return", ["active", "disputed"], ["borrower"], L, "return_reported"],
  ["confirm_return", ["return_reported"], ["owner"], L, "returned"],
  ["object_return", ["return_reported"], ["owner"], L, "active"],
  ["return_report_lapse", ["return_reported"], ["system"], L, "returned"],
  ["pass_on", ["active"], ["borrower"], L, "returned"],
  ["complete", ["returned"], ["owner", "system"], L, "completed"],
  ["report_damage", ["returned"], ["owner"], L, "disputed"],
  ["open_case", ["active"], ["owner"], L, "disputed"],
  ["auto_open_case", ["active"], ["system"], L, "disputed"],
  ["resolve_case", ["disputed"], ["owner", "moderator"], L, "completed"],
  ["mark_lost", ["disputed"], ["system", "moderator"], L, "lost"],
  ["clear_loss", ["lost"], ["owner", "moderator"], L, "completed"],
];

describe("Zustandsmaschine", () => {
  it("die Erwartungstabelle deckt jede Handlung ab", () => {
    expect(EXPECTED.map((r) => r[0]).sort()).toEqual([...ACTIONS].sort());
  });

  for (const [action, froms, actors, kinds, to] of EXPECTED) {
    for (const from of LOAN_STATUSES) {
      for (const actor of ACTORS) {
        for (const kind of OFFER_KINDS) {
          const allowed = froms.includes(from) && actors.includes(actor) && kinds.includes(kind);
          const target = typeof to === "string" ? to : kind === "lend" ? to.lend : to.other;
          it(`${allowed ? "erlaubt" : "verboten"}: ${action} · ${kind} · ${from} · ${actor}`, () => {
            const r = can(action, from, actor, kind);
            expect(r.ok).toBe(allowed);
            if (r.ok) expect(r.to).toBe(target);
          });
        }
      }
    }
  }

  it("Endzustände haben keine Ausgänge ausser Verlust bereinigen", () => {
    for (const s of ["completed", "declined", "withdrawn", "expired", "cancelled"] as LoanStatus[]) {
      for (const a of ACTIONS) for (const actor of ACTORS) for (const k of OFFER_KINDS) expect(can(a, s, actor, k).ok).toBe(false);
    }
  });
});
