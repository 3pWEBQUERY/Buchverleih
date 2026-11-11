-- Demo-Bestand für die Beta: 20 Mitglieder mit echten Büchern.
-- Der Worker sucht jede Ausgabe in den Katalogen (Google Books, DNB) und legt nur Treffer an.
-- Erkennbar an @demo.leihregal.invalid; entfernen mit einem Job «remove_demo»:
--   insert into jobs (kind) values ('remove_demo');
insert into jobs (kind, payload) values ('seed_demo', '{}'::jsonb);
