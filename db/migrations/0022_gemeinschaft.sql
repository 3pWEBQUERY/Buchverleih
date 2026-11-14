-- Gemeinschaft: Pinnwand im Kreis, geteilte Wünsche, Zettel im Buch, Puls.
-- Die Regeln stehen wie überall als Constraints und Trigger in der Datenbank.

-- ---------------------------------------------------------------------------
-- Pinnwand: drei strukturierte Zetteltypen, kein freier Chat
-- ---------------------------------------------------------------------------
create type circle_post_kind as enum ('search', 'recommend', 'announce');

create table circle_posts (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references circles (id) on delete cascade,
  author_id    uuid not null references users (id),
  kind         circle_post_kind not null,
  body         text check (length(body) between 1 and 500),
  work_id      uuid references works (id),              -- Suche
  copy_id      uuid references copies (id),             -- Empfehlung: eigenes Exemplar im Kreisregal
  needed_by    date,                                    -- Suche: «bis wann»
  event_at     timestamptz,                             -- Ankündigung mit Termin
  event_place  text check (length(event_place) between 1 and 120),
  fulfilled_at timestamptz,                             -- Suche erfüllt
  flagged      boolean not null default false,          -- Preisangaben o. ä. zur Prüfung
  hidden_at    timestamptz,                             -- von der Moderation ausgeblendet
  hidden_by    uuid references users (id),
  created_at   timestamptz not null default now(),
  -- Suche: Werk Pflicht, Text höchstens 280 Zeichen
  check (kind <> 'search' or (work_id is not null and copy_id is null and event_at is null and event_place is null
                              and (body is null or length(body) <= 280))),
  -- Empfehlung: Exemplar und ein Satz
  check (kind <> 'recommend' or (copy_id is not null and work_id is null and body is not null and length(body) <= 280
                                 and needed_by is null and event_at is null and event_place is null)),
  -- Ankündigung: Text Pflicht, Termin und Ort freiwillig
  check (kind <> 'announce' or (body is not null and work_id is null and copy_id is null and needed_by is null)),
  check (fulfilled_at is null or kind = 'search')
);
create index circle_posts_circle on circle_posts (circle_id, created_at desc);
create index circle_posts_author on circle_posts (author_id);
create index circle_posts_open_search on circle_posts (author_id, work_id) where kind = 'search' and fulfilled_at is null;

-- Genau zwei Reaktionen: «Danke» und «Will ich auch lesen»
create table circle_post_reactions (
  post_id    uuid not null references circle_posts (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  kind       text not null check (kind in ('thanks', 'want')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

-- Kommentare: eine Ebene
create table circle_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references circle_posts (id) on delete cascade,
  author_id  uuid not null references users (id),
  body       text not null check (length(body) between 1 and 500),
  flagged    boolean not null default false,
  hidden_at  timestamptz,
  hidden_by  uuid references users (id),
  created_at timestamptz not null default now()
);
create index circle_post_comments_post on circle_post_comments (post_id, created_at);
create index circle_post_comments_author on circle_post_comments (author_id);

-- «Ich hab's»: ein Angebot an die suchende Person. Die Anfrage selbst läuft danach ganz normal.
create table circle_post_offers (
  post_id    uuid not null references circle_posts (id) on delete cascade,
  copy_id    uuid not null references copies (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, copy_id)
);
create index circle_post_offers_user on circle_post_offers (user_id);

-- Nur aktive Mitglieder schreiben, Ankündigungen nur Admins
create or replace function circle_post_guard() returns trigger language plpgsql as $$
declare r text;
begin
  select m.role into r from circle_members m
   where m.circle_id = new.circle_id and m.user_id = new.author_id and m.status = 'active';
  if r is null then
    raise exception 'nur aktive Mitglieder schreiben an die Pinnwand' using errcode = '23514';
  end if;
  if new.kind = 'announce' and r <> 'admin' then
    raise exception 'Ankündigungen schreiben nur Admins' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger circle_posts_guard before insert on circle_posts
  for each row execute function circle_post_guard();

-- Reaktionen, Kommentare und Angebote nur von aktiven Mitgliedern des Kreises; Angebote nur auf Suchzettel
create or replace function circle_post_child_guard() returns trigger language plpgsql as $$
declare
  who uuid := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'author_id')::uuid);
  p record;
begin
  select cp.circle_id, cp.kind into p from circle_posts cp where cp.id = new.post_id;
  if not exists (select 1 from circle_members m where m.circle_id = p.circle_id and m.user_id = who and m.status = 'active') then
    raise exception 'nur aktive Mitglieder des Kreises' using errcode = '23514';
  end if;
  if tg_table_name = 'circle_post_offers' and p.kind <> 'search' then
    raise exception 'Angebote gibt es nur auf Suchzettel' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger circle_post_reactions_guard before insert on circle_post_reactions
  for each row execute function circle_post_child_guard();
