import { fmtDayTime } from "@/lib/dates";
import { statusLabel } from "@/lib/i18n/de-CH";
import type { LoanStatus } from "@/lib/loans/machine";

/** Lückenloser Verlauf (PRD 9.1: loan_events) – lesbar formuliert */
const ACTION: Record<string, string> = {
  request: "hat angefragt",
  accept: "hat angenommen",
  auto_accept: "Im Kreis automatisch angenommen",
  decline: "hat abgelehnt",
  withdraw: "hat die Anfrage zurückgezogen",
  expire_request: "Anfrage nach 72 Stunden verfallen",
  cancel: "hat storniert",
  expire_handover: "Keine Übergabe innert 7 Tagen, verfallen",
  report_handover: "hat die Übergabe gemeldet",
  dropoff: "hat das Buch in der Ablage hinterlegt",
  object_handover: "hat der Übergabemeldung widersprochen",
  handover: "Übergabe per Code bestätigt",
  confirm_handover: "hat die Übergabe bestätigt",
  handover_report_lapse: "Übergabe gilt nach 48 Stunden ohne Einspruch",
  swap_scan: "hat den Tauschcode gescannt",
  condition_note: "hat den Zustand festgehalten",
  extend: "hat verlängert",
  request_extension: "hat um Verlängerung gebeten",
  grant_extension: "hat die Verlängerung gewährt",
  recall: "hat das Buch zurückgerufen",
  offer_swap: "bietet einen Tausch an",
  convert_to_swap: "Leihe als Tausch abgeschlossen",
  return: "Rückgabe per Code bestätigt",
  report_return: "hat die Rückgabe gemeldet",
  confirm_return: "hat die Rückgabe bestätigt",
  object_return: "hat der Rückgabemeldung widersprochen",
  return_report_lapse: "Rückgabe gilt nach 48 Stunden ohne Einspruch",
  pass_on: "hat direkt weitergegeben",
  complete: "Abgeschlossen",
  report_damage: "hat einen Schaden gemeldet",
  open_case: "hat einen Fall eröffnet",
  auto_open_case: "Fall nach 21 Tagen automatisch eröffnet",
  resolve_case: "Fall gelöst",
  mark_lost: "Als verloren geschlossen",
  clear_loss: "Verlust bereinigt",
  pass_on_consent: "hat der direkten Weitergabe zugestimmt",
  pass_on_declined: "hat die direkte Weitergabe abgelehnt",
  pass_on_agreed: "Direkte Weitergabe vereinbart",
  pass_on_broken: "Weitergabe geplatzt, Frist um 3 Tage verlängert",
  start_earlier: "beginnt früher",
  reschedule: "hat den Zeitraum verschoben",
  copy_removed: "Buch wurde aus dem Regal genommen",
};

export function History({ events }: { events: { id: number; action: string; to_status: string; actor_name: string | null; actor_id: string | null; created_at: Date }[] }) {
  return (
    <ol className="border-l border-line ml-1 space-y-3">
      {events.map((e) => {
        const text = ACTION[e.action] ?? statusLabel[e.to_status as LoanStatus];
        const system = !e.actor_id;
        return (
          <li key={e.id} className="pl-4 relative text-[15px]">
            <span aria-hidden className="absolute -left-[3px] top-2 h-[5px] w-[5px] rounded-full bg-line-strong" />
            <span>{system || /^[A-ZÜÄÖ]/.test(text) ? text : `${e.actor_name} ${text}`}</span>
            <span className="text-muted text-sm"> · {fmtDayTime(e.created_at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
