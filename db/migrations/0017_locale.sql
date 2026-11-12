-- Sprache pro Konto, für E-Mails und Push (die Oberfläche folgt dem Cookie des Browsers)
alter table users add column locale text not null default 'de' check (locale in ('de', 'fr', 'it'));
