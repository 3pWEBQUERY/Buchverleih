-- Warteschlange für Hintergrundaufgaben in Postgres (PRD 10.2).
-- Aufgaben werden in derselben Transaktion wie der Zustandswechsel eingereiht.
create table jobs (
  id         bigint generated always as identity primary key,
  kind       text not null,
  payload    jsonb not null default '{}'::jsonb,
  run_at     timestamptz not null default now(),
  attempts   smallint not null default 0,
  locked_at  timestamptz,
  done_at    timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index jobs_ready on jobs (run_at) where done_at is null;

-- Heutiges Datum in der Schweiz; alle Kalenderdaten beziehen sich darauf.
create or replace function today_ch() returns date language sql stable as $$
  select (now() at time zone 'Europe/Zurich')::date
$$;

-- Fälligkeit: Ende des letzten gebuchten Tages (= Beginn des Folgetags) in Schweizer Zeit.
create or replace function day_start_ch(d date) returns timestamptz language sql stable as $$
  select (d::timestamp at time zone 'Europe/Zurich')
$$;

-- Benachrichtigung über neue Chatnachrichten per LISTEN/NOTIFY (PRD 10.2, Echtzeit im Chat)
create or replace function notify_message() returns trigger language plpgsql as $$
begin
  perform pg_notify('chat', json_build_object(
    'loan_id', new.loan_id, 'handover_chat_id', new.handover_chat_id, 'id', new.id)::text);
  return new;
end $$;
create trigger messages_notify after insert or update on messages
  for each row execute function notify_message();

-- Statuswechsel ebenfalls melden, damit offene Vorgangsseiten sich aktualisieren
create or replace function notify_loan_event() returns trigger language plpgsql as $$
begin
  perform pg_notify('chat', json_build_object('loan_id', new.loan_id, 'event', new.action)::text);
  return new;
end $$;
create trigger loan_events_notify after insert on loan_events
  for each row execute function notify_loan_event();
