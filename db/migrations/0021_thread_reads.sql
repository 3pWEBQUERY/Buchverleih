-- Lesestand im Chat (Vorgang und Übergabe-Chat): pro Person und Thread, bis wohin gelesen wurde.
-- Daraus entstehen «Gelesen» unter der letzten eigenen Nachricht und die ungelesene Zahl in der Vorgangsliste.
create table thread_reads (
  user_id              uuid not null references users (id) on delete cascade,
  loan_id              uuid references loans (id) on delete cascade,
  handover_chat_id     uuid references handover_chats (id) on delete cascade,
  last_read_message_id uuid references messages (id) on delete set null,
  -- Zeitpunkt der letzten gelesenen Nachricht (created_at), nicht der Moment des Lesens
  last_read_at         timestamptz not null default now(),
  check ((loan_id is null) <> (handover_chat_id is null))
);
create unique index thread_reads_loan on thread_reads (user_id, loan_id) where loan_id is not null;
create unique index thread_reads_chat on thread_reads (user_id, handover_chat_id) where handover_chat_id is not null;
create index thread_reads_by_loan on thread_reads (loan_id) where loan_id is not null;
create index thread_reads_by_chat on thread_reads (handover_chat_id) where handover_chat_id is not null;

-- Bestehende Threads gelten als gelesen, sonst wären nach dem Einspielen alle alten Nachrichten «neu».
insert into thread_reads (user_id, loan_id, last_read_at)
select p.user_id, l.id, now()
  from loans l
  cross join lateral (values (l.owner_id), (l.borrower_id)) p (user_id)
 where exists (select 1 from messages m where m.loan_id = l.id);

insert into thread_reads (user_id, handover_chat_id, last_read_at)
select distinct p.user_id, hc.id, now()
  from handover_chats hc
  join loans pl on pl.id = hc.prev_loan_id
  join loans nl on nl.id = hc.next_loan_id
  cross join lateral (values (nl.owner_id), (pl.borrower_id), (nl.borrower_id)) p (user_id)
 where exists (select 1 from messages m where m.handover_chat_id = hc.id);

-- Live: ein geänderter Lesestand geht über denselben Kanal wie Nachrichten. Das Merkmal «read»
-- unterscheidet ihn; /api/v1/stream gibt ihn als Ereignis «read» weiter.
create or replace function notify_thread_read() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.last_read_at is not distinct from old.last_read_at then return new; end if;
  perform pg_notify('chat', json_build_object(
    'loan_id', new.loan_id, 'handover_chat_id', new.handover_chat_id,
    'user_id', new.user_id, 'last_read_at', new.last_read_at, 'read', true)::text);
  return new;
end $$;
create trigger thread_reads_notify after insert or update on thread_reads
  for each row execute function notify_thread_read();
