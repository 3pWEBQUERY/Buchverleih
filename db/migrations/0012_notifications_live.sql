-- Benachrichtigungen live: jede neue App-Benachrichtigung und jedes «gelesen» wird per
-- LISTEN/NOTIFY gemeldet. Offene Seiten zeigen sie sofort, der Zähler in der Seitenleiste
-- stimmt in allen Tabs.
create or replace function notify_notification() returns trigger language plpgsql as $$
begin
  if new.channel <> 'app' then return new; end if;
  if tg_op = 'INSERT' then
    perform pg_notify('notif', json_build_object('user_id', new.user_id, 'id', new.id, 'op', 'new')::text);
  elsif new.read_at is distinct from old.read_at then
    -- gleiche Nutzlast pro Person: Postgres fasst sie innerhalb einer Transaktion zusammen
    perform pg_notify('notif', json_build_object('user_id', new.user_id, 'op', 'read')::text);
  end if;
  return new;
end $$;

drop trigger if exists notifications_notify on notifications;
create trigger notifications_notify after insert or update of read_at on notifications
  for each row execute function notify_notification();
