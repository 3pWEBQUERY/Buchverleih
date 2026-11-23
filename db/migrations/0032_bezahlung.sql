-- Phase 3: Fördermitgliedschaft und Kreise für Organisationen über Stripe (PRD 11.2).
-- Die Leihe bleibt kostenlos; bezahlt wird nur für Leistungen rund um die Leihe.

insert into plans (id, name, entitlements) values
  ('supporter', 'Fördermitglied', '{
     "limits": {
       "0": { "concurrent": 2,  "open_requests": 3 },
       "1": { "concurrent": 5,  "open_requests": 6 },
       "2": { "concurrent": 10, "open_requests": 10 }
     },
     "title_alarms": 100,
     "csv_export": true,
     "shelf_stats": true
   }'::jsonb),
  ('organization', 'Organisation', '{
     "limits": {
       "0": { "concurrent": 2,  "open_requests": 3 },
       "1": { "concurrent": 5,  "open_requests": 6 },
       "2": { "concurrent": 10, "open_requests": 10 }
     },
     "title_alarms": 20,
     "csv_export": true,
     "shelf_stats": true,
     "circle_stats": true,
     "branding": true
   }'::jsonb)
on conflict (id) do nothing;

-- Preise in Rappen, in der Moderation änderbar (gelten für neue Abschlüsse)
create table prices (
  key      text primary key check (key in ('supporter_month', 'supporter_year', 'org_month', 'shipping_fee')),
  amount   integer not null check (amount >= 0),
  currency text not null default 'chf',
  updated_at timestamptz not null default now()
);
insert into prices (key, amount) values ('supporter_month', 300), ('supporter_year', 3000), ('org_month', 1500), ('shipping_fee', 50)
on conflict do nothing;

alter table users add column stripe_customer_id text unique;

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  kind                   text not null check (kind in ('supporter', 'organization')),
  user_id                uuid not null references users (id) on delete cascade,
  circle_id              uuid references circles (id) on delete set null,
  stripe_subscription_id text not null unique,
  status                 text not null,
  amount                 integer,
  interval               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (kind <> 'organization' or circle_id is not null)
);
create index on subscriptions (user_id);
create index on subscriptions (circle_id);

-- Jedes Stripe-Ereignis nur einmal verarbeiten
create table billing_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- Eigenes Erscheinungsbild für Kreise von Organisationen
alter table circles add column brand_color text check (brand_color ~ '^#[0-9a-f]{6}$');
alter table circles add column logo_key text;
