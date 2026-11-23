-- Mehrfachkonten (PRD 6.4): Geräte- und IP-Signale als Hinweis für die Moderation.
-- Gespeichert wird nur ein Hash mit geheimem Salz, nie die IP oder Gerätekennung selbst; Löschung nach 90 Tagen.
create table app_settings (
  key   text primary key,
  value text not null
);
insert into app_settings (key, value)
values ('signal_pepper', md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text))
on conflict do nothing;

create table account_signals (
  user_id    uuid not null references users (id) on delete cascade,
  kind       text not null check (kind in ('ip', 'device')),
  hash       text not null,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (user_id, kind, hash)
);
create index on account_signals (kind, hash);
