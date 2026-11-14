-- Push für die iOS-App über Apple Push Notification service (APNs).
-- Eigene Tabelle, weil Web-Push-Abos andere Pflichtfelder haben. Abmelden (Sitzung weg) entfernt das Gerät.
create table apns_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  session_id  uuid references sessions (id) on delete cascade,
  token       text not null unique check (token ~ '^[0-9a-f]{64,200}$'),
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  failures    int not null default 0,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index apns_devices_user on apns_devices (user_id);
