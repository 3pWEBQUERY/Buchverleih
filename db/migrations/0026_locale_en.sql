-- Englisch als vierte Sprache der Oberfläche
alter table users drop constraint if exists users_locale_check;
alter table users add constraint users_locale_check check (locale in ('de', 'fr', 'it', 'en'));
