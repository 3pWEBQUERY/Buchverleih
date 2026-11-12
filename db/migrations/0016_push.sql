-- Web-Push: ein Abo pro Gerät und Sitzung. Endet die Sitzung (Abmelden, Ablauf), verschwindet das Abo.
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  session_id  uuid references sessions (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  failures    int not null default 0,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index push_subscriptions_user on push_subscriptions (user_id);

-- Schlüssel, die der Server selbst erzeugt (VAPID für Web-Push). Nie an Clients ausser dem öffentlichen Teil.
create table app_keys (
  name       text primary key,
  public     text not null,
  private    text not null,
  created_at timestamptz not null default now()
);
