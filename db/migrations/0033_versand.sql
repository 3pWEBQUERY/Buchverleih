-- Versand (PRD Phase 3), vorerst ohne Etikett-API: Sendungsnummer von Hand, Porto zahlt, wer verschickt.
-- Keine Zahlungen zwischen Mitgliedern (PRD 2, Nicht-Ziele).
alter table copies add column shipping_allowed boolean not null default false;

alter table loans add column delivery text not null default 'pickup' check (delivery in ('pickup', 'shipping'));
alter table loans add column ship_to text check (length(ship_to) <= 300);       -- Adresse der leihenden Person
alter table loans add column return_to text check (length(return_to) <= 300);   -- Rücksendeadresse der verleihenden Person
alter table loans add column tracking_out text check (length(tracking_out) <= 60);
alter table loans add column tracking_back text check (length(tracking_back) <= 60);

alter table loans drop constraint if exists loans_handover_method_check;
alter table loans add constraint loans_handover_method_check
  check (handover_method in ('scan', 'code', 'report', 'dropoff', 'pass_on', 'shipping'));
