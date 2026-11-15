-- Warteliste: Sprache für die Benachrichtigung und Zeitpunkt, an dem gemeldet wurde, dass das Gebiet offen ist
alter table plz_waitlist add column locale text not null default 'de' check (locale in ('de', 'fr', 'it', 'en'));
alter table plz_waitlist add column notified_at timestamptz;
create index on plz_waitlist (plz) where notified_at is null;
