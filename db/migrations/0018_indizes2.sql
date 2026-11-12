-- Indizes für Abfragen, die bisher ganze Tabellen lasen (Analyse November 2026)

-- Direkte Weitergabe: Nachfolger eines Vorgangs (Kalender, Weitergabe-Kette)
create index if not exists loans_received_from_idx on loans (received_from_loan_id) where received_from_loan_id is not null;

-- Meldungen zu einem Ziel (Moderation, Bildrechte)
create index if not exists reports_target_idx on reports (target_type, target_id);

-- Abmelden löscht Push-Abos über die Sitzung (on delete cascade)
create index if not exists push_subscriptions_session_idx on push_subscriptions (session_id);

-- Bildverarbeitung aktualisiert Fotos über den Schlüssel
create index if not exists copy_photos_key_idx on copy_photos (key);
