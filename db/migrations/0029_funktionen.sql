-- Funktionsschalter gelten jetzt für die ganze Plattform (Gebiete schalten seit 0027 den Zugang).
-- Startwerte entsprechen dem bisherigen Verhalten: alles sichtbar.
create table features (
  key        text primary key check (key in ('swap', 'pass_on', 'wishlist', 'map', 'shipping')),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into features (key, enabled) values ('swap', true), ('pass_on', true), ('wishlist', true), ('map', true), ('shipping', true);

-- Ein Standard-Umkreis pro Person: Start, Suche und neue Wünsche rechnen mit demselben Wert
alter table users add column radius_km smallint not null default 10 check (radius_km between 1 and 50);
