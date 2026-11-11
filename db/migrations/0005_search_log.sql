-- Kennzahl «Liquidität» (PRD 2): Anteil Suchen mit mindestens einem verfügbaren Treffer im Umkreis von 5 km
create table search_log (
  id            bigint generated always as identity primary key,
  user_id       uuid references users (id) on delete set null,
  q             text not null,
  hits          integer not null,
  available_5km integer not null,
  created_at    timestamptz not null default now()
);
create index on search_log (created_at);
