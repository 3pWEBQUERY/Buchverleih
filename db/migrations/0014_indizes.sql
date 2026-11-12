-- Indizes für die häufigsten Abfragen (Analyse vom 12.11.)

-- Jede Bildauslieferung sucht den Upload über den Schlüssel
create index if not exists uploads_key_idx on uploads (key);

-- Umkreissuche: earth_box(...) @> ll_to_earth(display_lat, display_lng) nutzt diesen GiST-Index
create index if not exists users_display_earth_idx on users using gist (ll_to_earth(display_lat, display_lng));

-- Erstes Foto eines Exemplars (Regal, Suche, Kreise)
create index if not exists copy_photos_copy_idx on copy_photos (copy_id, position);

-- Ungelesene Benachrichtigungen pro Person und Vorgang (Zähler, «neu» in Vorgängen)
create index if not exists notifications_unread_idx on notifications (user_id, loan_id) where channel = 'app' and read_at is null;

-- Fristenlauf: Vorgänge nach Status
create index if not exists loans_status_idx on loans (status) where status in ('requested', 'accepted', 'active', 'return_reported', 'returned', 'disputed');