create trigger circle_post_comments_guard before insert on circle_post_comments
  for each row execute function circle_post_child_guard();
create trigger circle_post_offers_guard before insert on circle_post_offers
  for each row execute function circle_post_child_guard();

-- Live: jede Änderung an der Pinnwand per LISTEN/NOTIFY auf dem Kanal «circle»
create or replace function notify_circle_post() returns trigger language plpgsql as $$
declare
  r record;
  cid uuid;
  pid uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name = 'circle_posts' then
    cid := r.circle_id;
    pid := r.id;
  else
    pid := r.post_id;
    -- beim Löschen des Zettels ist die Zeile schon weg: dann meldet der Zettel selbst
    select circle_id into cid from circle_posts where id = pid;
  end if;
  if cid is not null then
    perform pg_notify('circle', json_build_object('circle_id', cid, 'post_id', pid, 'op',
      case tg_table_name when 'circle_posts' then lower(tg_op) when 'circle_post_reactions' then 'reaction' else 'comment' end)::text);
  end if;
  return null;
end $$;
create trigger circle_posts_notify after insert or update or delete on circle_posts
  for each row execute function notify_circle_post();
create trigger circle_post_reactions_notify after insert or delete on circle_post_reactions
  for each row execute function notify_circle_post();
create trigger circle_post_comments_notify after insert or update or delete on circle_post_comments
  for each row execute function notify_circle_post();

-- Suche erfüllt, sobald die suchende Person ein Exemplar dieses Werks übergeben bekommt.
-- Reine Nebenwirkung: ein Fehler hier darf die Übergabe nie aufhalten.
create or replace function fulfil_search_posts() returns trigger language plpgsql as $$
begin
  if new.action in ('handover', 'confirm_handover', 'handover_report_lapse') then
    begin
      update circle_posts p set fulfilled_at = now()
        from loans l join copies c on c.id = l.copy_id join editions e on e.id = c.edition_id
       where l.id = new.loan_id and p.kind = 'search' and p.fulfilled_at is null
         and p.author_id = l.borrower_id and p.work_id = e.work_id;
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;
create trigger loan_events_fulfil_search after insert on loan_events
  for each row execute function fulfil_search_posts();

-- ---------------------------------------------------------------------------
-- Wünsche im Kreis sichtbar
-- ---------------------------------------------------------------------------
alter table wishlist_items add column share_circles boolean not null default false;
create index wishlist_items_shared on wishlist_items (work_id) where share_circles;

-- ---------------------------------------------------------------------------
-- Zettel im Buch: ein Satz der leihenden Person für die nächsten Leserinnen und Leser
-- ---------------------------------------------------------------------------
create table book_notes (
  id         uuid primary key default gen_random_uuid(),
  copy_id    uuid not null references copies (id),
  loan_id    uuid not null unique references loans (id),   -- ein Zettel pro Leihe
  author_id  uuid references users (id),                   -- null nach Kontolöschung: der Zettel bleibt beim Buch
  body       text not null check (length(body) between 1 and 200),
  anonymous  boolean not null default false,
  flagged    boolean not null default false,
  hidden_at  timestamptz,                                  -- von der Besitzerin oder der Moderation ausgeblendet
  hidden_by  uuid references users (id),
  created_at timestamptz not null default now(),
  check (author_id is not null or anonymous)
);
create index book_notes_copy on book_notes (copy_id, created_at);
create index book_notes_author on book_notes (author_id);

-- Nur die leihende Person, nur zum eigenen abgeschlossenen Vorgang, nur zum Exemplar dieses Vorgangs
create or replace function book_note_guard() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from loans l
                  where l.id = new.loan_id and l.borrower_id = new.author_id and l.copy_id = new.copy_id
                    and l.status = 'completed' and l.handed_over_at is not null) then
    raise exception 'Zettel nur von der leihenden Person nach Abschluss' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger book_notes_guard before insert on book_notes
  for each row execute function book_note_guard();

-- ---------------------------------------------------------------------------
-- Puls und Benachrichtigungen zur Pinnwand
-- ---------------------------------------------------------------------------
alter table users add column pulse_show_new_books boolean not null default true;
-- replies = nur Antworten auf eigene Zettel, all = auch neue Zettel in meinen Kreisen, off = nichts per E-Mail und Push
alter table users add column pinboard_notify text not null default 'replies' check (pinboard_notify in ('replies', 'all', 'off'));

-- ---------------------------------------------------------------------------
-- Meldungen: Zettel, Kommentare und Zettel im Buch sind meldbar
-- ---------------------------------------------------------------------------
alter table reports drop constraint reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('user', 'message', 'copy', 'photo', 'edition', 'loan', 'circle_post', 'circle_post_comment', 'book_note'));
