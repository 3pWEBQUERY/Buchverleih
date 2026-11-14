-- Kennzahlen über den ganzen Bestand, die sich langsam ändern (z. B. Genres auf der Startseite).
-- Der Worker frischt sie auf; alle Web-Instanzen lesen dieselbe Zeile statt je einen eigenen Zwischenspeicher zu halten.
create table app_stats (
  key          text primary key,
  value        jsonb not null,
  refreshed_at timestamptz not null default now()
);
