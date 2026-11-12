-- Anmeldung mit Passwort (scrypt-Hash, nie Klartext). Wer später per E-Mail-Link beweist,
-- dass die Adresse ihm gehört, übernimmt das Konto; ein fremdes Passwort wird dabei gelöscht.
alter table users add column password_hash text;
