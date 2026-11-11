-- Leihregal · Grundschema
-- Die Regeln aus PRD Abschnitt 4 sind als Constraints formuliert, damit kein
-- Programmfehler sie umgehen kann.

create extension if not exists btree_gist;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists cube;
create extension if not exists earthdistance;

-- unaccent ist nur STABLE. Für Indizes und generierte Spalten braucht es eine
-- IMMUTABLE-Hülle mit fest angegebenem Wörterbuch.
create or replace function f_unaccent(text) returns text
  language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

create or replace function f_search_text(title text, authors text[]) returns text
  language sql immutable parallel safe
  as $$ select lower(f_unaccent(coalesce(title, '') || ' ' || coalesce(array_to_string(authors, ' '), ''))) $$;

create or replace function f_search_vector(title text, authors text[]) returns tsvector
  language sql immutable parallel safe
  as $$ select
    setweight(to_tsvector('german'::regconfig, f_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple'::regconfig, f_unaccent(coalesce(array_to_string(authors, ' '), ''))), 'B') $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type offer_kind  as enum ('lend', 'swap', 'gift');
create type loan_status as enum (
  'requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed',
  'completed', 'declined', 'withdrawn', 'expired', 'cancelled', 'lost'
);
create type copy_visibility as enum ('all', 'proven', 'circles');
create type pass_on_mode    as enum ('never', 'on_request', 'always');
create type user_role       as enum ('member', 'moderator', 'admin');
create type case_kind       as enum ('damage', 'nonreturn');
create type token_direction as enum ('handover', 'return', 'swap_owner', 'swap_borrower', 'pass_on');

-- ---------------------------------------------------------------------------
-- Regionen, Postleitzahlen, Feature-Schalter, Pläne
-- ---------------------------------------------------------------------------
create table regions (
  id         text primary key,
  name       text not null,
  enabled    boolean not null default false,
  created_at timestamptz not null default now()
);

create table postal_codes (
  plz          text primary key check (plz ~ '^[0-9]{4}$'),
  municipality text not null,
  region_id    text references regions (id),
  lat          double precision not null,
  lng          double precision not null
);

create table plz_waitlist (
  id         bigint generated always as identity primary key,
  email      text not null,
  plz        text not null check (plz ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (email, plz)
);

create table feature_flags (
  key        text not null,
  region_id  text not null references regions (id),
  enabled    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (key, region_id)
);

-- Monetarisierung vorbereitet (PRD 11.3): Limiten kommen aus dem Plan, nicht aus dem Code.
create table plans (
  id           text primary key,
  name         text not null,
  entitlements jsonb not null
);

-- ---------------------------------------------------------------------------
-- Mitglieder, Anmeldung, Sitzungen
-- ---------------------------------------------------------------------------
create table users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  email_verified_at  timestamptz,
  phone_e164         text,
  phone_verified_at  timestamptz,
  first_name         text not null default '' check (length(first_name) <= 40),
  plz                text references postal_codes (plz),
  municipality       text,
  -- Wohnort auf rund 100 m gerundet (PRD 12)
  home_lat           double precision,
  home_lng           double precision,
  -- Anzeigeposition: einmalig zufällig innerhalb von rund 150 m verschoben
  display_lat        double precision,
  display_lng        double precision,
  avatar_key         text,
  trust_level        smallint not null default 0 check (trust_level between 0 and 2),
  role               user_role not null default 'member',
  plan_id            text not null default 'standard' references plans (id),
  age_confirmed_at   timestamptz,
  shelf_paused       boolean not null default false,
  email_prefs        jsonb not null default '{}'::jsonb,
  lending_suspended_at timestamptz,          -- Streitfall Tag 14
  banned_at          timestamptz,
  ban_reason         text,
  own_books_prompted_at timestamptz,
  onboarded_at       timestamptz,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now()
);
create unique index users_email_key on users (lower(email)) where deleted_at is null;
-- Eine Nummer, ein Konto (PRD 6.1)
create unique index users_phone_key on users (phone_e164) where phone_verified_at is not null and deleted_at is null;

create table banned_phones (
  phone_e164 text primary key,
  reason     text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  token_hash   text not null unique,
  kind         text not null default 'web' check (kind in ('web', 'api')),
  user_agent   text,
  ip_hint      text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index on sessions (user_id);

create table login_tokens (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table phone_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  phone_e164  text not null,
  code_hash   text not null,
  attempts    smallint not null default 0,
  expires_at  timestamptz not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table passkeys (
  id          text primary key,                 -- Credential-ID (base64url)
  user_id     uuid not null references users (id) on delete cascade,
  public_key  bytea not null,
  counter     bigint not null default 0,
  transports  text[] not null default '{}',
  name        text not null default 'Passkey',
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create table webauthn_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users (id) on delete cascade,
  challenge  text not null,
  purpose    text not null check (purpose in ('register', 'login')),
  expires_at timestamptz not null
);

-- Einfache Ratenbegrenzung in Postgres (Anmeldung, Anfragen, Nachrichten)
create table rate_limits (
  key        text not null,
  window_start timestamptz not null,
  hits       integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Katalog: Werk und Ausgabe sind getrennt
-- ---------------------------------------------------------------------------
create table works (
  id                uuid primary key default gen_random_uuid(),
  work_key          text not null unique,      -- normalisiert: titel|erster autor
  title             text not null,
  subtitle          text,
  authors           text[] not null default '{}',
  original_language text,
  genre             text,
  search_text       text generated always as (f_search_text(title, authors)) stored,
  search_vector     tsvector generated always as (f_search_vector(title, authors)) stored,
  created_at        timestamptz not null default now()
);
create index works_trgm on works using gin (search_text gin_trgm_ops);
create index works_fts  on works using gin (search_vector);

create table editions (
  id          uuid primary key default gen_random_uuid(),
  work_id     uuid not null references works (id),
  isbn13      text unique check (isbn13 ~ '^97[89][0-9]{10}$'),
  title       text not null,
  publisher   text,
  year        smallint,
  language    text,
  binding     text check (binding in ('hardcover', 'paperback', 'other')),
  pages       integer,
  cover_key   text,
  cover_w     integer,
  cover_h     integer,
  source      text not null check (source in ('dnb', 'openlibrary', 'google', 'manual')),
  created_by  uuid references users (id),
  created_at  timestamptz not null default now()
);
create index on editions (work_id);

-- Zwischenspeicher externer Abfragen, auch für Fehltreffer
create table catalog_lookups (
  isbn13     text primary key,
  found      boolean not null,
  source     text,
  payload    jsonb,
  fetched_at timestamptz not null default now()
);

create table catalog_corrections (
  id          uuid primary key default gen_random_uuid(),
  edition_id  uuid not null references editions (id),
  user_id     uuid references users (id),
  field       text not null,
  suggestion  text not null,
  status      text not null default 'open' check (status in ('open', 'applied', 'rejected')),
  handled_by  uuid references users (id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Kreise
-- ---------------------------------------------------------------------------
create table circles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 2 and 60),
  description  text check (length(description) <= 280),
  loan_days    smallint not null default 28 check (loan_days in (14, 28, 42, 56)),
  auto_accept  boolean not null default false,
  fixed_spot   text check (length(fixed_spot) <= 80),
  join_mode    text not null default 'link' check (join_mode in ('link', 'approval')),
  invite_code  text not null unique,
  plan_id      text not null default 'standard' references plans (id),
  created_by   uuid not null references users (id),
  created_at   timestamptz not null default now()
);

create table circle_members (
  circle_id  uuid not null references circles (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  status     text not null default 'active' check (status in ('pending', 'active')),
  joined_at  timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index on circle_members (user_id);

-- ---------------------------------------------------------------------------
-- Exemplare und Übergabeorte
-- ---------------------------------------------------------------------------
create table copies (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references users (id),
  edition_id          uuid not null references editions (id),
  condition           smallint not null check (condition between 1 and 4),
  condition_note      text check (length(condition_note) <= 200),
  offers              offer_kind[] not null default '{lend}',
  visibility          copy_visibility not null default 'all',
  loan_days           smallint not null default 28 check (loan_days in (14, 28, 42, 56)),
  auto_extend         boolean not null default true,
  max_extensions      smallint not null default 1 check (max_extensions between 0 and 2),
  horizon_days        smallint not null default 90 check (horizon_days in (30, 60, 90, 180)),
  buffer_days         smallint not null default 3 check (buffer_days between 0 and 7),
  max_future_bookings smallint not null default 3 check (max_future_bookings between 1 and 6),
  pass_on             pass_on_mode not null default 'on_request',
  chain_max           smallint not null default 2 check (chain_max between 1 and 4),
  dropoff_allowed     boolean not null default false,
  precious            boolean not null default false,  -- «Würde es dich schmerzen …»
  transfer_locked_until timestamptz,                   -- Geschenke: 30 Tage Sperre
  acquired_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  removed_at          timestamptz,
  removed_reason      text check (removed_reason in ('deleted', 'lost', 'swapped', 'gifted'))
);
create index on copies (owner_id) where removed_at is null;
create index on copies (edition_id) where removed_at is null;

create table copy_photos (
  id          uuid primary key default gen_random_uuid(),
  copy_id     uuid not null references copies (id) on delete cascade,
  key         text not null,
  width       integer,
  height      integer,
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);

create table circle_copies (
  circle_id  uuid not null references circles (id) on delete cascade,
  copy_id    uuid not null references copies (id) on delete cascade,
  primary key (circle_id, copy_id)
);
create index on circle_copies (copy_id);

create table pickup_spots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  label       text not null check (length(label) between 2 and 80),
  detail      text check (length(detail) <= 200),   -- genauer Ort, erst nach Annahme sichtbar
  lat         double precision,
  lng         double precision,
  dropoff     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Höchstens drei Übergabeorte pro Mitglied (PRD 4.3)
create or replace function check_pickup_spot_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from pickup_spots where user_id = new.user_id) >= 3 then
    raise exception 'höchstens drei Übergabeorte' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger pickup_spots_limit before insert on pickup_spots
  for each row execute function check_pickup_spot_limit();

-- ---------------------------------------------------------------------------
-- Vorgänge: Leihe, Tausch, Geschenk
-- ---------------------------------------------------------------------------
create table loans (
  id                    uuid primary key default gen_random_uuid(),
  kind                  offer_kind  not null,
  status                loan_status not null default 'requested',
  copy_id               uuid not null references copies (id),
  owner_id              uuid not null references users (id),
  borrower_id           uuid not null references users (id),
  wanted                daterange not null check (not isempty(wanted) and not lower_inf(wanted)),
  circle_id             uuid references circles (id),           -- Leihe innerhalb eines Kreises
  message               text check (length(message) <= 500),
  received_from_loan_id uuid references loans (id),             -- direkte Weitergabe: Vorgänger-Leihe
  pickup_spot_id        uuid references pickup_spots (id),
  -- Tausch: angebotene und gewählte Gegenstücke
  swap_offered_copy_ids uuid[] not null default '{}',
  swap_copy_id          uuid references copies (id),
  swap_scan_owner_at    timestamptz,
  swap_scan_borrower_at timestamptz,
  -- Zeitpunkte und Fristen
  requested_at          timestamptz not null default now(),
  respond_by            timestamptz not null default now() + interval '72 hours',
  accepted_at           timestamptz,
  handover_by           timestamptz,       -- 7 Tage nach geplantem Beginn
  handover_reported_at  timestamptz,       -- einseitige Meldung oder Ablage
  handover_reported_by  uuid references users (id),
  handover_method       text check (handover_method in ('scan', 'code', 'report', 'dropoff', 'pass_on')),
  dropoff_photo_key     text,
  handed_over_at        timestamptz,
  condition_note_until  timestamptz,
  condition_note        text check (length(condition_note) <= 500),
  condition_photo_keys  text[] not null default '{}',
  due_at                timestamptz,
  extensions_used       smallint not null default 0,
  extension_requested_at timestamptz,
  recalled_at           timestamptz,
  return_reported_at    timestamptz,
  return_reported_by    uuid references users (id),
  returned_at           timestamptz,
  inspection_until      timestamptz,
  closed_at             timestamptz,
  cancelled_by          uuid references users (id),
  cancelled_late        boolean not null default false,
  late                  boolean not null default false,      -- Rückgabe nach Fälligkeit + 3 Tage
  -- direkte Weitergabe: Zustimmungen (null = offen)
  pass_on_owner_ok      boolean,
  pass_on_prev_ok       boolean,
  pass_on_next_ok       boolean,
  pass_on_candidate_id  uuid references loans (id),           -- vorgeschlagene Vorgänger-Leihe
  swap_offer_copy_id    uuid references copies (id),         -- Leihe wird Tausch (5.4)
  rating_closes_at      timestamptz,
  check (owner_id <> borrower_id),
  check (status <> 'active' or handed_over_at is not null),
  check (kind <> 'lend' or status <> 'active' or due_at is not null),
  check (kind = 'swap' or swap_copy_id is null),
  check (cardinality(swap_offered_copy_ids) <= 5)
);
create index on loans (owner_id, status);
create index on loans (borrower_id, status);
create index on loans (copy_id, status);

-- Höchstens eine offene Anfrage pro Mitglied, Exemplar und Starttag.
create unique index loans_one_request_per_borrower
  on loans (copy_id, borrower_id, lower(wanted)) where status = 'requested';

-- Der Verleihkalender: ein Eintrag pro belegtem Zeitraum eines Exemplars.
-- loan_id null = vom Besitzer selbst gesperrt (Ferien, selbst lesen).
-- Tausch und Geschenk belegen ab Übergabe ohne Ende: daterange(start, null).
create table copy_bookings (
  id          bigint generated always as identity primary key,
  copy_id     uuid not null references copies (id),
  loan_id     uuid references loans (id) on delete cascade,
  period      daterange not null check (not isempty(period) and not lower_inf(period)),
  buffer_days smallint not null default 0 check (buffer_days between 0 and 7),
  note        text check (length(note) <= 80),
  paused      boolean not null default false,
  -- Zwei Einträge desselben Exemplars dürfen sich nicht überschneiden,
  -- der Puffer nach dem Ende zählt mit. Bei direkter Weitergabe ist er 0.
  exclude using gist (
    copy_id with =,
    (daterange(lower(period), upper(period) + buffer_days)) with &&
  )
);
create unique index copy_bookings_loan on copy_bookings (loan_id) where loan_id is not null;

-- Lückenloser Verlauf: jede Zustandsänderung wird angehängt, nie überschrieben.
create table loan_events (
  id          bigint generated always as identity primary key,
  loan_id     uuid not null references loans (id),
  actor_id    uuid references users (id),      -- null = System (Frist abgelaufen)
  action      text not null,
  from_status loan_status,
  to_status   loan_status not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index on loan_events (loan_id, id);

create or replace function forbid_event_changes() returns trigger language plpgsql as $$
begin
  raise exception 'loan_events ist nur anhängend' using errcode = '42501';
end $$;
create trigger loan_events_append_only before update or delete on loan_events
  for each row execute function forbid_event_changes();

-- Einmal-Token für QR-Scan. Nur Hashes werden gespeichert.
create table handover_tokens (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references loans (id),
  direction    token_direction not null,
  token_hash   text not null unique,
  code_hash    text not null,
  created_by   uuid not null references users (id),
  attempts     smallint not null default 0,
  valid_until  timestamptz not null,
  redeemed_at  timestamptz,
  redeemed_by  uuid references users (id),
  created_at   timestamptz not null default now()
);
create index on handover_tokens (loan_id);

-- Merker für Erinnerungen und Fristläufe, damit jeder Schritt genau einmal passiert
create table deadline_marks (
  loan_id    uuid not null references loans (id),
  mark       text not null,
  created_at timestamptz not null default now(),
  primary key (loan_id, mark)
);

-- ---------------------------------------------------------------------------
-- Übergabe-Chat zwischen zwei aufeinanderfolgenden Leihen (PRD 4.10)
-- ---------------------------------------------------------------------------
create table handover_chats (
  id           uuid primary key default gen_random_uuid(),
  prev_loan_id uuid not null references loans (id),
  next_loan_id uuid not null references loans (id),
  route        text check (route in ('direct', 'via_owner')),
  agreed_place text,
  agreed_at    timestamptz,
  read_only_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (prev_loan_id, next_loan_id)
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  loan_id          uuid references loans (id),
  handover_chat_id uuid references handover_chats (id),
  sender_id        uuid references users (id),          -- null = Systemnachricht
  body             text check (length(body) <= 2000),
  proposal_place   text check (length(proposal_place) <= 120),
  proposal_at      timestamptz,
  proposal_status  text check (proposal_status in ('open', 'accepted', 'countered', 'withdrawn')),
  proposal_accepted_by uuid[] not null default '{}',
  flagged          boolean not null default false,      -- Preisangaben o. ä. zur Prüfung
  created_at       timestamptz not null default now(),
  check ((loan_id is null) <> (handover_chat_id is null)),
  check (body is not null or proposal_at is not null)
);
create index on messages (loan_id, created_at);
create index on messages (handover_chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Wunschliste, Titelalarm, Tauschtreffer
-- ---------------------------------------------------------------------------
create table wishlist_items (
  user_id    uuid not null references users (id) on delete cascade,
  work_id    uuid not null references works (id),
  radius_km  smallint not null default 5 check (radius_km between 1 and 50),
  alarm      boolean not null default true,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

create table swap_matches (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references users (id) on delete cascade,
  user_b      uuid not null references users (id) on delete cascade,
  copy_for_a  uuid not null references copies (id) on delete cascade,  -- Buch von B auf A's Wunschliste
  copy_for_b  uuid not null references copies (id) on delete cascade,
  found_at    timestamptz not null default now(),
  dismissed_by uuid[] not null default '{}',
  unique (copy_for_a, copy_for_b)
);

-- ---------------------------------------------------------------------------
-- Vertrauen und Sicherheit
-- ---------------------------------------------------------------------------
create table cases (
  id               uuid primary key default gen_random_uuid(),
  loan_id          uuid not null references loans (id),
  kind             case_kind not null,
  stage            smallint not null default 0,
  opened_by        uuid references users (id),       -- null = automatisch
  opened_at        timestamptz not null default now(),
  description      text check (length(description) <= 1000),
  photo_keys       text[] not null default '{}',
  response         text check (response in ('return_date', 'replace_same', 'replace_other', 'swap_offer', 'object')),
  response_detail  text check (length(response_detail) <= 500),
  response_at      timestamptz,
  return_planned_at timestamptz,
  outcome          text check (outcome in ('returned', 'replaced', 'swapped', 'lost', 'rejected')),
  closed_at        timestamptz,
  cleared_at       timestamptz,                         -- Verlust nachträglich bereinigt
  moderator_id     uuid references users (id),
  moderator_note   text
);
create unique index cases_one_open_per_loan on cases (loan_id) where closed_at is null;

create table ratings (
  loan_id      uuid not null references loans (id),
  from_user    uuid not null references users (id),
  for_user     uuid not null references users (id),
  verdict      text not null check (verdict in ('good', 'problems')),
  reasons      text[] not null default '{}',
  note         text check (length(note) <= 500),     -- nur für die Moderation
  visible_from timestamptz not null,
  created_at   timestamptz not null default now(),
  primary key (loan_id, from_user),
  check (reasons <@ array['late', 'condition', 'communication', 'no_show']::text[])
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users (id),            -- null = automatische Markierung
  target_type text not null check (target_type in ('user', 'message', 'copy', 'photo', 'edition', 'loan')),
  target_id   text not null,
  reason      text not null check (reason in ('harassment', 'commercial', 'inappropriate', 'fake', 'price_pattern', 'other')),
  note        text check (length(note) <= 1000),
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by  uuid references users (id),
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table blocks (
  blocker_id uuid not null references users (id) on delete cascade,
  blocked_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  type       text not null,
  channel    text not null check (channel in ('app', 'email', 'sms', 'push')),
  loan_id    uuid references loans (id),
  payload    jsonb not null default '{}'::jsonb,
  sent_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc) where channel = 'app';

-- Protokoll der Moderation, inklusive jedes Zugriffs auf Chat-Inhalte (PRD 12)
create table moderation_log (
  id           bigint generated always as identity primary key,
  moderator_id uuid not null references users (id),
  action       text not null,
  target_type  text not null,
  target_id    text not null,
  note         text,
  created_at   timestamptz not null default now()
);

-- Uploads in den Bucket
create table uploads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  purpose      text not null check (purpose in ('copy_photo', 'avatar', 'case', 'dropoff', 'condition', 'manual_cover')),
  raw_key      text not null unique,
  key          text,                 -- verarbeitete Variante (ohne Endung)
  content_type text not null,
  max_bytes    integer not null,
  width        integer,
  height       integer,
  status       text not null default 'pending' check (status in ('pending', 'uploaded', 'processed', 'rejected')),
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

-- Nachfrage-Zähler für spätere Preisentscheide (PRD 11.3)
create table interest_signals (
  id         bigint generated always as identity primary key,
  key        text not null,
  user_id    uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Betriebsüberwachung: wann lief welcher Hintergrundlauf zuletzt
create table worker_heartbeats (
  job        text primary key,
  last_run_at timestamptz not null,
  last_result jsonb
);
